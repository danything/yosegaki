import type { Handle } from "@sveltejs/kit";
import { building, dev } from "$app/environment";
import { verifyAdminToken, visitorHash } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { assertOriginPolicy, env, originAllowed } from "$lib/server/env";
import { json } from "$lib/server/http";

// 設定ミスや壊れた DB は最初のリクエストではなく起動時に落とす
if (!building) {
	assertOriginPolicy(dev);
	db();
}

const ALLOW_HEADERS = "Content-Type, Authorization, X-Visitor";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

export const handle: Handle = async ({ event, resolve }) => {
	const origin = event.request.headers.get("origin");
	// 自分自身 (デモページ) は常に許可
	const allowed =
		origin !== null && (origin === event.url.origin || originAllowed(origin));

	if (
		event.request.method === "OPTIONS" &&
		event.url.pathname.startsWith("/api/")
	) {
		if (!allowed) return new Response(null, { status: 403 });
		return new Response(null, {
			status: 204,
			headers: {
				"access-control-allow-origin": origin,
				"access-control-allow-methods": ALLOW_METHODS,
				"access-control-allow-headers": ALLOW_HEADERS,
				"access-control-max-age": "86400",
				vary: "Origin",
			},
		});
	}

	// Origin を送るのはブラウザだけ。許可していないサイトからの書き込みは、
	// プリフライトの要らない形 (text/plain の POST など) でも通さない。
	// Origin の無いリクエスト (curl やサーバ間) は API の利用者として素通しする
	if (
		origin !== null &&
		!allowed &&
		event.request.method !== "GET" &&
		event.request.method !== "HEAD" &&
		event.url.pathname.startsWith("/api/")
	) {
		return json(
			{ error: "forbidden", message: "このオリジンからは書き込めない" },
			403,
		);
	}

	const auth = event.request.headers.get("authorization");
	event.locals.admin = verifyAdminToken(
		auth?.startsWith("Bearer ") ? auth.slice(7) : null,
	);
	event.locals.visitor = visitorHash(event.request.headers.get("x-visitor"));
	event.locals.ip = clientIp(event);

	const response = await resolve(event);
	if (allowed && event.url.pathname.startsWith("/api/")) {
		response.headers.set("access-control-allow-origin", origin);
		response.headers.append("vary", "Origin");
	}
	return response;
};

function clientIp(event: Parameters<Handle>[0]["event"]): string {
	if (env.clientIpHeader) {
		const v = event.request.headers.get(env.clientIpHeader);
		if (v) return v.split(",")[0].trim();
	}
	try {
		return event.getClientAddress();
	} catch {
		return "";
	}
}
