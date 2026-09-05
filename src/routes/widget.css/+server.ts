import { asset } from "$lib/server/asset";
import css from "../../widget/widget.css?raw";

// 同梱 CSS を data-css="false" で切って、代わりに <link> で読みたい人向け
export const GET = asset(css, "text/css; charset=utf-8");
