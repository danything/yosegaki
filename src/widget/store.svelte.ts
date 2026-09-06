import { Api, ApiError } from "./api";
import { type Dict, dict, type Lang } from "./i18n";
import type { Author, Comment, Config, Feed, Sort } from "./types";
import {
	clearToken,
	load,
	loadToken,
	remove,
	save,
	saveToken,
	visitorId,
} from "./util";

export interface StoreOptions {
	server: string;
	page: string;
	title: string;
	url: string;
	lang: Lang;
	sort?: Sort;
	limit?: number;
	/** この hash を付けて開いたときだけ管理者ログインを出す */
	adminHash?: string;
}

// 設定は 1 ページに何度 init しても 1 回しか取りに行かない
const configCache = new Map<string, Promise<Config>>();

export class Store {
	readonly api: Api;
	readonly t: Dict;
	readonly lang: Lang;
	readonly page: string;
	readonly title: string;
	readonly url: string;
	readonly limit: number;

	config = $state<Config | null>(null);
	comments = $state<Comment[]>([]);
	total = $state(0);
	count = $state(0);
	sort = $state<Sort>("newest");
	loading = $state(false);
	error = $state("");
	admin = $state<{ name: string } | null>(null);
	author = $state<Author>({ name: "", email: "", website: "", notify: false });
	replies = $state<Comment[]>([]);
	seen = $state("");
	centerOpen = $state(false);
	/** URL の hash が adminHash と一致している (管理者ログインを出してよい) */
	adminHint = $state(false);
	readonly adminHash: string;
	replyTo = $state<number | null>(null);
	editing = $state<number | null>(null);

	roots = $derived(this.comments.filter((c) => c.root_id === null));
	hasMore = $derived(this.roots.length < this.total);
	unread = $derived(
		this.replies.filter((c) => c.created_at > this.seen).length,
	);

	constructor(opts: StoreOptions) {
		this.api = new Api(opts.server, visitorId());
		this.lang = opts.lang;
		this.t = dict(opts.lang);
		this.page = opts.page;
		this.title = opts.title;
		this.url = opts.url;
		this.limit = opts.limit ?? 50;
		this.adminHash = opts.adminHash ?? "#yosegaki-admin";
		this.adminHint = location.hash === this.adminHash;
		this.sort = opts.sort ?? "newest";
		this.author = { ...this.author, ...load<Partial<Author>>("author", {}) };
		this.seen = load<string>("seen", "");
		this.api.token = loadToken();
		// 以前の版が localStorage に置いた鍵。一度ログインし直してもらう
		remove("admin");
	}

	repliesOf(rootId: number): Comment[] {
		return this.comments.filter((c) => c.root_id === rootId);
	}

	async init(): Promise<void> {
		let cached = configCache.get(this.api.server);
		if (!cached) {
			cached = this.api.get<Config>("/config");
			configCache.set(this.api.server, cached);
		}
		const tasks: Promise<unknown>[] = [
			cached.then((c) => {
				this.config = c;
			}),
			this.load(true),
		];
		if (this.api.token) {
			tasks.push(
				this.api
					.get<{ admin: boolean; name: string | null }>("/admin/me")
					.then((r) => {
						if (r.admin && r.name) this.admin = { name: r.name };
						else this.logout();
					}),
			);
		}
		// 一度も書いたことがなければ返信を確かめる意味がない
		if (load<boolean>("posted", false)) tasks.push(this.loadReplies());
		await Promise.allSettled(tasks);
	}

	async load(reset: boolean): Promise<void> {
		this.loading = true;
		this.error = "";
		try {
			const offset = reset ? 0 : this.roots.length;
			const q = new URLSearchParams({
				page: this.page,
				sort: this.sort,
				limit: String(this.limit),
				offset: String(offset),
			});
			const r = await this.api.get<{
				comments: Comment[];
				total: number;
				count: number;
			}>(`/comments?${q}`);
			this.comments = reset ? r.comments : [...this.comments, ...r.comments];
			this.total = r.total;
			this.count = r.count;
		} catch (e) {
			this.error = this.message(e);
		} finally {
			this.loading = false;
		}
	}

	async loadReplies(): Promise<void> {
		try {
			this.replies = (
				await this.api.get<Feed>("/me/replies?limit=50")
			).comments;
		} catch {}
	}

	feed(
		kind: "recent" | "replies" | "mine" | "pending" | "search",
		before: number | null,
		q = "",
	): Promise<Feed> {
		const path = {
			recent: "/recent",
			replies: "/me/replies",
			mine: "/me/comments",
			pending: "/admin/pending",
			search: "/admin/comments",
		}[kind];
		const params = new URLSearchParams({ limit: "20" });
		if (before) params.set("before", String(before));
		if (kind === "search" && q) params.set("q", q);
		return this.api.get<Feed>(`${path}?${params}`);
	}

