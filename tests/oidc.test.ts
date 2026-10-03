import { describe, expect, test } from "bun:test";

import { admit, allowed as allowedBy, claimsOf } from "../src/lib/server/oidc";

const rules = {
	adminGroups: ["5847ec59-0f80-4713-89f9-3624cc217468"],
	admins: ["ruk@example.com"],
};
const allowed = (claims: Record<string, unknown>) => allowedBy(claims, rules);

describe("allowed", () => {
	test("groups クレームに管理者グループがあれば通る", () => {
		expect(
			allowed({
				sub: "x",
				groups: ["aaa", "5847EC59-0f80-4713-89f9-3624cc217468"],
			}),
		).toBe(true);
	});
	test("roles クレームでもよい", () => {
		expect(
			allowed({ sub: "x", roles: ["5847ec59-0f80-4713-89f9-3624cc217468"] }),
		).toBe(true);
	});
	test("名指しの個人も通る", () => {
		expect(allowed({ sub: "x", email: "Ruk@example.com" })).toBe(true);
		expect(allowed({ sub: "x", preferred_username: "ruk@example.com" })).toBe(
			true,
		);
	});
	test("それ以外は通らない", () => {
		expect(
			allowed({ sub: "x", groups: ["other"], email: "someone@example.com" }),
		).toBe(false);
		expect(allowed({ sub: "x" })).toBe(false);
		expect(
			allowed({ sub: "x", groups: "not-an-array-but-string-of-other" }),
		).toBe(false);
	});
});

const jwt = (claims: Record<string, unknown>) =>
	`${Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url")}.${Buffer.from(
		JSON.stringify(claims),
	).toString("base64url")}.signature`;

const ISSUER = "https://login.example.com/v2.0";
const CLIENT = "client-id";
const NONCE = "nonce-value";
const expect_ = { issuer: ISSUER, clientId: CLIENT, nonce: NONCE };
const NOW = 1_700_000_000_000;
const base = {
	iss: ISSUER,
	aud: CLIENT,
	nonce: NONCE,
	exp: NOW / 1000 + 300,
	sub: "x",
};
const check = (over: Record<string, unknown>) =>
	admit({ ...base, ...over }, expect_, NOW);

describe("claimsOf", () => {
	test("payload を取り出す", () => {
		expect(claimsOf(jwt({ sub: "ruk", nonce: "n" }))).toEqual({
			sub: "ruk",
			nonce: "n",
		});
	});
	test("JWT の形でなければ弾く", () => {
		expect(() => claimsOf("not-a-jwt")).toThrow();
		expect(() => claimsOf("aaa.notbase64json.bbb")).toThrow();
	});
});

describe("admit", () => {
	test("揃っていれば通る", () => {
		expect(() => check({})).not.toThrow();
	});
	test("aud が配列でも自分が入っていれば通る", () => {
		expect(() => check({ aud: [CLIENT], azp: CLIENT })).not.toThrow();
	});
	test("別のアプリ宛ては弾く", () => {
		expect(() => check({ aud: "other-app" })).toThrow();
	});
	test("aud が複数で azp が自分でなければ弾く", () => {
		expect(() => check({ aud: [CLIENT, "other"], azp: "other" })).toThrow();
	});
	test("issuer 違いは弾く", () => {
		expect(() => check({ iss: "https://evil.example/v2.0" })).toThrow();
	});
	test("nonce 違いは弾く", () => {
		expect(() => check({ nonce: "別の値" })).toThrow();
	});
	test("期限切れは弾く", () => {
		expect(() => check({ exp: NOW / 1000 - 1 })).toThrow();
		expect(() => check({ exp: undefined })).toThrow();
	});
});
