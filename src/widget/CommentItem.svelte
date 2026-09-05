<script lang="ts">
import CommentItem from "./CommentItem.svelte";
import Editor from "./Editor.svelte";
import type { Store } from "./store.svelte";
import type { Comment } from "./types";
import { absoluteTime, relativeTime } from "./util";

interface Props {
	store: Store;
	comment: Comment;
	/** トップレベルかどうか。返信は入れ子にせず、根の下に平らに並べる */
	root?: boolean;
}

let { store, comment, root = true }: Props = $props();
const t = $derived(store.t);

const deleted = $derived(comment.status === "deleted");
const pending = $derived(comment.status === "pending");
const replies = $derived(root ? store.repliesOf(comment.id) : []);
// 返信の返信だけ「@誰宛て」を出す。根への直接の返信は位置で分かる
const showReplyTo = $derived(
	!root && comment.parent_id !== comment.root_id && comment.reply_to,
);
let busy = $state(false);

async function like() {
	if (busy) return;
	busy = true;
	try {
		await store.like(comment);
	} catch (e) {
		store.error = store.message(e);
	} finally {
		busy = false;
	}
}

async function del() {
	if (!confirm(t.confirmDelete)) return;
	try {
		await store.remove(comment.id);
	} catch (e) {
		store.error = store.message(e);
	}
}

async function approve() {
	try {
		await store.approve(comment.id);
	} catch (e) {
		store.error = store.message(e);
	}
}

function reply() {
	store.editing = null;
	store.replyTo = store.replyTo === comment.id ? null : comment.id;
}

function edit() {
	store.replyTo = null;
	store.editing = store.editing === comment.id ? null : comment.id;
}
</script>

<li class="ysg-comment" class:ysg-root={root} class:ysg-reply={!root} class:ysg-pending={pending}
	class:ysg-deleted={deleted} class:ysg-mine={comment.is_mine} id="ysg-{comment.id}">
	<div class="ysg-row">
		{#if comment.avatar}
			<img class="ysg-avatar" src={comment.avatar} alt="" loading="lazy" width="40" height="40" />
		{:else}
			<span class="ysg-avatar ysg-avatar-blank" aria-hidden="true"></span>
		{/if}
		<div class="ysg-main">
			<div class="ysg-meta">
				{#if deleted}
					<span class="ysg-name ysg-muted">{t.deleted}</span>
				{:else}
					{#if comment.website}
						<a class="ysg-name" href={comment.website} rel="nofollow noopener ugc" target="_blank">{comment.name}</a>
					{:else}
						<span class="ysg-name">{comment.name}</span>
					{/if}
					{#if comment.is_admin}<span class="ysg-tag ysg-tag-admin">{t.admin}</span>{/if}
					{#if pending}<span class="ysg-tag ysg-tag-pending">{t.pending}</span>{/if}
					{#if showReplyTo}<span class="ysg-replyto">@{comment.reply_to}</span>{/if}
				{/if}
				<time class="ysg-time" datetime={comment.created_at} title={absoluteTime(comment.created_at, store.lang)}>
					{relativeTime(comment.created_at, store.lang)}
				</time>
				{#if comment.edited && !deleted}<span class="ysg-edited ysg-muted">{t.edited}</span>{/if}
			</div>
			{#if store.editing === comment.id}
				<Editor {store} editId={comment.id} initial={comment.body_md} onclose={() => (store.editing = null)} />
			{:else if !deleted}
				<div class="ysg-body">{@html comment.body_html}</div>
			{/if}
			{#if !deleted && store.editing !== comment.id}
				<div class="ysg-actions">
					<button type="button" class="ysg-act ysg-like" class:ysg-liked={comment.liked}
						disabled={pending || busy} onclick={like} aria-label={t.like}>
						<span aria-hidden="true">{comment.liked ? "♥" : "♡"}</span> {comment.likes}
					</button>
					{#if !pending}
						<button type="button" class="ysg-act" onclick={reply}>{t.reply}</button>
					{/if}
					{#if comment.can_edit}
						<button type="button" class="ysg-act" onclick={edit}>{t.edit}</button>
						<button type="button" class="ysg-act" onclick={del}>{t.delete}</button>
					{/if}
					{#if store.admin && pending}
						<button type="button" class="ysg-act ysg-act-approve" onclick={approve}>{t.approve}</button>
					{/if}
				</div>
			{/if}
			{#if store.replyTo === comment.id}
				<Editor {store} parentId={comment.id} parentName={comment.name} onclose={() => (store.replyTo = null)} />
			{/if}
		</div>
	</div>
	{#if replies.length > 0}
		<ul class="ysg-replies">
			{#each replies as r (r.id)}
				<CommentItem {store} comment={r} root={false} />
			{/each}
		</ul>
	{/if}
</li>
