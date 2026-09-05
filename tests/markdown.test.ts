import { describe, expect, test } from "bun:test";
import { countLinks, render } from "../src/lib/server/markdown";

describe("render", () => {
	test("Markdown を HTML にして危険なものを落とす", () => {
		const html = render(
			"**太字** <script>alert(1)</script> [link](https://example.com)",
		);
		expect(html).toContain("<strong>太字</strong>");
		expect(html).not.toContain("<script");
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('rel="nofollow noopener ugc"');
		expect(html).toContain('target="_blank"');
	});

	test("javascript: スキームは消える", () => {
		const html = render("[x](javascript:alert(1))");
		expect(html).not.toContain("javascript:");
	});

	test("改行は <br> になる", () => {
		expect(render("a\nb")).toContain("<br");
	});

	test("画像は既定では出ない", () => {
		expect(render("![a](https://example.com/a.png)")).not.toContain("<img");
	});

	test("自動リンクも数える", () => {
		const html = render(
			"https://a.example https://b.example [c](https://c.example)",
		);
		expect(countLinks(html)).toBe(3);
	});

	test("生の HTML のイベント属性は落ちる", () => {
		const html = render('<a href="https://x.example" onclick="alert(1)">x</a>');
		expect(html).not.toContain("onclick");
	});
});
