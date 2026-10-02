import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			// どのサイトからの書き込みを通すかは hooks.server.ts が実行時の
			// ALLOWED_ORIGINS で決める (埋め込みウィジェットは別オリジンから書く)。
			// kit 3 は Content-Type の無い DELETE なども判定に掛けるので、kit の判定は外す
			csrf: { trustedOrigins: ["*"] },
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
