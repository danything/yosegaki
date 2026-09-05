import type { Lang } from "./i18n";

const PREFIX = "yosegaki:";

export function load<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		return raw === null ? fallback : (JSON.parse(raw) as T);
	} catch {
		return fallback;
	}
}

export function save(key: string, value: unknown): void {
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {}
}

export function remove(key: string): void {
	try {
		localStorage.removeItem(PREFIX + key);
	} catch {}
}

/** 端末ごとの識別子。サーバには SHA-256 されたものしか残らない */
export function visitorId(): string {
	let id = load<string>("visitor", "");
	if (!id) {
		id =
			typeof crypto.randomUUID === "function"
				? crypto.randomUUID()
				: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
						b.toString(16).padStart(2, "0"),
					).join("");
		save("visitor", id);
	}
	return id;
}

export function relativeTime(
	iso: string,
	lang: Lang,
	now = Date.now(),
): string {
	const diff = (new Date(iso).getTime() - now) / 1000;
	const abs = Math.abs(diff);
	const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
	if (abs < 60) return rtf.format(Math.round(diff), "second");
	if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
	if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
	if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
	return new Date(iso).toLocaleDateString(lang, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function absoluteTime(iso: string, lang: Lang): string {
	return new Date(iso).toLocaleString(lang);
}

/** HTML を素の文字列にして先頭だけ切る (通知センターの抜粋用) */
export function excerpt(html: string, max = 120): string {
	const div = document.createElement("div");
	div.innerHTML = html;
	const text = (div.textContent ?? "").replace(/\s+/g, " ").trim();
	return text.length > max ? `${text.slice(0, max)}…` : text;
}
