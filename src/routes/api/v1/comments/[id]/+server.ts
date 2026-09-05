import {
	deleteComment,
	getComment,
	toPublic,
	updateComment,
} from "$lib/server/comments";
import { env } from "$lib/server/env";
import { ApiError, api, body, idParam, json, str } from "$lib/server/http";
import { render } from "$lib/server/markdown";

function viewerOf(event: { locals: App.Locals }) {
	return { visitor: event.locals.visitor, admin: event.locals.admin };
}

/** 本人 (期限内) か管理者だけが触れる */
function editable(event: { locals: App.Locals }, id: number) {
	const viewer = viewerOf(event);
	const row = getComment(id, viewer);
	if (!row) throw new ApiError(404, "not_found", "見つからない");
	if (!toPublic(row, viewer).can_edit) {
		throw new ApiError(403, "forbidden", "このコメントは編集できない");
	}
	return { row, viewer };
}

export const GET = api((event) => {
	const viewer = viewerOf(event);
	const row = getComment(idParam(event.params.id ?? ""), viewer);
	if (!row) throw new ApiError(404, "not_found", "見つからない");
	const pub = toPublic(row, viewer);
	if (row.status === "pending" && !pub.is_mine && !viewer.admin) {
		throw new ApiError(404, "not_found", "見つからない");
	}
	return { comment: pub };
});

export const PATCH = api(async (event) => {
	const id = idParam(event.params.id ?? "");
	const { viewer } = editable(event, id);
	const data = await body<{
		body?: string;
		name?: string;
		website?: string | null;
	}>(event);
	const bodyMd = str(data.body, env.maxLength, "body", true);
	const bodyHtml = render(bodyMd);
	if (!bodyHtml) throw new ApiError(400, "bad_request", "body が空");
	const patch: Parameters<typeof updateComment>[1] = { bodyMd, bodyHtml };
	if (data.name !== undefined) patch.name = str(data.name, 50, "name", true);
	if (data.website !== undefined) {
		const website = str(data.website, 200, "website");
		if (website && !/^https?:\/\/\S+$/.test(website)) {
			throw new ApiError(400, "bad_request", "website は http(s) の URL");
		}
		patch.website = website || null;
	}
	return { comment: toPublic(updateComment(id, patch, viewer), viewer) };
});

export const DELETE = api((event) => {
	const id = idParam(event.params.id ?? "");
	editable(event, id);
	return json({ id, ...deleteComment(id) });
});
