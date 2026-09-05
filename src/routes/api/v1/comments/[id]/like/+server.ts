import { getComment, setLike } from "$lib/server/comments";
import { ApiError, api, body, idParam } from "$lib/server/http";

/** {value: true|false}。同じ値を何度送っても結果は同じ */
export const PUT = api(async (event) => {
	const visitor = event.locals.visitor;
	if (!visitor) throw new ApiError(400, "bad_request", "X-Visitor が必要");
	const id = idParam(event.params.id ?? "");
	const row = getComment(id, { visitor, admin: event.locals.admin });
	if (row?.status !== "approved")
		throw new ApiError(404, "not_found", "見つからない");
	const data = await body<{ value?: boolean }>(event);
	return setLike(id, visitor, data.value !== false);
});
