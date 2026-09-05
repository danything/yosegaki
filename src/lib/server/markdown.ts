import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { env } from "./env";

const marked = new Marked({ gfm: true, breaks: true });

const allowedTags = [
	"p",
	"br",
	"a",
	"em",
	"strong",
	"del",
	"code",
	"pre",
	"blockquote",
	"ul",
	"ol",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"table",
	"thead",
	"tbody",
	"tr",
	"th",
	"td",
	"input",
];

const sanitizeOptions: sanitizeHtml.IOptions = {
	allowedTags: env.allowImages ? [...allowedTags, "img"] : allowedTags,
	allowedAttributes: {
		// rel と target は transformTags で必ず上書きする
		a: ["href", "title", "rel", "target"],
		code: ["class"],
		th: ["align"],
		td: ["align"],
		img: ["src", "alt", "title"],
		// GFM のタスクリスト。チェック済みかどうかだけ残す
		input: ["type", "checked", "disabled"],
	},
	allowedSchemes: ["http", "https", "mailto"],
	allowedClasses: {
		code: ["language-*"],
	},
	transformTags: {
		a: (tagName, attribs) => ({
			tagName,
			attribs: { ...attribs, rel: "nofollow noopener ugc", target: "_blank" },
		}),
		input: (tagName, attribs) =>
			attribs.type === "checkbox"
				? { tagName, attribs: { ...attribs, disabled: "" } }
				: { tagName: "span", attribs: {} },
	},
};

/** Markdown を、埋め込み先に安全に差せる HTML にする */
export function render(md: string): string {
	const html = marked.parse(md, { async: false }) as string;
	return sanitizeHtml(html, sanitizeOptions).trim();
}

/** 承認待ちの判定に使う。自動リンクも含めて数える */
export function countLinks(html: string): number {
	return (html.match(/<a\s/g) ?? []).length;
}
