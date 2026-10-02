import { api } from "#lib/server/http.js";
import { version } from "$app/env";

export const GET = api(() => ({ ok: true, version }));
