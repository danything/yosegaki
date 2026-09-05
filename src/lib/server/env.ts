// 設定はすべて環境変数。起動時に一度だけ読む。

function int(name: string, fallback: number): number {
	const raw = process.env[name];
	if (raw === undefined || raw === "") return fallback;
	const n = Number(raw);
	if (!Number.isFinite(n)) throw new Error(`${name} は数値で指定する: ${raw}`);
	return n;
}

function list(name: string): string[] {
	return (process.env[name] ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function pick<T extends string>(
	name: string,
	allowed: readonly T[],
	fallback: T,
): T {
	const raw = process.env[name];
	if (!raw) return fallback;
	if (!(allowed as readonly string[]).includes(raw)) {
		throw new Error(`${name} は ${allowed.join(" | ")} のいずれか: ${raw}`);
	}
	return raw as T;
}

export const env = {
	/** SQLite のパス。ディレクトリは無ければ作る */
	dbPath: process.env.DB_PATH ?? "data/yosegaki.db",
	/** 埋め込み元として許可するオリジン。空なら何でも許可 (開発用) */
	allowedOrigins: list("ALLOWED_ORIGINS"),
	/** メールの件名などに使う */
	siteName: process.env.SITE_NAME ?? "yosegaki",
	/** 管理者。パスワードが無ければ管理機能ごと無効 */
	adminPassword: process.env.ADMIN_PASSWORD ?? "",
	adminName: process.env.ADMIN_NAME ?? "admin",
	adminEmail: process.env.ADMIN_EMAIL ?? "",
	/** トークン署名と IP ハッシュの鍵。無ければ起動ごとに乱数 (再起動でログアウトする) */
	secret: process.env.SECRET ?? crypto.randomUUID(),
	/** 管理者トークンの有効期間 (日) */
	adminTokenDays: int("ADMIN_TOKEN_DAYS", 30),
	/** 接続元 IP を取るヘッダ。Cloudflare 配下なら CF-Connecting-IP */
	clientIpHeader: process.env.CLIENT_IP_HEADER ?? "",

	/** all: 全部承認待ち / links: リンクが多いものだけ / none: 承認なし */
	moderation: pick("MODERATION", ["all", "links", "none"] as const, "links"),
	maxLinks: int("MAX_LINKS", 2),
	/** 含まれていたら承認待ちにする語 */
	blockWords: list("BLOCK_WORDS"),
	maxLength: int("MAX_LENGTH", 4000),
	/** 同じ IP から RATE_LIMIT_WINDOW 秒の間に投稿できる件数 */
	rateLimitMax: int("RATE_LIMIT_MAX", 5),
	rateLimitWindow: int("RATE_LIMIT_WINDOW", 600),
	/** 投稿者本人が編集・削除できる時間 (分)。0 なら無期限 */
	ownerEditMinutes: int("OWNER_EDIT_MINUTES", 60),
	/** gravatar | none */
	avatar: pick("AVATAR", ["gravatar", "none"] as const, "gravatar"),
	allowImages: process.env.ALLOW_IMAGES === "true",

	smtp: {
		host: process.env.SMTP_HOST ?? "",
		port: int("SMTP_PORT", 587),
		user: process.env.SMTP_USER ?? "",
		pass: process.env.SMTP_PASS ?? "",
		from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
		secure: process.env.SMTP_SECURE === "true",
	},
	/** 新着を JSON で POST する先。空なら送らない */
	webhookUrl: process.env.WEBHOOK_URL ?? "",
} as const;

export function originAllowed(origin: string | null): boolean {
	if (env.allowedOrigins.length === 0) return true;
	return origin !== null && env.allowedOrigins.includes(origin);
}
