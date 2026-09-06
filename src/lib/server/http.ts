import type { RequestEvent, RequestHandler } from "@sveltejs/kit";
import { originAllowed } from "./env";

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
	}
}

export function json(
	data: unknown,
	status = 200,
	headers?: HeadersInit,
): Response {
	return Response.json(data, { status, headers });
}

/** エラーを {error, message} の JSON 1 種類に揃える */
export function api(
	handler: (event: RequestEvent) => Promise<unknown> | unknown,
): RequestHandler {
	return async (event) => {
		try {
			const result = await handler(event);
			return result instanceof Response ? result : json(result);
		} catch (e) {
			if (e instanceof ApiError) {
				return json({ error: e.code, message: e.message }, e.status);
			}
			console.error(`${event.request.method} ${event.url.pathname}`, e);
			return json({ error: "internal", message: "internal server error" }, 500);
		}
	};
}

export async function body<T extends object>(event: RequestEvent): Promise<T> {
	try {
		const data = await event.request.json();
		if (!data || typeof data !== "object" || Array.isArray(data))
			throw new Error();
		return data as T;
	} catch {
		throw new ApiError(400, "bad_request", "JSON のオブジェクトを送る");
	}
}

export function str(
	value: unknown,
	max: number,
	name: string,
	required = false,
): string {
	if (value === undefined || value === null) {
		if (required) throw new ApiError(400, "bad_request", `${name} は必須`);
		return "";
	}
	if (typeof value !== "string")
		throw new ApiError(400, "bad_request", `${name} は文字列`);
	const trimmed = value.trim();
	if (required && !trimmed)
		throw new ApiError(400, "bad_request", `${name} は必須`);
	if (trimmed.length > max)
		throw new ApiError(400, "bad_request", `${name} は ${max} 文字まで`);
	return trimmed;
}

/**
 * スレッドの鍵。http(s) の URL に限り、クエリと hash は落として正規化する。
 * 許可していないオリジンの URL ではスレッドを立てられないし、読めない
 */
export function pageKey(
	value: unknown,
	self: string,
	allow = originAllowed,
): string {
	const raw = str(value, 2000, "page", true);
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new ApiError(400, "bad_request", "page は http(s) の URL");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:")
		throw new ApiError(400, "bad_request", "page は http(s) の URL");
	if (url.origin !== self && !allow(url.origin))
		throw new ApiError(400, "bad_request", "page はこのサイトの URL ではない");
	url.search = "";
	url.hash = "";
	return url.href;
}

export function intParam(
	value: string | null,
	fallback: number,
	min: number,
	max: number,
): number {
	if (value === null || value === "") return fallback;
	const n = Number(value);
	if (!Number.isInteger(n))
		throw new ApiError(400, "bad_request", "数値で指定する");
	return Math.min(max, Math.max(min, n));
}

export function idParam(value: string): number {
	const n = Number(value);
	if (!Number.isInteger(n) || n <= 0)
		throw new ApiError(404, "not_found", "見つからない");
	return n;
}

export function requireAdmin(event: RequestEvent): void {
	if (!event.locals.admin) throw new ApiError(403, "forbidden", "管理者のみ");
}
