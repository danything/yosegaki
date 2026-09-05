<script lang="ts">
import { onMount } from "svelte";
import { page } from "$app/state";

// 動作確認用のページ。埋め込みの書き方そのもの
let dark = $state(false);
onMount(() => {
	dark = matchMedia("(prefers-color-scheme: dark)").matches;
	const s = document.createElement("script");
	s.src = "/embed.js";
	s.dataset.page = `${page.url.origin}/demo`;
	s.dataset.title = "yosegaki demo";
	document.body.appendChild(s);
});
</script>

<svelte:head>
	<title>yosegaki</title>
</svelte:head>

<main class:dark>
	<h1>yosegaki</h1>
	<p>
		寄せ書き。SvelteKit + Bun + SQLite のコメントサーバ。
		下はこのサーバ自身に <code>/embed.js</code> を貼ったもので、ここに書いたものはそのまま保存されます。
	</p>
	<pre><code>&lt;div id="yosegaki"&gt;&lt;/div&gt;
&lt;script src="{page.url.origin}/embed.js"&gt;&lt;/script&gt;</code></pre>
	<p>
		<button type="button" onclick={() => (dark = !dark)}>{dark ? "ライト" : "ダーク"}で見る</button>
		<a href="https://github.com/DAnything/yosegaki">GitHub</a>
	</p>
	<div id="yosegaki"></div>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
	}
	main {
		max-width: 46rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
		color: #1f2937;
		--ysg-accent: #2563eb;
	}
	main.dark {
		color: #e5e7eb;
		--ysg-accent: #60a5fa;
		--ysg-accent-fg: #0b1220;
	}
	:global(body:has(main.dark)) {
		background: #0f172a;
	}
	h1 {
		margin-top: 0;
	}
	pre {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, currentColor 6%, transparent);
		overflow-x: auto;
	}
	button {
		font: inherit;
		color: inherit;
		border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
		background: color-mix(in srgb, currentColor 5%, transparent);
		border-radius: 0.5rem;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
		margin-right: 0.5rem;
	}
	a {
		color: var(--ysg-accent);
	}
</style>
