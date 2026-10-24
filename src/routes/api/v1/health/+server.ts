import { version } from "$app/env";

import { api } from "#lib/server/http.js";

export const GET = api(() => ({ ok: true, version }));
