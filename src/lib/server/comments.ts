import { db } from "./db";
import { env } from "./env";
import { ApiError } from "./http";

export type Status = "approved" | "pending" | "deleted";

export interface CommentRow {
	id: number;
	page_key: string;
	parent_id: number | null;
	root_id: number | null;
	name: string;
	email: string | null;
	email_hash: string | null;
	website: string | null;
	body_md: string;
	body_html: string;
	status: Status;
	visitor_hash: string | null;
	ip_hash: string | null;
	user_agent: string | null;
	is_admin: number;
	notify: number;
	edited: number;
	created_at: number;
	updated_at: number;
	likes: number;
	liked: number;
	page_title: string;
	page_url: string;
	parent_name: string | null;
}

export interface PublicComment {
	id: number;
	parent_id: number | null;
	root_id: number | null;
	page: { key: string; title: string; url: string };
	name: string;
	avatar: string | null;
	website: string | null;
	body_html: string;
	body_md: string;
	status: Status;
	likes: number;
	liked: boolean;
	is_admin: boolean;
	is_mine: boolean;
	can_edit: boolean;
	edited: boolean;
	reply_to: string | null;
	created_at: string;
	updated_at: string;
}

export interface Viewer {
	visitor: string | null;
	admin: boolean;
}

export type Sort = "newest" | "oldest" | "popular";

const SELECT = `
	SELECT c.*,
		(SELECT COUNT(*) FROM vote v WHERE v.comment_id = c.id) AS likes,
		EXISTS(SELECT 1 FROM vote v WHERE v.comment_id = c.id AND v.visitor_hash = $visitor) AS liked,
		p.title AS page_title,
		p.url AS page_url,
		parent.name AS parent_name
	FROM comment c
	JOIN page p ON p.key = c.page_key
	LEFT JOIN comment parent ON parent.id = c.parent_id
`;

// 承認待ちは本人と管理者にだけ見える。削除済みは返信が残っている墓標なので
// 一覧には出す (中身は返さない)。
const VISIBLE = `(
	c.status = 'approved' OR c.status = 'deleted'
	OR (c.status = 'pending' AND ($admin = 1 OR (c.visitor_hash IS NOT NULL AND c.visitor_hash = $visitor)))
)`;

function viewerParams(viewer: Viewer) {
	return { $visitor: viewer.visitor, $admin: viewer.admin ? 1 : 0 };
}

