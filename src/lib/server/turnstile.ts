import { env } from "./env";
import { ApiError } from "./http";

export function turnstileEnabled(): boolean {
	return env.turnstile.siteKey !== "" && env.turnstile.secret !== "";
}

/** Cloudflare にトークンを照会する。通らなければ 403 */
export async function verifyTurnstile(
	token: unknown,
	ip: string,
): Promise<void> {
	if (typeof token !== "string" || !token || token.length > 2048) {
		throw new ApiError(403, "turnstile_required", "人間であることの確認が必要");
	}
	const form = new URLSearchParams({
		secret: env.turnstile.secret,
		response: token,
	});
	if (ip) form.set("remoteip", ip);
	let ok = false;
	try {
		const res = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				body: form,
				signal: AbortSignal.timeout(10_000),
			},
		);
		const data = (await res.json()) as {
			success?: boolean;
			"error-codes"?: string[];
		};
		ok = data.success === true;
		if (!ok) console.warn("turnstile rejected", data["error-codes"]);
	} catch (e) {
		console.error("turnstile verify failed", e);
	}
	if (!ok)
		throw new ApiError(403, "turnstile_failed", "確認に失敗した。もう一度送る");
}
