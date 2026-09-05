import { type Status, search } from "$lib/server/comments";
import { ApiError, api, intParam, requireAdmin } from "$lib/server/http";

const STATUSES: Status[] = ["approved", "pending", "deleted"];

/** 全記事横断の検索。?q=&status=&before= */
export const GET = api((event) => {
	requireAdmin(event);
	const status = event.url.searchParams.get("status");
	if (status && !STATUSES.includes(status as Status)) {
		throw new ApiError(400, "bad_request", "status が不正");
	}
	const before = event.url.searchParams.get("before");
	const list = search(
		(event.url.searchParams.get("q") ?? "").trim().slice(0, 200),
		(status as Status) || null,
		{
			before: before ? intParam(before, 0, 1, Number.MAX_SAFE_INTEGER) : null,
			limit: intParam(event.url.searchParams.get("limit"), 20, 1, 100),
			viewer: { visitor: event.locals.visitor, admin: true },
		},
	);
	return {
		comments: list,
		next_before: list.length ? list[list.length - 1].id : null,
	};
});
