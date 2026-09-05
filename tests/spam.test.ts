import { describe, expect, test } from "bun:test";

import { render } from "../src/lib/server/markdown";
import { decideStatus } from "../src/lib/server/spam";

const rules = {
	moderation: "links" as const,
	maxLinks: 1,
	blockWords: ["casino", "出会い"],
};

function decide(md: string, admin = false) {
	return decideStatus({ bodyMd: md, bodyHtml: render(md), admin }, rules);
}

describe("decideStatus", () => {
	test("普通の投稿は公開", () => {
		expect(decide("こんにちは https://a.example")).toBe("approved");
	});
	test("リンクが多いと承認待ち", () => {
		expect(decide("https://a.example https://b.example")).toBe("pending");
	});
	test("NG ワードは承認待ち (大文字小文字を無視)", () => {
		expect(decide("Best CASINO")).toBe("pending");
		expect(decide("出会いませんか")).toBe("pending");
	});
	test("管理者は常に公開", () => {
		expect(decide("https://a.example https://b.example casino", true)).toBe(
			"approved",
		);
	});
});