function avatarUrl(row: CommentRow): string | null {
	if (env.avatar === "none") return null;
	// メール無しでも名前から identicon を出す。f=y で gravatar 側の画像は引かない
	const hash =
		row.email_hash ?? Bun.hash(row.name).toString(16).padStart(16, "0");
	const forced = row.email_hash ? "" : "&f=y";
	return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=80${forced}`;
}

export function toPublic(
	row: CommentRow,
	viewer: Viewer,
	now = Date.now(),
): PublicComment {
	const deleted = row.status === "deleted";
	const mine = !!viewer.visitor && row.visitor_hash === viewer.visitor;
	const withinWindow =
		env.ownerEditMinutes === 0 ||
		now - row.created_at < env.ownerEditMinutes * 60_000;
	return {
		id: row.id,
		parent_id: row.parent_id,
		root_id: row.root_id,
		page: { key: row.page_key, title: row.page_title, url: row.page_url },
		name: deleted ? "" : row.name,
		avatar: deleted ? null : avatarUrl(row),
		website: deleted ? null : row.website,
		body_html: deleted ? "" : row.body_html,
		body_md: deleted ? "" : row.body_md,
		status: row.status,
		likes: row.likes,
		liked: row.liked === 1,
		is_admin: row.is_admin === 1,
		is_mine: mine,
		can_edit: !deleted && (viewer.admin || (mine && withinWindow)),
		edited: row.edited === 1,
		reply_to: row.parent_name,
		created_at: new Date(row.created_at).toISOString(),
		updated_at: new Date(row.updated_at).toISOString(),
	};
}

export function upsertPage(key: string, title: string, url: string): void {
	db().run(
		`INSERT INTO page (key, title, url, created_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET
			title = CASE WHEN excluded.title <> '' THEN excluded.title ELSE title END,
			url = CASE WHEN excluded.url <> '' THEN excluded.url ELSE url END`,
		[key, title, url, Date.now()],
	);
}

export function getPage(
	key: string,
): { key: string; title: string; url: string } | null {
	return db()
		.query<{ key: string; title: string; url: string }, [string]>(
			"SELECT key, title, url FROM page WHERE key = ?",
		)
		.get(key);
}

export function getComment(id: number, viewer: Viewer): CommentRow | null {
	return db()
		.query<CommentRow, { $id: number; $visitor: string | null }>(
			`${SELECT} WHERE c.id = $id`,
		)
		.get({ $id: id, $visitor: viewer.visitor });
}

export function listPage(opts: {
	pageKey: string;
	sort: Sort;
	limit: number;
	offset: number;
	viewer: Viewer;
}): { comments: PublicComment[]; total: number; count: number } {
	const order = {
		newest: "c.created_at DESC, c.id DESC",
		oldest: "c.created_at ASC, c.id ASC",
		popular: "likes DESC, c.created_at DESC, c.id DESC",
	}[opts.sort];
	const params = { ...viewerParams(opts.viewer), $page: opts.pageKey };

	const roots = db()
		.query<CommentRow, typeof params & { $limit: number; $offset: number }>(
			`${SELECT} WHERE c.page_key = $page AND c.root_id IS NULL AND ${VISIBLE}
			 ORDER BY ${order} LIMIT $limit OFFSET $offset`,
		)
		.all({ ...params, $limit: opts.limit, $offset: opts.offset });

	let replies: CommentRow[] = [];
	if (roots.length > 0) {
		const ids = roots.map((r) => r.id);
		replies = db()
			.query<CommentRow, typeof params>(
				`${SELECT} WHERE c.root_id IN (${ids.join(",")}) AND ${VISIBLE}
				 ORDER BY c.created_at ASC, c.id ASC`,
			)
			.all(params);
	}

	const total = db()
		.query<{ n: number }, typeof params>(
			`SELECT COUNT(*) AS n FROM comment c WHERE c.page_key = $page AND c.root_id IS NULL AND ${VISIBLE}`,
		)
		.get(params)?.n;
	const count = db()
		.query<{ n: number }, [string]>(
			"SELECT COUNT(*) AS n FROM comment WHERE page_key = ? AND status = 'approved'",
		)
		.get(opts.pageKey)?.n;

	const now = Date.now();
	return {
		comments: [...roots, ...replies].map((r) => toPublic(r, opts.viewer, now)),
		total: total ?? 0,
		count: count ?? 0,
	};
}

export function counts(keys: string[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const k of keys) out[k] = 0;
	if (keys.length === 0) return out;
	const rows = db()
		.query<{ page_key: string; n: number }, string[]>(
			`SELECT page_key, COUNT(*) AS n FROM comment
			 WHERE status = 'approved' AND page_key IN (${keys.map(() => "?").join(",")})
			 GROUP BY page_key`,
		)
		.all(...keys);
	for (const r of rows) out[r.page_key] = r.n;
	return out;
}

/** 同じ IP から直近 window 秒に投稿された件数 (レート制限用) */
export function recentByIp(ipHash: string, windowSec: number): number {
	return (
		db()
			.query<{ n: number }, [string, number]>(
				"SELECT COUNT(*) AS n FROM comment WHERE ip_hash = ? AND created_at > ?",
			)
			.get(ipHash, Date.now() - windowSec * 1000)?.n ?? 0
	);
}

export interface NewComment {
	pageKey: string;
	parentId: number | null;
	rootId: number | null;
	name: string;
	email: string | null;
	emailHash: string | null;
	website: string | null;
	bodyMd: string;
	bodyHtml: string;
	status: Status;
	visitorHash: string | null;
	ipHash: string;
	userAgent: string | null;
	isAdmin: boolean;
	notify: boolean;
}

export function insertComment(c: NewComment, viewer: Viewer): CommentRow {
	const now = Date.now();
	const result = db().run(
		`INSERT INTO comment (page_key, parent_id, root_id, name, email, email_hash, website,
			body_md, body_html, status, visitor_hash, ip_hash, user_agent, is_admin, notify,
			created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			c.pageKey,
			c.parentId,
			c.rootId,
			c.name,
			c.email,
			c.emailHash,
			c.website,
			c.bodyMd,
			c.bodyHtml,
			c.status,
			c.visitorHash,
			c.ipHash,
			c.userAgent,
			c.isAdmin ? 1 : 0,
			c.notify ? 1 : 0,
			now,
			now,
		],
	);
	const row = getComment(Number(result.lastInsertRowid), viewer);
	if (!row) throw new Error("insert に失敗");
	return row;
}

export function updateComment(
	id: number,
	patch: {
		bodyMd: string;
		bodyHtml: string;
		name?: string;
		website?: string | null;
	},
	viewer: Viewer,
): CommentRow {
	db().run(
		`UPDATE comment SET body_md = ?, body_html = ?,
			name = COALESCE(?, name), website = CASE WHEN ? THEN ? ELSE website END,
			edited = 1, updated_at = ?
		 WHERE id = ?`,
		[
			patch.bodyMd,
			patch.bodyHtml,
			patch.name ?? null,
			patch.website === undefined ? 0 : 1,
			patch.website ?? null,
			Date.now(),
			id,
		],
	);
	const row = getComment(id, viewer);
	if (!row) throw new ApiError(404, "not_found", "見つからない");
	return row;
}

