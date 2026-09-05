import { type RequestHandler, redirect } from "@sveltejs/kit";
import { ApiError, json } from "$lib/server/http";
import { loginUrl } from "$lib/server/oidc";

/** ?origin=<ウィジェットのオリジン>。IdP へ飛ばす */
export const GET: RequestHandler = async (event) => {
	let url: string;
	try {
		url = await loginUrl(event);
	} catch (e) {
		if (e instanceof ApiError)
			return json({ error: e.code, message: e.message }, e.status);
		console.error("oidc login", e);
		return json({ error: "internal", message: "internal server error" }, 500);
	}
	redirect(302, url);
};
