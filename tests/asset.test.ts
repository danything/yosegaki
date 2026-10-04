import { describe, expect, test } from "bun:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

import { asset, pickEncoding } from "../src/lib/server/asset";

const JS = `console.log(${JSON.stringify("yosegaki ".repeat(200))});`;
const get = (headers: Record<string, string> = {}) =>
	new Request("https://yk.example/embed.js", { headers });

describe("pickEncoding", () => {
	test("br を優先する", () => {
		expect(pickEncoding("gzip, deflate, br, zstd")).toBe("br");
	});
	test("br が無ければ gzip", () => {
		expect(pickEncoding("gzip, deflate")).toBe("gzip");
	});
	test("q=0 は断られたものとみなす", () => {
		expect(pickEncoding("br;q=0, gzip;q=0.5")).toBe("gzip");
		expect(pickEncoding("gzip;q=0")).toBeNull();
	});
	test("無ければ圧縮しない", () => {
		expect(pickEncoding(null)).toBeNull();
		expect(pickEncoding("identity")).toBeNull();
	});
});

describe("asset", () => {
	test("Accept-Encoding に合わせて圧縮し、元に戻せる", async () => {
		const serve = asset(JS, "text/javascript", "entry");
		const br = serve(get({ "accept-encoding": "gzip, br" }));
		expect(br.headers.get("content-encoding")).toBe("br");
		expect(br.headers.get("vary")).toBe("Accept-Encoding");
		const brBody = Buffer.from(await br.arrayBuffer());
		expect(brBody.length).toBeLessThan(JS.length);
		expect(brotliDecompressSync(brBody).toString()).toBe(JS);

		const gz = serve(get({ "accept-encoding": "gzip" }));
		expect(gz.headers.get("content-encoding")).toBe("gzip");
		expect(gunzipSync(Buffer.from(await gz.arrayBuffer())).toString()).toBe(JS);

		const plain = serve(get());
		expect(plain.headers.get("content-encoding")).toBeNull();
		expect(await plain.text()).toBe(JS);
	});

	test("圧縮しても小さくならないものはそのまま返す", async () => {
		const serve = asset("x", "text/javascript", "entry");
		const res = serve(get({ "accept-encoding": "br" }));
		expect(res.headers.get("content-encoding")).toBeNull();
		expect(await res.text()).toBe("x");
	});

	test("表現ごとに ETag を分け、一致すれば 304", () => {
		const serve = asset(JS, "text/javascript", "entry");
		const etag = serve(get({ "accept-encoding": "br" })).headers.get("etag");
		const plainEtag = serve(get()).headers.get("etag");
		expect(etag).not.toBe(plainEtag);

		const hit = serve(
			get({ "accept-encoding": "br", "if-none-match": `W/${etag}` }),
		);
		expect(hit.status).toBe(304);
		expect(hit.headers.get("etag")).toBe(etag);
		// 別の表現の ETag では 304 にしない
		const miss = serve(
			get({ "accept-encoding": "gzip", "if-none-match": `${etag}` }),
		);
		expect(miss.status).toBe(200);
	});

	test("入口は短く持たせて裏で取り直させる。ハッシュ付きは immutable", () => {
		const entry = asset(JS, "text/javascript", "entry")(get());
		expect(entry.headers.get("cache-control")).toBe(
			"public, max-age=300, stale-while-revalidate=86400",
		);
		const chunk = asset(JS, "text/javascript", "immutable")(get());
		expect(chunk.headers.get("cache-control")).toBe(
			"public, max-age=31536000, immutable",
		);
	});

	test("他のオリジンから import() できる", () => {
		const res = asset(JS, "text/javascript", "immutable")(get());
		expect(res.headers.get("access-control-allow-origin")).toBe("*");
	});
});
