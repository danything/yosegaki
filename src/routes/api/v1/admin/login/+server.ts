import { checkAdminPassword, ipHash, issueAdminToken } from "$lib/server/auth";
import { env } from "$lib/server/env";
import { ApiError, api, body, str } from "$lib/server/http";
import { loginAllowed } from "$lib/server/spam";

export const POST = api(async (event) => {
	if (!env.adminPassword) throw new ApiError(404, "not_found", "管理者は無効");
	if (!loginAllowed(ipHash(event.locals.ip))) {
		throw new ApiError(429, "rate_limited", "試行が多すぎる。しばらく待つ");
	}
	const data = await body<{ password?: string }>(event);
	if (!checkAdminPassword(str(data.password, 200, "password", true))) {
		throw new ApiError(401, "unauthorized", "パスワードが違う");
	}
	return { ...issueAdminToken(), name: env.adminName };
});
