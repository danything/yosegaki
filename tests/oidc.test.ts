import { describe, expect, test } from "bun:test";

import { allowed as allowedBy } from "../src/lib/server/oidc";

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
