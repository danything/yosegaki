export type Lang = "ja" | "en";

const ja = {
	count: (n: number) => (n === 0 ? "コメント" : `${n} 件のコメント`),
	noComments: "まだコメントはありません",
	name: "名前",
	email: "メール (任意・非公開)",
	website: "サイト (任意)",
	notifyReply: "返信をメールで受け取る",
	placeholder: "コメントを書く (Markdown が使えます)",
	replyPlaceholder: (name: string) => `${name} さんへ返信`,
	preview: "プレビュー",
	write: "書く",
	submit: "送信",
	sending: "送信中…",
	save: "保存",
	cancel: "キャンセル",
	reply: "返信",
	edit: "編集",
	delete: "削除",
	confirmDelete: "このコメントを削除しますか？",
	approve: "承認",
	pending: "承認待ち",
	pendingNote: "管理者が承認すると表示されます",
	admin: "管理者",
	deleted: "削除されたコメント",
	edited: "(編集済み)",
	loadMore: "もっと見る",
	sort: { newest: "新しい順", oldest: "古い順", popular: "人気順" },
	notifications: "通知",
	tabs: { recent: "最近", replies: "返信", mine: "自分", pending: "承認待ち" },
	empty: {
		recent: "まだコメントはありません",
		replies: "あなた宛ての返信はありません",
		mine: "まだ書き込んでいません",
		pending: "承認待ちはありません",
	},
	login: "管理者ログイン",
	logout: "ログアウト",
	password: "パスワード",
	loginAs: (name: string) => `${name} としてログイン中`,
	failed: "失敗しました",
	previewEmpty: "(何も書かれていません)",
	tooLong: (n: number) => `${n} 文字まで`,
	like: "いいね",
};

const en: typeof ja = {
	count: (n) =>
		n === 0 ? "Comments" : n === 1 ? "1 comment" : `${n} comments`,
	noComments: "No comments yet",
	name: "Name",
	email: "Email (optional, private)",
	website: "Website (optional)",
	notifyReply: "Email me when someone replies",
	placeholder: "Write a comment (Markdown supported)",
	replyPlaceholder: (name) => `Reply to ${name}`,
	preview: "Preview",
	write: "Write",
	submit: "Post",
	sending: "Posting…",
	save: "Save",
	cancel: "Cancel",
	reply: "Reply",
	edit: "Edit",
	delete: "Delete",
	confirmDelete: "Delete this comment?",
	approve: "Approve",
	pending: "Pending",
	pendingNote: "Shown once an admin approves it",
	admin: "Admin",
	deleted: "Deleted comment",
	edited: "(edited)",
	loadMore: "Load more",
	sort: { newest: "Newest", oldest: "Oldest", popular: "Popular" },
	notifications: "Notifications",
	tabs: {
		recent: "Recent",
		replies: "Replies",
		mine: "Mine",
		pending: "Pending",
	},
	empty: {
		recent: "No comments yet",
		replies: "No replies to you yet",
		mine: "You have not posted yet",
		pending: "Nothing pending",
	},
	login: "Admin sign in",
	logout: "Sign out",
	password: "Password",
	loginAs: (name) => `Signed in as ${name}`,
	failed: "Something went wrong",
	previewEmpty: "(nothing to preview)",
	tooLong: (n) => `Up to ${n} characters`,
	like: "Like",
};

export type Dict = typeof ja;

export function dict(lang: Lang): Dict {
	return lang === "en" ? en : ja;
}

export function detectLang(explicit?: string): Lang {
	const l = (
		explicit ||
		document.documentElement.lang ||
		navigator.language ||
		"ja"
	).toLowerCase();
	return l.startsWith("en") ? "en" : "ja";
}
