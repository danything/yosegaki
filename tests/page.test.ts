import { describe, expect, test } from "bun:test";

import { pageKey } from "../src/lib/server/http";

const SELF = "https://yk.example";
const allow = (origin: string | null) => origin === "https://example.com";
const key = (value: unknown) => pageKey(value, SELF, allow);

describe("pageKey", () => {
	test("クエリと hash は落とす", () => {
		expect(key("https://example.com/a?utm=x#c")).toBe("https://example.com/a");
	});
	test("許可したオリジンならそのまま", () => {
		expect(key("https://example.com/a/b")).toBe("https://example.com/a/b");
	});
	test("自分自身 (デモページ) は通る", () => {
		expect(key(`${SELF}/demo`)).toBe(`${SELF}/demo`);
	});
	test("許可していないオリジンでは立てられない", () => {
		expect(() => key("https://evil.example/a")).toThrow();
	});
	test("URL でない鍵は受け取らない", () => {
		expect(() => key("すきな文字列")).toThrow();
		expect(() => key("")).toThrow();
	});
	test("http(s) 以外のスキームも受け取らない", () => {
		expect(() => key("javascript:alert(1)")).toThrow();
		expect(() => key("file:///etc/passwd")).toThrow();
	});
});
