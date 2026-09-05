import { mount, unmount } from "svelte";
import { detectLang, type Lang } from "./i18n";
import { Store } from "./store.svelte";
import type { Sort } from "./types";
import Widget from "./Widget.svelte";
import css from "./widget.css?inline";

export interface InitOptions {
	/** 描画先。既定は #yosegaki */
	target?: string | Element;
	/** API サーバ。既定はこのスクリプトを配っているオリジン */
	server?: string;
	/** スレッドの鍵。既定は location.origin + location.pathname */
	page?: string;
	title?: string;
	url?: string;
	lang?: Lang;
	sort?: Sort;
	limit?: number;
	/** false なら同梱の CSS を差さない */
	css?: boolean;
}

export interface Instance {
	store: Store;
	destroy(): void;
	reload(): Promise<void>;
}

declare const __VERSION__: string;
export const version = __VERSION__;

const script = document.currentScript as HTMLScriptElement | null;
const scriptOrigin = script?.src
	? new URL(script.src, location.href).origin
	: location.origin;

function injectCss(): void {
	if (document.getElementById("yosegaki-style")) return;
	const style = document.createElement("style");
	style.id = "yosegaki-style";
	style.textContent = css;
	document.head.appendChild(style);
}

export function init(opts: InitOptions = {}): Instance | null {
	const target =
		typeof opts.target === "string" || opts.target === undefined
			? document.querySelector(opts.target ?? "#yosegaki")
			: opts.target;
	if (!target) {
		console.warn("[yosegaki] 描画先が見つからない", opts.target ?? "#yosegaki");
		return null;
	}
	if (opts.css !== false) injectCss();
	target.innerHTML = "";

	const store = new Store({
		server: (opts.server ?? scriptOrigin).replace(/\/$/, ""),
		page: opts.page ?? location.origin + location.pathname,
		title: opts.title ?? document.title,
		url: opts.url ?? location.origin + location.pathname,
		lang: detectLang(opts.lang),
		sort: opts.sort,
		limit: opts.limit,
	});
	const app = mount(Widget, { target, props: { store } });
	return {
		store,
		destroy: () => unmount(app),
		reload: () => store.load(true),
	};
}

/** 複数ページの件数だけ欲しいとき (一覧ページ用) */
export async function counts(
	pages: string[],
	server = scriptOrigin,
): Promise<Record<string, number>> {
	const q = pages.map((p) => `page=${encodeURIComponent(p)}`).join("&");
	const res = await fetch(`${server.replace(/\/$/, "")}/api/v1/count?${q}`);
	if (!res.ok) throw new Error(`count failed: ${res.status}`);
	return res.json();
}

// <script src=".../embed.js" data-page="..." data-lang="en" data-css="false">
// のように data 属性だけで動く。data-auto="false" なら何もしない
if (script && script.dataset.auto !== "false") {
	const d = script.dataset;
	const run = () =>
		init({
			target: d.target,
			server: d.server,
			page: d.page,
			title: d.title,
			url: d.url,
			lang: d.lang as Lang | undefined,
			sort: d.sort as Sort | undefined,
			limit: d.limit ? Number(d.limit) : undefined,
			css: d.css !== "false",
		});
	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", run);
	else run();
}
