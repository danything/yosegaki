import { createHash } from "node:crypto";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * ビルド時に文字列として抱え込んだ生成物を配る。記事ごとに読まれるので短めに
 * キャッシュさせ、変わっていなければ 304 で済ませる。
 */
export function asset(content: string, type: string) {
	const etag = `"${createHash("sha1").update(content).digest("base64url").slice(0, 16)}"`;
	return (event: RequestEvent): Response => {
		const headers = {
			"content-type": type,
			"cache-control": "public, max-age=300",
			etag,
		};
		if (event.request.headers.get("if-none-match") === etag) {
			return new Response(null, { status: 304, headers });
		}
		return new Response(content, { headers });
	};
}
