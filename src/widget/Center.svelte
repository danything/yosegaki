<script lang="ts">
import type { Store } from "./store.svelte";
import type { Comment } from "./types";
import { excerpt, relativeTime } from "./util";

type Tab = "recent" | "replies" | "mine" | "pending";

let { store }: { store: Store } = $props();
const t = $derived(store.t);

let tab = $state<Tab>("recent");
let items = $state<Comment[]>([]);
let nextBefore = $state<number | null>(null);
let loading = $state(false);
let error = $state("");
let password = $state("");
let loginError = $state("");

const tabs = $derived<Tab[]>(
	store.admin
		? ["recent", "replies", "mine", "pending"]
		: ["recent", "replies", "mine"],
);

async function open(next: Tab, more = false) {
	if (!more) {
		tab = next;
		items = [];
		nextBefore = null;
	}
	loading = true;
	error = "";
	try {
		const r = await store.feed(next, more ? nextBefore : null);
		items = more ? [...items, ...r.comments] : r.comments;
		nextBefore = r.comments.length === 20 ? r.next_before : null;
		if (next === "replies") store.markSeen();
	} catch (e) {
		error = store.message(e);
	} finally {
		loading = false;
	}
}

$effect(() => {
	if (!tabs.includes(tab)) tab = "recent";
});

// 未読があるなら返信タブから開く
// svelte-ignore state_referenced_locally
open(store.unread > 0 ? "replies" : "recent");

function link(c: Comment): string {
	return `${c.page.url || c.page.key}#ysg-${c.id}`;
}

function samePage(c: Comment): boolean {
	return c.page.key === store.page;
}

function jump(ev: MouseEvent, c: Comment) {
	if (!samePage(c)) return;
	const el = document.getElementById(`ysg-${c.id}`);
	if (!el) return;
	ev.preventDefault();
	el.scrollIntoView({ behavior: "smooth", block: "center" });
	el.classList.add("ysg-flash");
	setTimeout(() => el.classList.remove("ysg-flash"), 2000);
}

async function approve(c: Comment) {
	try {
		await store.approve(c.id);
		items = items.filter((x) => x.id !== c.id);
	} catch (e) {
		error = store.message(e);
	}
}

async function del(c: Comment) {
	if (!confirm(t.confirmDelete)) return;
	try {
		await store.remove(c.id);
		items = items.filter((x) => x.id !== c.id);
	} catch (e) {
		error = store.message(e);
	}
}

async function login(ev: Event) {
	ev.preventDefault();
	loginError = "";
	try {
		await store.login(password);
		password = "";
	} catch (e) {
		loginError = store.message(e);
	}
}
</script>

<div class="ysg-center">
	<div class="ysg-tabs" role="tablist">
		{#each tabs as key (key)}
			<button type="button" role="tab" class="ysg-tab" class:ysg-active={tab === key}
				aria-selected={tab === key} onclick={() => open(key)}>
				{t.tabs[key]}
				{#if key === "replies" && store.unread > 0}<span class="ysg-badge">{store.unread}</span>{/if}
			</button>
		{/each}
	</div>
	{#if error}<p class="ysg-error">{error}</p>{/if}
	<ul class="ysg-feed">
		{#each items as c (c.id)}
			<li class="ysg-feed-item" class:ysg-pending={c.status === "pending"}>
				{#if c.avatar}<img class="ysg-avatar ysg-avatar-sm" src={c.avatar} alt="" loading="lazy" width="28" height="28" />{/if}
				<div class="ysg-feed-main">
					<div class="ysg-meta">
						<span class="ysg-name">{c.name}</span>
						{#if c.is_admin}<span class="ysg-tag ysg-tag-admin">{t.admin}</span>{/if}
						{#if c.status === "pending"}<span class="ysg-tag ysg-tag-pending">{t.pending}</span>{/if}
						<time class="ysg-time" datetime={c.created_at}>{relativeTime(c.created_at, store.lang)}</time>
					</div>
					<a class="ysg-feed-page" href={link(c)} onclick={(ev) => jump(ev, c)}>{c.page.title || c.page.key}</a>
					<p class="ysg-feed-text">{excerpt(c.body_html)}</p>
					{#if store.admin && (tab === "pending" || c.status === "pending")}
						<div class="ysg-actions">
							<button type="button" class="ysg-act ysg-act-approve" onclick={() => approve(c)}>{t.approve}</button>
							<button type="button" class="ysg-act" onclick={() => del(c)}>{t.delete}</button>
						</div>
					{/if}
				</div>
			</li>
		{:else}
			{#if !loading}<li class="ysg-empty">{t.empty[tab]}</li>{/if}
		{/each}
	</ul>
	{#if nextBefore !== null}
		<button type="button" class="ysg-btn ysg-more" disabled={loading} onclick={() => open(tab, true)}>{t.loadMore}</button>
	{/if}
	{#if store.config?.admin_enabled}
		<div class="ysg-center-foot">
			{#if store.admin}
				<span class="ysg-muted">{t.loginAs(store.admin.name)}</span>
				<button type="button" class="ysg-act" onclick={() => store.logout()}>{t.logout}</button>
			{:else}
				<form class="ysg-login" onsubmit={login}>
					<input class="ysg-input" type="password" placeholder={t.password} autocomplete="current-password" bind:value={password} />
					<button type="submit" class="ysg-btn" disabled={!password}>{t.login}</button>
					{#if loginError}<span class="ysg-error">{loginError}</span>{/if}
				</form>
			{/if}
		</div>
	{/if}
</div>
