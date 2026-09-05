import { version } from "$app/environment";
import { api } from "$lib/server/http";

export const GET = api(() => ({ ok: true, version }));
