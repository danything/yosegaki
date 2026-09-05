declare global {
	namespace App {
		interface Locals {
			/** X-Visitor ヘッダを SHA-256 したもの。無ければ null */
			visitor: string | null;
			/** Authorization: Bearer が有効な管理者トークンなら true */
			admin: boolean;
			/** 接続元 IP (CLIENT_IP_HEADER があればそのヘッダ) */
			ip: string;
		}
	}
}

export {};
