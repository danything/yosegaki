import type { Database as DatabaseType } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "./env";

let instance: DatabaseType | undefined;

export function db(): DatabaseType {
	if (instance) return instance;
	const { Database } = require("bun:sqlite") as typeof import("bun:sqlite");
	mkdirSync(dirname(env.dbPath), { recursive: true });
	instance = new Database(env.dbPath);
	instance.exec("PRAGMA journal_mode = WAL;");
	instance.exec("PRAGMA busy_timeout = 5000;");
	instance.exec("PRAGMA foreign_keys = ON;");

	instance.run(`
		CREATE TABLE IF NOT EXISTS page (
			key TEXT PRIMARY KEY,
			title TEXT NOT NULL DEFAULT '',
			url TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL
		)
	`);
	// root_id はスレッドの先頭 (トップレベル) のコメント。返信の返信も同じ
	// root_id を持つので、1 スレッドを 1 クエリで引ける。parent_id は
	// 「誰に返したか」の表示用。
	instance.run(`
		CREATE TABLE IF NOT EXISTS comment (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			page_key TEXT NOT NULL REFERENCES page(key),
			parent_id INTEGER REFERENCES comment(id),
			root_id INTEGER REFERENCES comment(id),
			name TEXT NOT NULL,
			email TEXT,
			email_hash TEXT,
			website TEXT,
			body_md TEXT NOT NULL,
			body_html TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'approved',
			visitor_hash TEXT,
			ip_hash TEXT,
			user_agent TEXT,
			is_admin INTEGER NOT NULL DEFAULT 0,
			notify INTEGER NOT NULL DEFAULT 0,
			edited INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`);
	instance.run(
		"CREATE INDEX IF NOT EXISTS comment_page ON comment(page_key, root_id, created_at)",
	);
	instance.run("CREATE INDEX IF NOT EXISTS comment_root ON comment(root_id)");
	instance.run(
		"CREATE INDEX IF NOT EXISTS comment_parent ON comment(parent_id)",
	);
	instance.run(
		"CREATE INDEX IF NOT EXISTS comment_visitor ON comment(visitor_hash)",
	);
	instance.run(
		"CREATE INDEX IF NOT EXISTS comment_status ON comment(status, id)",
	);
	instance.run(
		"CREATE INDEX IF NOT EXISTS comment_ip ON comment(ip_hash, created_at)",
	);
	instance.run(`
		CREATE TABLE IF NOT EXISTS vote (
			comment_id INTEGER NOT NULL REFERENCES comment(id) ON DELETE CASCADE,
			visitor_hash TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			PRIMARY KEY (comment_id, visitor_hash)
		)
	`);
	return instance;
}
