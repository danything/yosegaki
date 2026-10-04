import { error } from "@sveltejs/kit";
import { asset } from "#lib/server/asset.js";

// embed.js が import() で読む本体とチャンク。ビルド時に全部抱え込む
// (イメージには build/ しか入らない)
const files = import.meta.glob<string>("../../../../widget-dist/embed/*.js", {
	query: "?raw",
	import: "default",
	eager: true,
});

const handlers = new Map(
	Object.entries(files).map(([path, js]) => {
		const name = path.slice(path.lastIndexOf("/") + 1);
		// embed/app.js だけはハッシュの無い別名 (古い embed.js の逃げ道) なので短く持たせる
		const policy = name === "app.js" ? "entry" : "immutable";
		return [name, asset(js, "text/javascript; charset=utf-8", policy)];
	}),
);

export const GET = ({ params, request }) => {
	const serve = handlers.get(params.file);
	if (!serve) error(404, "not found");
	return serve(request);
};
