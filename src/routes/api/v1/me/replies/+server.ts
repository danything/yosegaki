import { repliesToMe } from "$lib/server/comments";
import { api, intParam } from "$lib/server/http";

/** 自分のコメントへの返信 (新しい順) */
export const GET = api((event) => {
	const before = event.url.searchParams.get("before");
	const list = repliesToMe({
		before: before ? intParam(before, 0, 1, Number.MAX_SAFE_INTEGER) : null,
		limit: intParam(event.url.searchParams.get("limit"), 20, 1, 100),
		viewer: { visitor: event.locals.visitor, admin: event.locals.admin },
	});
	return {
		comments: list,
		next_before: list.length ? list[list.length - 1].id : null,
	};
});
