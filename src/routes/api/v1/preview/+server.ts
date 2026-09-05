import { env } from "$lib/server/env";
import { api, body, str } from "$lib/server/http";
import { render } from "$lib/server/markdown";

export const POST = api(async (event) => {
	const data = await body<{ body?: string }>(event);
	return { body_html: render(str(data.body, env.maxLength, "body")) };
});
