import { emailHash, ipHash } from "$lib/server/auth";
import {
	getComment,
	getPage,
	insertComment,
	listPage,
	recentByIp,
	type Sort,
	toPublic,
	upsertPage,
} from "$lib/server/comments";
import { env } from "$lib/server/env";
import {
	ApiError,
	api,
	body,
	intParam,
	json,
	pageKey,
	str,
} from "$lib/server/http";
import { render } from "$lib/server/markdown";
import { onCreated } from "$lib/server/notify";
import { decideStatus } from "$lib/server/spam";
import { turnstileEnabled, verifyTurnstile } from "$lib/server/turnstile";

const SORTS: Sort[] = ["newest", "oldest", "popular"];

/** ページのコメント一覧。返信も同じ配列に平らに入る (parent_id / root_id で組む) */
export const GET = api((event) => {
	const page = pageKey(event.url.searchParams.get("page"), event.url.origin);
	const sortRaw = event.url.searchParams.get("sort") ?? "newest";
	if (!SORTS.includes(sortRaw as Sort))
		throw new ApiError(400, "bad_request", "sort が不正");
	const limit = intParam(event.url.searchParams.get("limit"), 50, 1, 200);
	const offset = intParam(
		event.url.searchParams.get("offset"),
		0,
		0,
		1_000_000,
	);
	const viewer = { visitor: event.locals.visitor, admin: event.locals.admin };
	return {
		page: { key: page, ...(pageMeta(page) ?? {}) },
		...listPage({
			pageKey: page,
			sort: sortRaw as Sort,
			limit,
			offset,
			viewer,
		}),
		limit,
		offset,
	};
});

function pageMeta(key: string) {
	const p = getPage(key);
	return p ? { title: p.title, url: p.url } : null;
}

interface PostBody {
	page: string;
	title?: string;
	url?: string;
	parent_id?: number | null;
	name: string;
	email?: string;
	website?: string;
	body: string;
	notify?: boolean;
	/** ハニーポット。人間には見えないので埋まっていたら bot */
	hp?: string;
	/** Cloudflare Turnstile のトークン */
	turnstile?: string;
}

export const POST = api(async (event) => {
	const data = await body<PostBody>(event);
	const viewer = { visitor: event.locals.visitor, admin: event.locals.admin };

	if (typeof data.hp === "string" && data.hp !== "") {
		// 保存もせず、bot には成功したように見せる
		return json({ ok: true }, 202);
	}

	const page = pageKey(data.page, event.url.origin);
	const title = str(data.title, 300, "title");
	const url = str(data.url, 2000, "url");
	const name = str(data.name, 50, "name", true);
	const email = str(data.email, 254, "email");
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new ApiError(400, "bad_request", "email の形式が不正");
	}
	const website = str(data.website, 200, "website");
	if (website && !/^https?:\/\/\S+$/.test(website)) {
		throw new ApiError(400, "bad_request", "website は http(s) の URL");
	}
	const bodyMd = str(data.body, env.maxLength, "body", true);

	let parentId: number | null = null;
	let rootId: number | null = null;
	if (data.parent_id !== undefined && data.parent_id !== null) {
		if (!Number.isInteger(data.parent_id))
			throw new ApiError(400, "bad_request", "parent_id が不正");
		const parent = getComment(Number(data.parent_id), viewer);
		if (!parent || parent.page_key !== page || parent.status !== "approved") {
			throw new ApiError(400, "bad_request", "返信先が存在しない");
		}
		parentId = parent.id;
		rootId = parent.root_id ?? parent.id;
	}

	const ip = ipHash(event.locals.ip);
	if (
		!viewer.admin &&
		recentByIp(ip, env.rateLimitWindow) >= env.rateLimitMax
	) {
		throw new ApiError(429, "rate_limited", "投稿が多すぎる。しばらく待つ");
	}
	// 入力の検証を全部通ってから照会する。トークンは一度しか使えない
	if (!viewer.admin && turnstileEnabled()) {
		await verifyTurnstile(data.turnstile, event.locals.ip);
	}

	const bodyHtml = render(bodyMd);
	if (!bodyHtml) throw new ApiError(400, "bad_request", "body が空");
	const status = decideStatus({ bodyMd, bodyHtml, admin: viewer.admin });

	upsertPage(page, title, url);
	const row = insertComment(
		{
			pageKey: page,
			parentId,
			rootId,
			name,
			email: email || (viewer.admin ? env.adminEmail || null : null),
			emailHash: email
				? emailHash(email)
				: viewer.admin && env.adminEmail
					? emailHash(env.adminEmail)
					: null,
			website: website || null,
			bodyMd,
			bodyHtml,
			status,
			visitorHash: viewer.visitor,
			ipHash: ip,
			userAgent: event.request.headers.get("user-agent")?.slice(0, 300) ?? null,
			isAdmin: viewer.admin,
			notify: data.notify === true && email !== "",
		},
		viewer,
	);
	onCreated(row);
	return json({ comment: toPublic(row, viewer) }, 201);
});
