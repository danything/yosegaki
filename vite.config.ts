import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			version: {
				name: process.env.APP_VERSION || undefined,
			},
		}),
	],
	server: {
		host: true,
	},
	ssr: {
		external: ["bun:sqlite"],
	},
	optimizeDeps: {
		exclude: ["bun:sqlite"],
	},
});
