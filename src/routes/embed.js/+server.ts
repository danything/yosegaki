import { asset } from "#lib/server/asset.js";
import js from "../../../widget-dist/embed.js?raw";

// 貼られる入口。本体のハッシュ付きファイル名を抱えているので短めに持たせる
const serve = asset(js, "text/javascript; charset=utf-8", "entry");

export const GET = ({ request }) => serve(request);