function hasChildren(id: number): boolean {
	return (
		(db()
			.query<{ n: number }, [number]>(
				"SELECT COUNT(*) AS n FROM comment WHERE parent_id = ?",
			)
			.get(id)?.n ?? 0) > 0
	);
}

/**
 * 返信が付いているコメントは墓標 (deleted) にして残し、無ければ物理削除する。
 * 物理削除で親の墓標が孤立したら、それも辿って消す。
 */
export function deleteComment(id: number): { tombstone: boolean } {
	const d = db();
	return d.transaction(() => {
		const row = d
			.query<{ parent_id: number | null; status: Status }, [number]>(
				"SELECT parent_id, status FROM comment WHERE id = ?",
			)
			.get(id);
		if (!row) throw new ApiError(404, "not_found", "見つからない");
		if (hasChildren(id)) {
			d.run(
				`UPDATE comment SET status = 'deleted', body_md = '', body_html = '',
					email = NULL, email_hash = NULL, website = NULL, notify = 0, updated_at = ?
				 WHERE id = ?`,
				[Date.now(), id],
			);
			return { tombstone: true };
		}
		d.run("DELETE FROM comment WHERE id = ?", [id]);
		let parentId = row.parent_id;
		while (parentId !== null) {
			const parent = d
				.query<{ parent_id: number | null; status: Status }, [number]>(
					"SELECT parent_id, status FROM comment WHERE id = ?",
				)
				.get(parentId);
			if (parent?.status !== "deleted" || hasChildren(parentId)) break;
			d.run("DELETE FROM comment WHERE id = ?", [parentId]);
			parentId = parent.parent_id;
		}
		return { tombstone: false };
	})();
}

export function approveComment(id: number, viewer: Viewer): CommentRow {
	db().run(
		"UPDATE comment SET status = 'approved', updated_at = ? WHERE id = ? AND status = 'pending'",
		[Date.now(), id],
	);
	const row = getComment(id, viewer);
	if (!row) throw new ApiError(404, "not_found", "見つからない");
	return row;
}

export function setLike(
	id: number,
	visitor: string,
	value: boolean,
): { likes: number; liked: boolean } {
	const d = db();
	if (value) {
		d.run(
			"INSERT OR IGNORE INTO vote (comment_id, visitor_hash, created_at) VALUES (?, ?, ?)",
			[id, visitor, Date.now()],
		);
	} else {
		d.run("DELETE FROM vote WHERE comment_id = ? AND visitor_hash = ?", [
			id,
			visitor,
		]);
	}
	const likes = d
		.query<{ n: number }, [number]>(
			"SELECT COUNT(*) AS n FROM vote WHERE comment_id = ?",
		)
		.get(id)?.n;
	return { likes: likes ?? 0, liked: value };
}

interface Feed {
	before: number | null;
	limit: number;
	viewer: Viewer;
}

type Bindings = Record<string, string | number | null>;

function feed(where: string, extra: Bindings, opts: Feed): PublicComment[] {
	const rows = db()
		.query<CommentRow, Bindings>(
			`${SELECT} WHERE ${where} AND ($before IS NULL OR c.id < $before)
			 ORDER BY c.id DESC LIMIT $limit`,
		)
		.all({
			...viewerParams(opts.viewer),
			...extra,
			$before: opts.before,
			$limit: opts.limit,
		});
	const now = Date.now();
	return rows.map((r) => toPublic(r, opts.viewer, now));
}

/** サイト全体の新着 */
export function recent(opts: Feed): PublicComment[] {
	return feed("c.status = 'approved'", {}, opts);
}

/** 自分が書いたもの (承認待ち含む) */
export function mine(opts: Feed): PublicComment[] {
	if (!opts.viewer.visitor) return [];
	return feed("c.visitor_hash = $visitor AND c.status <> 'deleted'", {}, opts);
}

/** 自分のコメントに付いた返信 */
export function repliesToMe(opts: Feed): PublicComment[] {
	if (!opts.viewer.visitor) return [];
	return feed(
		`c.status = 'approved' AND parent.visitor_hash = $visitor
		 AND (c.visitor_hash IS NULL OR c.visitor_hash <> $visitor)`,
		{},
		opts,
	);
}

export function pending(opts: Feed): PublicComment[] {
	return feed("c.status = 'pending'", {}, opts);
}

export function search(
	q: string,
	status: Status | null,
	opts: Feed,
): PublicComment[] {
	const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
	return feed(
		`($status IS NULL OR c.status = $status)
		 AND ($q = '' OR c.body_md LIKE $like ESCAPE '\\' OR c.name LIKE $like ESCAPE '\\'
			OR c.email LIKE $like ESCAPE '\\' OR c.page_key LIKE $like ESCAPE '\\')`,
		{ $status: status, $q: q, $like: like },
		opts,
	);
}
