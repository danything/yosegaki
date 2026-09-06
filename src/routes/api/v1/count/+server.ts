import { counts } from "$lib/server/comments";
import { ApiError, api, pageKey } from "$lib/server/http";

/** ?page=a&page=b または ?pages=a,b。承認済みの件数だけ返す */
export const GET = api((event) => {
	const raw = [
		...event.url.searchParams.getAll("page"),
		...(event.url.searchParams.get("pages") ?? "").split(","),
	].filter(Boolean);
	if (raw.length === 0)
		throw new ApiError(400, "bad_request", "page を指定する");
	if (raw.length > 100)
		throw new ApiError(400, "bad_request", "page は 100 件まで");
	const keys = new Set(raw.map((p) => pageKey(p, event.url.origin)));
	return counts([...keys]);
});
