// 埋め込みスクリプトのビルド。SvelteKit とは別に、素の Svelte コンポーネントを
// widget-dist/ に出す (src の外: svelte-check に生成物を読ませないため)。出すものは 2 種類。
//
// - embed/*.js: 本体 (app.ts) と、通知パネル・Turnstile などの後から読むチャンク。
//   ES モジュールで、ファイル名にハッシュが入るので immutable で配れる
// - embed.js: <script> で貼る入口 (main.ts)。currentScript と data-* を読むために
//   クラシックスクリプト (IIFE) のまま、本体とその依存のハッシュ付きファイル名を埋め込む。
//   本体のビルドが書き終わったところで、もう一度 vite を回して作る
//
// CSS は widget.css を文字列で本体に抱え込み、実行時に <style> として差す
// (data-css="false" で差さない)。
// 配るのは static/ ではなく routes/embed.js と routes/embed/[file]: static だと
// adapter-node が hooks の手前で返してしまい、Cache-Control も ETag も付けられない。
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { build, defineConfig, type Plugin } from "vite";
import pkg from "./package.json" with { type: "json" };

const outDir = "widget-dist";
// 素の Svelte 5 が動くもの (ES2022 + 動的 import) より古いものは相手にしない
const target = "es2022";
const define = {
	"process.env.NODE_ENV": JSON.stringify("production"),
	__VERSION__: JSON.stringify(pkg.version),
};

function entry(): Plugin {
	let app = "";
	let deps: string[] = [];
	return {
		name: "yosegaki-embed-entry",
		generateBundle(_, bundle) {
			const chunks = new Map<string, string[]>();
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== "chunk") continue;
				chunks.set(chunk.fileName, chunk.imports);
				if (chunk.isEntry) app = chunk.fileName;
			}
			if (!app) this.error("本体のチャンクが見つからない");
			// 本体が静的に import するチャンク (通知パネルと共有する Svelte のランタイムなど)。
			// 本体を読んでから見つけるのでは 1 往復遅れるので、入口から同時に取りに行かせる
			const seen = new Set<string>();
			const walk = (f: string) => {
				for (const d of chunks.get(f) ?? []) {
					if (seen.has(d)) continue;
					seen.add(d);
					walk(d);
				}
			};
			walk(app);
			deps = [...seen];
			// 古い embed.js がキャッシュに残ったまま本体だけ入れ替わったときの逃げ道。
			// 中身をコピーすると同じモジュールが 2 つ読まれ得るので、再輸出だけにする
			this.emitFile({
				type: "asset",
				fileName: "embed/app.js",
				source: `export*from"./${app.slice("embed/".length)}";\n`,
			});
		},
		async writeBundle() {
			await build({
				configFile: false,
				logLevel: "warn",
				define: {
					...define,
					__APP__: JSON.stringify(app),
					__APP_DEPS__: JSON.stringify(deps),
				},
				build: {
					lib: {
						entry: "src/widget/main.ts",
						name: "Yosegaki",
						formats: ["iife"],
						fileName: () => "embed.js",
					},
					outDir,
					emptyOutDir: false,
					target,
					minify: true,
				},
			});
		},
	};
}

export default defineConfig({
	plugins: [
		svelte({
			configFile: false,
			emitCss: false,
			compilerOptions: { css: "injected", discloseVersion: false },
		}),
		entry(),
	],
	define,
	build: {
		outDir,
		// 前のビルドのハッシュ付きチャンクを残すと、サーバがそれも抱え込んでしまう
		emptyOutDir: true,
		target,
		minify: true,
		// 後から読むチャンクは import() でそのまま取る。先読みの補助コードは要らない
		modulePreload: false,
		rollupOptions: {
			input: { app: "src/widget/app.ts" },
			preserveEntrySignatures: "exports-only",
			output: {
				format: "es",
				entryFileNames: "embed/[name]-[hash].js",
				chunkFileNames: "embed/[name]-[hash].js",
				assetFileNames: "embed/[name]-[hash][extname]",
			},
		},
	},
});
