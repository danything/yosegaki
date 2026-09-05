import { version } from "$app/environment";
import { env } from "$lib/server/env";
import { api } from "$lib/server/http";
import { oidcEnabled } from "$lib/server/oidc";

/** ウィジェットが最初に読む公開設定 */
export const GET = api(() => ({
	site_name: env.siteName,
	admin_enabled: oidcEnabled(),
	/** 空でなければ OIDC のログインボタンを出す */
	oidc_label: oidcEnabled() ? env.oidc.label : "",
	admin_name: env.adminName,
	moderation: env.moderation,
	max_length: env.maxLength,
	owner_edit_minutes: env.ownerEditMinutes,
	avatar: env.avatar,
	allow_images: env.allowImages,
	notify_by_email: env.smtp.host !== "",
	turnstile_site_key: env.turnstile.secret ? env.turnstile.siteKey : "",
	version,
}));
