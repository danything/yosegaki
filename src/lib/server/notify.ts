import nodemailer, { type Transporter } from "nodemailer";
import { type CommentRow, getComment } from "./comments";
import { env } from "./env";

let transport: Transporter | null | undefined;

function mailer(): Transporter | null {
	if (transport !== undefined) return transport;
	if (!env.smtp.host) {
		transport = null;
		return null;
	}
	transport = nodemailer.createTransport({
		host: env.smtp.host,
		port: env.smtp.port,
		secure: env.smtp.secure,
		auth: env.smtp.user
			? { user: env.smtp.user, pass: env.smtp.pass }
			: undefined,
	});
	return transport;
}

function link(row: CommentRow): string {
	return row.page_url ? `${row.page_url}#ysg-${row.id}` : row.page_key;
}

function excerpt(row: CommentRow): string {
	return row.body_md.length > 400
		? `${row.body_md.slice(0, 400)}…`
		: row.body_md;
}

async function send(to: string, subject: string, text: string): Promise<void> {
	const m = mailer();
	if (!m || !to) return;
	try {
		await m.sendMail({ from: env.smtp.from, to, subject, text });
	} catch (e) {
		console.error("mail failed", to, e);
	}
}

async function webhook(event: string, row: CommentRow): Promise<void> {
	if (!env.webhookUrl) return;
	try {
		await fetch(env.webhookUrl, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				event,
				comment: {
					id: row.id,
					name: row.name,
					body: row.body_md,
					status: row.status,
					created_at: new Date(row.created_at).toISOString(),
				},
				page: { key: row.page_key, title: row.page_title, url: link(row) },
			}),
		});
	} catch (e) {
		console.error("webhook failed", e);
	}
}

/** 親の投稿者に返信を知らせる。通知を希望していて、自分自身への返信でないとき */
async function notifyParent(row: CommentRow): Promise<void> {
	if (row.parent_id === null) return;
	const parent = getComment(row.parent_id, { visitor: null, admin: true });
	if (!parent?.notify || !parent.email) return;
	if (parent.visitor_hash && parent.visitor_hash === row.visitor_hash) return;
	const title = row.page_title || row.page_key;
	await send(
		parent.email,
		`[${env.siteName}] ${row.name} さんから返信があります`,
		`「${title}」へのあなたのコメントに ${row.name} さんが返信しました。\n\n${excerpt(row)}\n\n${link(row)}\n`,
	);
}

/** 投稿直後。裏で送るので待たない */
export function onCreated(row: CommentRow): void {
	const title = row.page_title || row.page_key;
	const tasks: Promise<void>[] = [webhook("comment.created", row)];
	if (!row.is_admin && env.adminEmail) {
		const state = row.status === "pending" ? "承認待ち" : "公開済み";
		tasks.push(
			send(
				env.adminEmail,
				`[${env.siteName}] 新しいコメント (${state}): ${row.name}`,
				`${title}\n${link(row)}\n\n${row.name}${row.email ? ` <${row.email}>` : ""}\n\n${excerpt(row)}\n`,
			),
		);
	}
	if (row.status === "approved") tasks.push(notifyParent(row));
	Promise.all(tasks).catch((e) => console.error(e));
}

export function onApproved(row: CommentRow): void {
	Promise.all([webhook("comment.approved", row), notifyParent(row)]).catch(
		(e) => console.error(e),
	);
}
