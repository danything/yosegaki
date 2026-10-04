import { createHash } from "node:crypto";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

/**
 * - `entry`: 埋め込み先の HTML が固定の URL で指すもの (embed.js, widget.css)。
 *   中身が変わり得るので短く持たせ、切れても裏で取り直す間は古いものを使わせる。
 *   取り直しは ETag で 304 になる
 * - `revalidate`: 毎回 ETag で確かめさせるもの (embed/app.js)。古い embed.js の逃げ道
 *   なので、それ自体が古くなっては困る
 * - `immutable`: ファイル名にハッシュが入っているもの (embed/*-<hash>.js)。
 *   中身が変わればファイル名が変わるので、1 年持たせて取り直させない
 */
export type CachePolicy = "entry" | "revalidate" | "immutable";

const CACHE_CONTROL: Record<CachePolicy, string> = {
	entry: "public, max-age=300, stale-while-revalidate=86400",
	revalidate: "public, no-cache",
	immutable: "public, max-age=31536000, immutable",
};

type Encoding = "br" | "gzip";

/** Accept-Encoding から使える圧縮を選ぶ。br を優先し、q=0 は断られたものとみなす */
export function pickEncoding(header: string | null): Encoding | null {
	if (!header) return null;
	const accepted = new Set<string>();
	for (const part of header.toLowerCase().split(",")) {
		const [name, ...params] = part.trim().split(";");
		const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
		if (q && Number(q.slice(2)) === 0) continue;
		accepted.add(name.trim());
	}
	if (accepted.has("br")) return "br";
	if (accepted.has("gzip")) return "gzip";
	return null;
}

/** If-None-Match がこの ETag (か *) を含むか。弱い比較 (W/ は無視) */
function matches(header: string | null, etag: string): boolean {
	if (!header) return false;
	return header
		.split(",")
		.map((t) => t.trim().replace(/^W\//, ""))
		.some((t) => t === etag || t === "*");
}

/**
 * ビルド時に文字列として抱え込んだ生成物を配る。記事ごとに読まれるので、
 * 圧縮は最初に要求されたときに一度だけ作って持っておく (前段のプロキシは圧縮しない)。
 * <script type=module> や import() で他のオリジンから読まれるので CORS を許す
 */
export function asset(content: string, type: string, policy: CachePolicy) {
	const hash = createHash("sha1")
		.update(content)
		.digest("base64url")
		.slice(0, 16);
	const raw = Buffer.from(content);
	// 圧縮したものと、それが元より小さくならなかったときの null
	const encoded: Partial<Record<Encoding, Buffer | null>> = {};
	const compress = (enc: Encoding): Buffer | null => {
		if (encoded[enc] !== undefined) return encoded[enc];
		const out =
			enc === "br"
				? brotliCompressSync(raw, {
						params: {
							[constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
							[constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
						},
					})
				: gzipSync(raw, { level: 9 });
		encoded[enc] = out.length < raw.length ? out : null;
		return encoded[enc];
	};

	return (request: Request): Response => {
		const accepted = pickEncoding(request.headers.get("accept-encoding"));
		const body = accepted ? compress(accepted) : null;
		const enc = body ? accepted : null;
		// 表現 (圧縮のしかた) ごとに別の ETag にする
		const etag = `"${hash}${enc ? `-${enc}` : ""}"`;
		const headers: Record<string, string> = {
			"content-type": type,
			"cache-control": CACHE_CONTROL[policy],
			"access-control-allow-origin": "*",
			vary: "Accept-Encoding",
			etag,
		};
		if (matches(request.headers.get("if-none-match"), etag)) {
			return new Response(null, { status: 304, headers });
		}
		if (enc) headers["content-encoding"] = enc;
		return new Response(new Uint8Array(body ?? raw), { headers });
	};
}
