// 埋め込みスクリプト (static/embed.js) のビルド。SvelteKit とは別に、素の
// Svelte コンポーネントを IIFE 1 本にまとめる。CSS は widget.css を文字列で
// 抱え込み、実行時に <style> として差す (data-css="false" で差さない)。
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
		outDir: "static",
		emptyOutDir: false,
		target: "es2022",
		minify: true,
	},
});
