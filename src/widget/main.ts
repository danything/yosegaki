// embed.js。<script> で読ませる小さな入口で、Svelte も描画も持たない。
// init されたら本体 (app.ts とその先のチャンク) を import() で取りに行く。
// 本体はファイル名にハッシュが入っていて immutable で配るので、2 回目からは
// この入口の再検証だけで済む。
import type { Lang } from "./i18n";
import type { Store } from "./store.svelte";
import type { Sort } from "./types";

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
	/** この hash を付けて開いたときだけ管理者ログインを出す。既定 #yosegaki-admin */
	adminHash?: string;
	/**
	 * true (既定) なら描画先が画面に近づくまで本体を読まない。
	 * #ysg-<id> や adminHash 付きで開いたときは待たずにすぐ読む
	 */
	lazy?: boolean;
}

export interface Instance {
	/** 本体を読み終えるまでは null */
	readonly store: Store | null;
	/** 本体を読み込んで描画し終えたら (destroy したならその時点で) 解決する */
	ready: Promise<void>;
	destroy(): void;
	reload(): Promise<void>;
}

declare const __VERSION__: string;
/** vite.widget.config.ts が本体のファイル名 (embed/app-<hash>.js) を入れる */
declare const __APP__: string;
/** 本体が静的に import するチャンク。本体と同時に取りに行く */
declare const __APP_DEPS__: string[];
export const version = __VERSION__;

type App = typeof import("./app");

const script = document.currentScript as HTMLScriptElement | null;
const scriptOrigin = script?.src
	? new URL(script.src, location.href).origin
	: location.origin;
// 本体はこのスクリプトと同じ場所から読む (data-server は API の向き先)
const base = script?.src ? new URL(".", script.src).href : `${scriptOrigin}/`;

let loading: Promise<App> | null = null;

function loadApp(): Promise<App> {
	if (loading) return loading;
	// 依存を並べて取りに行くだけ。失敗したら本体の import の方で拾う
	for (const d of __APP_DEPS__)
		import(/* @vite-ignore */ base + d).catch(() => {});
	loading = import(/* @vite-ignore */ base + __APP__)
		// 古い embed.js がキャッシュに残っていて、指している本体がもう無い
		// (デプロイの直後)。今の本体を指す embed/app.js から取り直す
		.catch(() => import(/* @vite-ignore */ `${base}embed/app.js`))
		.catch((e) => {
			// 次の init でやり直せるように
			loading = null;
			throw e;
		});
	return loading;
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

	let mounted: { store: Store; destroy(): void } | null = null;
	let destroyed = false;
	let stop = () => {};
	const adminHash = opts.adminHash ?? "#yosegaki-admin";
	const now =
		opts.lazy === false ||
		typeof IntersectionObserver === "undefined" ||
		location.hash.startsWith("#ysg-") ||
		location.hash === adminHash;
	// コメント欄は記事の下にあるので、たいていは開いた時点では見えていない。
	// 近づいてきたら (手前 600px) 本体を取りに行く
	const visible = now
		? Promise.resolve()
		: new Promise<void>((resolve) => {
				const io = new IntersectionObserver(
					(entries) => {
						if (!entries.some((e) => e.isIntersecting)) return;
						io.disconnect();
						resolve();
					},
					{ rootMargin: "600px 0px" },
				);
				io.observe(target);
				stop = () => {
					io.disconnect();
					resolve();
				};
			});
	const ready = visible.then(async () => {
		if (destroyed) return;
		const app = await loadApp();
		if (destroyed) return;
		mounted = app.start(target, {
			server: (opts.server ?? scriptOrigin).replace(/\/$/, ""),
			page: opts.page ?? location.origin + location.pathname,
			title: opts.title ?? document.title,
			url: opts.url ?? location.origin + location.pathname,
			lang: opts.lang,
			sort: opts.sort,
			limit: opts.limit,
			css: opts.css !== false,
			adminHash,
		});
	});
	ready.catch((e) => console.error("[yosegaki] 読み込みに失敗", e));

	return {
		get store() {
			return mounted?.store ?? null;
		},
		ready,
		destroy() {
			destroyed = true;
			stop();
			mounted?.destroy();
			mounted = null;
		},
		async reload() {
			await ready;
			await mounted?.store.load(true);
		},
	};
}

/** 複数ページの件数だけ欲しいとき (一覧ページ用)。本体は読まない */
export async function counts(
	pages: string[],
	server = scriptOrigin,
): Promise<Record<string, number>> {
	const q = pages.map((p) => `page=${encodeURIComponent(p)}`).join("&");
	const res = await fetch(`${server.replace(/\/$/, "")}/api/v1/count?${q}`);
	if (!res.ok) throw new Error(`count failed: ${res.status}`);
	// サーバはクエリと hash を落とした鍵で返す。渡した文字列のまま引けるように戻す
	const found = (await res.json()) as Record<string, number>;
	const out: Record<string, number> = {};
	for (const p of pages) out[p] = found[canonical(p)] ?? 0;
	return out;
}

function canonical(page: string): string {
	try {
		const url = new URL(page);
		url.search = "";
		url.hash = "";
		return url.href;
	} catch {
		return page;
	}
}

// <script src=".../embed.js" data-page="..." data-lang="en" data-css="false">
// のように data 属性だけで動く。data-auto="false" なら何もしない
if (script && script.dataset.auto !== "false") {
	const d = script.dataset;
	// 遅らせないなら、DOM を待つ間に本体の取得を始めておく
	if (d.lazy === "false") loadApp().catch(() => {});
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
			adminHash: d.adminHash,
			css: d.css !== "false",
			lazy: d.lazy !== "false",
		});
	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", run);
	else run();
}