	/** hash の変化を追う。戻り値で解除 */
	watchHash(): () => void {
		const on = () => {
			this.adminHint = location.hash === this.adminHash;
			if (this.adminHint && !this.admin) this.centerOpen = true;
		};
		window.addEventListener("hashchange", on);
		return () => window.removeEventListener("hashchange", on);
	}

	toggleCenter(): void {
		this.centerOpen = !this.centerOpen;
	}

	markSeen(): void {
		const latest = this.replies[0]?.created_at;
		if (latest && latest > this.seen) {
			this.seen = latest;
			save("seen", latest);
		}
	}

	saveAuthor(): void {
		save("author", this.author);
	}

	async post(
		body: string,
		parentId: number | null,
		turnstile?: string,
	): Promise<Comment> {
		this.saveAuthor();
		const r = await this.api.post<{ comment: Comment }>("/comments", {
			page: this.page,
			title: this.title,
			url: this.url,
			parent_id: parentId,
			name: this.author.name,
			email: this.author.email,
			website: this.author.website,
			notify: this.author.notify,
			body,
			turnstile,
		});
		save("posted", true);
		const c = r.comment;
		if (c.root_id === null) {
			this.comments =
				this.sort === "oldest" ? [...this.comments, c] : [c, ...this.comments];
			this.total += 1;
		} else {
			this.comments = [...this.comments, c];
		}
		if (c.status === "approved") this.count += 1;
		this.replyTo = null;
		return c;
	}

	async preview(body: string): Promise<string> {
		return (await this.api.post<{ body_html: string }>("/preview", { body }))
			.body_html;
	}

	async edit(id: number, body: string): Promise<void> {
		const r = await this.api.patch<{ comment: Comment }>(`/comments/${id}`, {
			body,
		});
		this.replace(r.comment);
		this.editing = null;
	}

	async remove(id: number): Promise<void> {
		const r = await this.api.delete<{ id: number; tombstone: boolean }>(
			`/comments/${id}`,
		);
		if (r.tombstone) {
			const c = this.comments.find((x) => x.id === id);
			if (c) {
				this.replace({
					...c,
					status: "deleted",
					name: "",
					body_html: "",
					body_md: "",
					avatar: null,
					can_edit: false,
				});
			}
		} else {
			this.dropLocal(id);
		}
		await this.load(true);
	}

	async like(c: Comment): Promise<void> {
		const r = await this.api.put<{ likes: number; liked: boolean }>(
			`/comments/${c.id}/like`,
			{
				value: !c.liked,
			},
		);
		this.replace({ ...c, ...r });
	}

	async approve(id: number): Promise<Comment> {
		const r = await this.api.post<{ comment: Comment }>(
			`/admin/comments/${id}/approve`,
			{},
		);
		if (this.comments.some((x) => x.id === id)) {
			this.replace(r.comment);
			this.count += 1;
		}
		return r.comment;
	}

	/** ポップアップで OIDC。戻ってきた callback ページが postMessage でトークンを寄越す */
	async loginOidc(): Promise<void> {
		const server = this.api.server;
		const url = `${server}/admin/login?origin=${encodeURIComponent(location.origin)}`;
		const popup = window.open(
			url,
			"yosegaki-login",
			"popup,width=520,height=680",
		);
		if (!popup) {
			// ブロックされたら同じタブで行く。戻り先は無いのでユーザーが戻る
			location.href = url;
			return;
		}
		const r = await new Promise<{ token: string; name: string }>(
			(resolve, reject) => {
				const onMessage = (ev: MessageEvent) => {
					if (ev.origin !== server || ev.data?.type !== "yosegaki:admin")
						return;
					cleanup();
					resolve(ev.data);
				};
				const timer = setInterval(() => {
					if (popup.closed) {
						cleanup();
						reject(new Error(this.t.loginClosed));
					}
				}, 500);
				const cleanup = () => {
					window.removeEventListener("message", onMessage);
					clearInterval(timer);
				};
				window.addEventListener("message", onMessage);
			},
		);
		this.api.token = r.token;
		saveToken(r.token);
		this.admin = { name: r.name };
		if (!this.author.name) this.author = { ...this.author, name: r.name };
		await this.load(true);
	}

	logout(): void {
		this.api.token = null;
		clearToken();
		this.admin = null;
	}

	message(e: unknown): string {
		if (e instanceof ApiError && e.message) return e.message;
		return this.t.failed;
	}

	private replace(c: Comment): void {
		this.comments = this.comments.map((x) => (x.id === c.id ? c : x));
	}

	private dropLocal(id: number): void {
		const target = this.comments.find((x) => x.id === id);
		this.comments = this.comments.filter((x) => x.id !== id);
		if (target?.root_id === null) this.total -= 1;
	}
}
