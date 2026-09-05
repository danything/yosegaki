import { env } from "./env";
import { countLinks } from "./markdown";

/**
 * 投稿を公開するか承認待ちにするか。管理者は常に公開。
 * bot の遮断は Turnstile とハニーポットの仕事で、ここは人間の投稿の振り分け。
 */
export function decideStatus(
	opts: { bodyMd: string; bodyHtml: string; admin: boolean },
	rules: {
		moderation: "all" | "links" | "none";
		maxLinks: number;
		blockWords: readonly string[];
	} = env,
): "approved" | "pending" {
	if (opts.admin) return "approved";
	if (rules.moderation === "all") return "pending";
	const lower = opts.bodyMd.toLowerCase();
	if (rules.blockWords.some((w) => lower.includes(w.toLowerCase())))
		return "pending";
	if (
		rules.moderation === "links" &&
		countLinks(opts.bodyHtml) > rules.maxLinks
	)
		return "pending";
	return "approved";
}

const attempts = new Map<string, number[]>();

/** 管理者ログインの総当たり対策。IP ごとに 10 分で 5 回 */
export function loginAllowed(ipHash: string): boolean {
	const now = Date.now();
	const list = (attempts.get(ipHash) ?? []).filter((t) => now - t < 600_000);
	list.push(now);
	attempts.set(ipHash, list);
	if (attempts.size > 10_000) attempts.clear();
	return list.length <= 5;
}
