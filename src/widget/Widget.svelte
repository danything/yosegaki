<script lang="ts">
import { onMount } from "svelte";
import Center from "./Center.svelte";
import CommentItem from "./CommentItem.svelte";
import Editor from "./Editor.svelte";
import type { Store } from "./store.svelte";
import type { Sort } from "./types";

let { store }: { store: Store } = $props();
const t = $derived(store.t);
const sorts: Sort[] = ["newest", "oldest", "popular"];

onMount(() => {
	store.init().then(() => {
		// #ysg-<id> で来たらそこまで飛ぶ
		const m = location.hash.match(/^#ysg-(\d+)$/);
		if (!m) return;
		const el = document.getElementById(`ysg-${m[1]}`);
		if (!el) return;
		el.scrollIntoView({ block: "center" });
		el.classList.add("ysg-flash");
		setTimeout(() => el.classList.remove("ysg-flash"), 2000);
	});
});
</script>

<div class="ysg" lang={store.lang}>
	<div class="ysg-head">
		<span class="ysg-count">{t.count(store.count)}</span>
		<div class="ysg-tools">
			{#if store.count > 1}
				<select class="ysg-select" bind:value={store.sort} onchange={() => store.load(true)}>
					{#each sorts as s (s)}<option value={s}>{t.sort[s]}</option>{/each}
				</select>
			{/if}
			<button type="button" class="ysg-btn ysg-bell" class:ysg-active={store.centerOpen}
				aria-expanded={store.centerOpen} onclick={() => store.toggleCenter()}>
				{t.notifications}
				{#if store.unread > 0}<span class="ysg-badge">{store.unread}</span>{/if}
			</button>
		</div>
	</div>
	{#if store.centerOpen}
		<Center {store} />
	{/if}
	<Editor {store} />
	{#if store.error}<p class="ysg-error">{store.error}</p>{/if}
	<ul class="ysg-list">
		{#each store.roots as c (c.id)}
			<CommentItem {store} comment={c} />
		{/each}
	</ul>
	{#if store.comments.length === 0 && !store.loading && !store.error}
		<p class="ysg-empty">{t.noComments}</p>
	{/if}
	{#if store.hasMore}
		<button type="button" class="ysg-btn ysg-more" disabled={store.loading} onclick={() => store.load(false)}>{t.loadMore}</button>
	{/if}
</div>
