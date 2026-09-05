// 埋め込みスクリプトのビルド。SvelteKit とは別に、素の Svelte コンポーネントを
// IIFE 1 本にまとめて widget-dist/embed.js に出す (src の外: svelte-check に
// 生成物を読ませないため)。CSS は widget.css を
// 文字列で抱え込み、実行時に <style> として差す (data-css="false" で差さない)。
// 配るのは static/ ではなく routes/embed.js: static だと adapter-node が hooks の
// 手前で返してしまい、Cache-Control も ETag も付けられない。
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
	plugins: [
		svelte({
			configFile: false,
			emitCss: false,
			compilerOptions: { css: "injected" },
		}),
	],
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
		__VERSION__: JSON.stringify(pkg.version),
	},
	build: {
		lib: {
			entry: "src/widget/main.ts",
			name: "Yosegaki",
			formats: ["iife"],
			fileName: () => "embed.js",
		},
		outDir: "widget-dist",
		emptyOutDir: false,
		target: "es2022",
		minify: true,
	},
});
