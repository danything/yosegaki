export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
	}
}

export class Api {
	token: string | null = null;

	constructor(
		public server: string,
		private visitor: string,
	) {}

	async req<T>(method: string, path: string, data?: unknown): Promise<T> {
		const headers: Record<string, string> = { "x-visitor": this.visitor };
		if (data !== undefined) headers["content-type"] = "application/json";
		if (this.token) headers.authorization = `Bearer ${this.token}`;
		let res: Response;
		try {
			res = await fetch(`${this.server}/api/v1${path}`, {
				method,
				headers,
				body: data === undefined ? undefined : JSON.stringify(data),
			});
		} catch (e) {
			throw new ApiError(0, "network", String(e));
		}
		const body = res.status === 204 ? null : await res.json().catch(() => null);
		if (!res.ok) {
			throw new ApiError(
				res.status,
				body?.error ?? "error",
				body?.message ?? res.statusText,
			);
		}
		return body as T;
	}

	get<T>(path: string) {
		return this.req<T>("GET", path);
	}
	post<T>(path: string, data: unknown) {
		return this.req<T>("POST", path, data);
	}
	patch<T>(path: string, data: unknown) {
		return this.req<T>("PATCH", path, data);
	}
	put<T>(path: string, data: unknown) {
		return this.req<T>("PUT", path, data);
	}
	delete<T>(path: string) {
		return this.req<T>("DELETE", path);
	}
}
