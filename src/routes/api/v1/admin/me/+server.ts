import { env } from "$lib/server/env";
import { api } from "$lib/server/http";

/** トークンがまだ有効か確かめる */
export const GET = api((event) => ({
	admin: event.locals.admin,
	name: event.locals.admin ? env.adminName : null,
}));
