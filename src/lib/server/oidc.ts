// 管理者の OIDC ログイン (認可コード + PKCE)。ウィジェットはポップアップで
// /admin/login を開き、/admin/callback が postMessage でトークンを返す。
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { RequestEvent } from "@sveltejs/kit";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { issueAdminToken } from "./auth";
import { env, originAllowed } from "./env";
import { ApiError } from "./http";

export function oidcEnabled(): boolean {
	return (
		env.oidc.issuer !== "" &&
		env.oidc.clientId !== "" &&
		env.oidc.clientSecret !== ""
	);
}

interface Discovery {
	authorization_endpoint: string;
	token_endpoint: string;
	jwks_uri: string;
	issuer: string;
}

let discovery: Promise<Discovery> | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function discover(): Promise<Discovery> {
	discovery ??= fetch(`${env.oidc.issuer}/.well-known/openid-configuration`, {
		signal: AbortSignal.timeout(10_000),
	})
		.then((r) => {
			if (!r.ok) throw new Error(`discovery ${r.status}`);
			return r.json() as Promise<Discovery>;
		})
		.catch((e) => {
			discovery = null;
			throw e;
		});
	return discovery;
}

const COOKIE = "ysg_oidc";

function b64(buf: Buffer): string {
	return buf.toString("base64url");
}

function sign(payload: string): string {
	return createHmac("sha256", env.secret)
		.update(`oidc:${payload}`)
		.digest("base64url");
}

interface Pending {
	state: string;
	nonce: string;
	verifier: string;
	origin: string;
	exp: number;
}

/** state などは署名付き Cookie に入れる。サーバに状態を持たない */
function setPending(event: RequestEvent, p: Pending): void {
	const payload = b64(Buffer.from(JSON.stringify(p)));
	event.cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
		path: "/admin",
		httpOnly: true,
		sameSite: "lax",
		secure: event.url.protocol === "https:",
		maxAge: 600,
	});
}

function takePending(event: RequestEvent): Pending | null {
	const raw = event.cookies.get(COOKIE);
	event.cookies.delete(COOKIE, { path: "/admin" });
	if (!raw) return null;
	const dot = raw.indexOf(".");
	if (dot < 0) return null;
	const payload = raw.slice(0, dot);
	const sig = Buffer.from(raw.slice(dot + 1));
	const expect = Buffer.from(sign(payload));
	if (sig.length !== expect.length || !timingSafeEqual(sig, expect))
		return null;
	try {
		const p = JSON.parse(
			Buffer.from(payload, "base64url").toString(),
		) as Pending;
		return p.exp > Date.now() ? p : null;
	} catch {
		return null;
	}
}

/** ウィジェットのあるオリジンへ戻す。許可していないオリジンには返さない */
export async function loginUrl(event: RequestEvent): Promise<string> {
	if (!oidcEnabled()) throw new ApiError(404, "not_found", "OIDC は無効");
	const origin = event.url.searchParams.get("origin") ?? "";
	if (origin !== event.url.origin && !originAllowed(origin)) {
		throw new ApiError(400, "bad_request", "origin が許可されていない");
	}
	const d = await discover();
	const verifier = b64(randomBytes(32));
	const challenge = b64(
		Buffer.from(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
		),
	);
	const p: Pending = {
		state: b64(randomBytes(16)),
		nonce: b64(randomBytes(16)),
		verifier,
		origin,
		exp: Date.now() + 600_000,
	};
	setPending(event, p);
	const q = new URLSearchParams({
		response_type: "code",
		client_id: env.oidc.clientId,
		redirect_uri: `${event.url.origin}/admin/callback`,
		scope: "openid profile email",
		state: p.state,
		nonce: p.nonce,
		code_challenge: challenge,
		code_challenge_method: "S256",
	});
	return `${d.authorization_endpoint}?${q}`;
}

export interface LoginResult {
	token: string;
	expires_at: string;
	name: string;
	origin: string;
}

function strings(v: unknown): string[] {
	if (typeof v === "string") return [v];
	return Array.isArray(v)
		? v.filter((x): x is string => typeof x === "string")
		: [];
}

/** groups / roles クレームに管理者グループが入っているか、本人が名指しされているか */
export function allowed(
	claims: Record<string, unknown>,
	rules: {
		adminGroups: readonly string[];
		admins: readonly string[];
	} = env.oidc,
): boolean {
	const lower = (v: string) => v.toLowerCase();
	const groups = [...strings(claims.groups), ...strings(claims.roles)].map(
		lower,
	);
	if (rules.adminGroups.some((g) => groups.includes(lower(g)))) return true;
	const ids = [claims.email, claims.preferred_username, claims.sub]
		.filter((v): v is string => typeof v === "string")
		.map(lower);
	return rules.admins.some((a) => ids.includes(lower(a)));
}

export async function handleCallback(
	event: RequestEvent,
): Promise<LoginResult> {
	if (!oidcEnabled()) throw new ApiError(404, "not_found", "OIDC は無効");
	const pending = takePending(event);
	const code = event.url.searchParams.get("code");
	const state = event.url.searchParams.get("state");
	const err = event.url.searchParams.get("error");
	if (err)
		throw new ApiError(
			401,
			"unauthorized",
			event.url.searchParams.get("error_description") ?? err,
		);
	if (!pending || !code || !state || state !== pending.state) {
		throw new ApiError(
			400,
			"bad_request",
			"ログインの続きではない。もう一度やり直す",
		);
	}

	const d = await discover();
	const res = await fetch(d.token_endpoint, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: `${event.url.origin}/admin/callback`,
			client_id: env.oidc.clientId,
			client_secret: env.oidc.clientSecret,
			code_verifier: pending.verifier,
		}),
		signal: AbortSignal.timeout(10_000),
	});
	const tokens = (await res.json()) as {
		id_token?: string;
		error_description?: string;
	};
	if (!res.ok || !tokens.id_token) {
		throw new ApiError(
			401,
			"unauthorized",
			tokens.error_description ?? "トークンを取れなかった",
		);
	}

	jwks ??= createRemoteJWKSet(new URL(d.jwks_uri));
	const { payload } = await jwtVerify(tokens.id_token, jwks, {
		issuer: d.issuer,
		audience: env.oidc.clientId,
	});
	if (payload.nonce !== pending.nonce)
		throw new ApiError(401, "unauthorized", "nonce が一致しない");
	if (!allowed(payload)) {
		throw new ApiError(403, "forbidden", "このアカウントは管理者ではない");
	}
	return {
		...issueAdminToken(),
		name: env.adminName,
		origin: pending.origin,
	};
}
