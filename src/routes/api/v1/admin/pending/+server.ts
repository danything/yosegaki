import { pending } from "$lib/server/comments";
import { api, intParam, requireAdmin } from "$lib/server/http";

export const GET = api((event) => {
	requireAdmin(event);
	const before = event.url.searchParams.get("before");
	const list = pending({
		before: before ? intParam(before, 0, 1, Number.MAX_SAFE_INTEGER) : null,
		limit: intParam(event.url.searchParams.get("limit"), 20, 1, 100),
		viewer: { visitor: event.locals.visitor, admin: true },
	});
	return {
		comments: list,
		next_before: list.length ? list[list.length - 1].id : null,
	};
});
