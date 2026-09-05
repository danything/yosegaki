import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function sha256(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

/** X-Visitor ヘッダの値をそのまま保存しないためのハッシュ */
export function visitorHash(visitor: string | null): string | null {
	if (!visitor) return null;
	// 値はウィジェットが作った乱数なので、形だけ確かめる
	if (visitor.length < 8 || visitor.length > 64 || !/^[\w-]+$/.test(visitor))
		return null;
	return sha256(`visitor:${visitor}`);
}

export function ipHash(ip: string): string {
	return sha256(`${env.secret}:ip:${ip}`);
}

export function emailHash(email: string): string {
	return sha256(email.trim().toLowerCase());
}

function sign(payload: string): string {
	return createHmac("sha256", env.secret).update(payload).digest("base64url");
}

/** 管理者トークン。<有効期限>.<署名>。状態を持たないので DB は要らない */
export function issueAdminToken(): { token: string; expires_at: string } {
	const exp = Date.now() + env.adminTokenDays * 86400_000;
	const payload = String(exp);
	return {
		token: `${payload}.${sign(`admin:${payload}`)}`,
		expires_at: new Date(exp).toISOString(),
	};
}

export function verifyAdminToken(token: string | null): boolean {
	if (!token) return false;
	const dot = token.indexOf(".");
	if (dot < 0) return false;
	const payload = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	if (!/^\d+$/.test(payload) || Number(payload) < Date.now()) return false;
	return safeEqual(sig, sign(`admin:${payload}`));
}
