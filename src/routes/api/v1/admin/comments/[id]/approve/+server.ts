import { approveComment, getComment, toPublic } from "#lib/server/comments.js";
import { ApiError, api, idParam, requireAdmin } from "#lib/server/http.js";
import { onApproved } from "#lib/server/notify.js";

export const POST = api((event) => {
	requireAdmin(event);
	const id = idParam(event.params.id ?? "");
	const viewer = { visitor: event.locals.visitor, admin: true };
	const before = getComment(id, viewer);
	if (!before) throw new ApiError(404, "not_found", "見つからない");
	const row = approveComment(id, viewer);
	if (before.status === "pending") onApproved(row);
	return { comment: toPublic(row, viewer) };
});
