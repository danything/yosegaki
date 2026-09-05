// Cloudflare Turnstile。サーバの /config に site key があるときだけ読む。
// execute モードで、送信のたびにトークンを取り、見た目は必要なときだけ出す。

interface TurnstileApi {
	render(el: Element, opts: Record<string, unknown>): string;
	execute(id: string): void;
	reset(id: string): void;
	remove(id: string): void;
	getResponse(id: string): string | undefined;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
		__yosegakiTurnstile?: () => void;
	}
}

let loading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	loading ??= new Promise((resolve, reject) => {
		window.__yosegakiTurnstile = () => {
			if (window.turnstile) resolve(window.turnstile);
			else reject(new Error("turnstile missing"));
		};
		const s = document.createElement("script");
		s.src =
			"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__yosegakiTurnstile";
		s.async = true;
		s.onerror = () => reject(new Error("turnstile load failed"));
		document.head.appendChild(s);
	});
	return loading;
}

export class Challenge {
	private id: string;
	private waiting: {
		resolve: (t: string) => void;
		reject: (e: Error) => void;
	}[] = [];

	constructor(
		private api: TurnstileApi,
		el: Element,
		siteKey: string,
		lang: string,
	) {
		this.id = api.render(el, {
			sitekey: siteKey,
			language: lang,
			execution: "execute",
			appearance: "interaction-only",
			callback: (token: string) => this.settle((w) => w.resolve(token)),
			"error-callback": () => {
				this.settle((w) => w.reject(new Error("turnstile error")));
				return true;
			},
			"expired-callback": () => this.api.reset(this.id),
			"timeout-callback": () =>
				this.settle((w) => w.reject(new Error("turnstile timeout"))),
		});
	}

	/** 送信 1 回分のトークン。既に取れていればそれを返し、無ければ取りに行く */
	token(): Promise<string> {
		const existing = this.api.getResponse(this.id);
		if (existing) return Promise.resolve(existing);
		return new Promise((resolve, reject) => {
			this.waiting.push({ resolve, reject });
			if (this.waiting.length === 1) this.api.execute(this.id);
		});
	}

	/** トークンは一度しか使えないので、送ったら捨てる */
	reset(): void {
		this.api.reset(this.id);
	}

	remove(): void {
		this.api.remove(this.id);
	}

	private settle(
		fn: (w: {
			resolve: (t: string) => void;
			reject: (e: Error) => void;
		}) => void,
	) {
		const list = this.waiting;
		this.waiting = [];
		for (const w of list) fn(w);
	}
}
