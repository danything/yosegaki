import { asset } from "$lib/server/asset";
import js from "../../../widget-dist/embed.js?raw";

export const GET = asset(js, "text/javascript; charset=utf-8");
