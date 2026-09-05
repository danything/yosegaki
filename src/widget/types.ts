export type Status = "approved" | "pending" | "deleted";
export type Sort = "newest" | "oldest" | "popular";

export interface Comment {
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

export interface Config {
	site_name: string;
	admin_enabled: boolean;
	admin_name: string;
	moderation: "all" | "links" | "none";
	max_length: number;
	owner_edit_minutes: number;
	avatar: "gravatar" | "none";
	allow_images: boolean;
	notify_by_email: boolean;
	version: string;
}

export interface Author {
	name: string;
	email: string;
	website: string;
	notify: boolean;
}

export interface Feed {
	comments: Comment[];
	next_before: number | null;
}
