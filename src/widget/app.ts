// 埋め込みの本体。embed.js (main.ts) が init のときに import() で読む。
// Svelte のランタイムと描画はここから先にだけあり、通知パネルと Turnstile は
// さらに使うときに別チャンクで読む。
import { mount, unmount } from "svelte";
import { detectLang, type Lang } from "./i18n";
import { Store } from "./store.svelte";
import type { Sort } from "./types";
import Widget from "./Widget.svelte";
import css from "./widget.css?inline";

/** main.ts が解決し終えた設定。server は末尾の / を落としてある */
export interface MountOptions {
	server: string;
	page: string;
	title: string;
	url: string;
	lang?: Lang;
	sort?: Sort;
	limit?: number;
	css: boolean;
	adminHash?: string;
}

function injectCss(): void {
	if (document.getElementById("yosegaki-style")) return;
	const style = document.createElement("style");
	style.id = "yosegaki-style";
	style.textContent = css;
	document.head.appendChild(style);
}

export function start(
	target: Element,
	opts: MountOptions,
): { store: Store; destroy(): void } {
	if (opts.css) injectCss();
	target.innerHTML = "";
	const store = new Store({
		server: opts.server,
		page: opts.page,
		title: opts.title,
		url: opts.url,
		lang: detectLang(opts.lang),
		sort: opts.sort,
		limit: opts.limit,
		adminHash: opts.adminHash,
	});
	const app = mount(Widget, { target, props: { store } });
	return { store, destroy: () => unmount(app) };
}
