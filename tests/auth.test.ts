import { describe, expect, test } from "bun:test";

process.env.ADMIN_PASSWORD = "pw";
process.env.SECRET = "test-secret";

const { checkAdminPassword, issueAdminToken, verifyAdminToken, visitorHash } =
	await import("../src/lib/server/auth");

describe("admin token", () => {
	test("発行したものは通る", () => {
		expect(verifyAdminToken(issueAdminToken().token)).toBe(true);
	});

	test("改ざんは通らない", () => {
		const { token } = issueAdminToken();
		const [exp, sig] = token.split(".");
		expect(verifyAdminToken(`${Number(exp) + 1}.${sig}`)).toBe(false);
		expect(verifyAdminToken(`${exp}.${sig.slice(1)}x`)).toBe(false);
		expect(verifyAdminToken("")).toBe(false);
		expect(verifyAdminToken(null)).toBe(false);
	});

	test("期限切れは通らない", () => {
		const { token } = issueAdminToken();
		const sig = token.split(".")[1];
		expect(verifyAdminToken(`${Date.now() - 1000}.${sig}`)).toBe(false);
	});
});

describe("password", () => {
	test("一致だけ通る", () => {
		expect(checkAdminPassword("pw")).toBe(true);
		expect(checkAdminPassword("pw ")).toBe(false);
		expect(checkAdminPassword("")).toBe(false);
	});
});

describe("visitorHash", () => {
	test("形が変なら null", () => {
		expect(visitorHash(null)).toBeNull();
		expect(visitorHash("short")).toBeNull();
		expect(visitorHash("has space in it!")).toBeNull();
		expect(visitorHash("x".repeat(65))).toBeNull();
	});
	test("同じ入力は同じハッシュ", () => {
		const id = "9a0f0d8e-0000-4000-8000-000000000000";
		expect(visitorHash(id)).toBe(visitorHash(id));
		expect(visitorHash(id)).not.toBe(id);
	});
});
