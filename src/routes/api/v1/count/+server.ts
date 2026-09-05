import { counts } from "$lib/server/comments";
import { ApiError, api } from "$lib/server/http";

/** ?page=a&page=b または ?pages=a,b。承認済みの件数だけ返す */
export const GET = api((event) => {
	const keys = new Set<string>();
	for (const p of event.url.searchParams.getAll("page")) if (p) keys.add(p);
	for (const p of (event.url.searchParams.get("pages") ?? "").split(","))
		if (p) keys.add(p);
	if (keys.size === 0)
		throw new ApiError(400, "bad_request", "page を指定する");
	if (keys.size > 100)
		throw new ApiError(400, "bad_request", "page は 100 件まで");
	return counts([...keys]);
});
