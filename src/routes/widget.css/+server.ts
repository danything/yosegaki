import { asset } from "#lib/server/asset.js";
import css from "../../widget/widget.css?raw";

// 同梱 CSS を data-css="false" で切って、代わりに <link> で読みたい人向け
const serve = asset(css, "text/css; charset=utf-8", "entry");

export const GET = ({ request }) => serve(request);
