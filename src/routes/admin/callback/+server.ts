import type { RequestHandler } from "@sveltejs/kit";
import { ApiError } from "$lib/server/http";
import { handleCallback } from "$lib/server/oidc";

function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function page(body: string, script = ""): Response {
	return new Response(
		`<!doctype html><meta charset="utf-8"><title>yosegaki</title>
<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">${body}</body>
<script>${script}</script>`,
		{
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
			},
		},
	);
}

/** IdP から戻ってくる。開いた元のウィンドウにトークンを渡して閉じる */
export const GET: RequestHandler = async (event) => {
	try {
		const r = await handleCallback(event);
		const msg = JSON.stringify({
			type: "yosegaki:admin",
			token: r.token,
			expires_at: r.expires_at,
			name: r.name,
		});
		return page(
			"<p>ログインしました。このウィンドウは閉じて構いません。</p>",
			`if (window.opener) { window.opener.postMessage(${msg}, ${JSON.stringify(r.origin)}); window.close(); }`,
		);
	} catch (e) {
		const message = e instanceof ApiError ? e.message : "ログインに失敗した";
		if (!(e instanceof ApiError)) console.error("oidc callback", e);
		return page(`<p>${esc(message)}</p>`);
	}
};
