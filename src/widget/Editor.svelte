<script lang="ts">
import type { Store } from "./store.svelte";
import { Challenge, loadTurnstile } from "./turnstile";

interface Props {
	store: Store;
	/** 返信先。トップレベルなら null */
	parentId?: number | null;
	parentName?: string;
	/** 編集モードのときの対象 id */
	editId?: number | null;
	initial?: string;
	onclose?: () => void;
}

let {
	store,
	parentId = null,
	parentName = "",
	editId = null,
	initial = "",
	onclose,
}: Props = $props();
const t = $derived(store.t);

// svelte-ignore state_referenced_locally
let body = $state(initial);
let previewing = $state(false);
let previewHtml = $state("");
let sending = $state(false);
let error = $state("");
let hp = $state("");
let notice = $state("");
let textarea: HTMLTextAreaElement | undefined = $state();
let turnstileEl: HTMLDivElement | undefined = $state();
let challenge: Challenge | null = null;
let verifying = $state(false);

const isEdit = $derived(editId !== null);
const max = $derived(store.config?.max_length ?? 4000);
const siteKey = $derived(
	isEdit ? "" : (store.config?.turnstile_site_key ?? ""),
);

// Turnstile は編集以外の投稿欄に 1 つずつ置く。要らなくなったら消す
$effect(() => {
	const el = turnstileEl;
	const key = siteKey;
	if (!el || !key) return;
	let alive = true;
	loadTurnstile()
		.then((api) => {
			if (!alive) return;
			challenge = new Challenge(api, el, key, store.lang);
		})
		.catch((e) => console.warn("[yosegaki] turnstile", e));
	return () => {
		alive = false;
		challenge?.remove();
		challenge = null;
	};
});

$effect(() => {
	if (parentId !== null || isEdit) textarea?.focus();
});

async function togglePreview() {
	if (previewing) {
		previewing = false;
		return;
	}
	try {
		previewHtml = body.trim() ? await store.preview(body) : "";
		previewing = true;
	} catch (e) {
		error = store.message(e);
	}
}

async function submit(ev: Event) {
	ev.preventDefault();
	if (sending) return;
	error = "";
	notice = "";
	if (hp) {
		// bot 用の罠が埋まっている。人間なら空
		body = "";
		return;
	}
	if (!body.trim()) return;
	sending = true;
	try {
		if (isEdit && editId !== null) {
			await store.edit(editId, body);
			onclose?.();
		} else {
			let token: string | undefined;
			if (siteKey) {
				if (!challenge) throw new Error(t.verifyFailed);
				verifying = true;
				try {
					token = await challenge.token();
				} catch {
					throw new Error(t.verifyFailed);
				} finally {
					verifying = false;
				}
			}
			const c = await store.post(body, parentId, token);
			challenge?.reset();
			body = "";
			previewing = false;
			if (c.status === "pending") notice = t.pendingNote;
			if (parentId !== null) onclose?.();
		}
	} catch (e) {
		// トークンは使い捨てなので、失敗したら次の送信のために捨てる
		challenge?.reset();
		error =
			e instanceof Error && !("status" in e) ? e.message : store.message(e);
	} finally {
		sending = false;
	}
}

function onkeydown(ev: KeyboardEvent) {
	if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") submit(ev);
}
</script>

<form class="ysg-editor" class:ysg-editor-reply={parentId !== null} class:ysg-editor-edit={isEdit} onsubmit={submit}>
	{#if !isEdit}
		<div class="ysg-fields">
			<input class="ysg-input" type="text" placeholder={t.name} required maxlength="50" autocomplete="nickname"
				bind:value={store.author.name} onchange={() => store.saveAuthor()} />
			<input class="ysg-input" type="email" placeholder={t.email} maxlength="254" autocomplete="email"
				bind:value={store.author.email} onchange={() => store.saveAuthor()} />
			<input class="ysg-input" type="url" placeholder={t.website} maxlength="200" autocomplete="url"
				bind:value={store.author.website} onchange={() => store.saveAuthor()} />
		</div>
	{/if}
	<!-- ハニーポット。人間には見えない -->
	<input class="ysg-hp" type="text" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true"
		style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" bind:value={hp} />
	{#if previewing}
		<div class="ysg-preview ysg-body">
			{#if previewHtml}{@html previewHtml}{:else}<p class="ysg-muted">{t.previewEmpty}</p>{/if}
		</div>
	{:else}
		<textarea class="ysg-textarea" rows={parentId !== null || isEdit ? 3 : 4} maxlength={max}
			placeholder={parentId !== null ? t.replyPlaceholder(parentName) : t.placeholder}
			bind:value={body} bind:this={textarea} {onkeydown}></textarea>
	{/if}
	{#if siteKey}
		<div class="ysg-turnstile" bind:this={turnstileEl}></div>
	{/if}
	<div class="ysg-editor-foot">
		{#if !isEdit && store.config?.notify_by_email && store.author.email}
			<label class="ysg-check">
				<input type="checkbox" bind:checked={store.author.notify} onchange={() => store.saveAuthor()} />
				{t.notifyReply}
			</label>
		{/if}
		<span class="ysg-spacer"></span>
		{#if error}<span class="ysg-error">{error}</span>{/if}
		{#if notice}<span class="ysg-notice">{notice}</span>{/if}
		<button type="button" class="ysg-btn" onclick={togglePreview}>{previewing ? t.write : t.preview}</button>
		{#if parentId !== null || isEdit}
			<button type="button" class="ysg-btn" onclick={() => onclose?.()}>{t.cancel}</button>
		{/if}
		<button type="submit" class="ysg-btn ysg-btn-primary" disabled={sending || !body.trim()}>
			{verifying ? t.verifying : sending ? t.sending : isEdit ? t.save : t.submit}
		</button>
	</div>
</form>
