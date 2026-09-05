# yosegaki

寄せ書き。**SvelteKit + Bun + SQLite** のコメントサーバ。記事のどのコメント欄からでも、サイト全体の新着・自分宛ての返信・承認待ちが見える。管理画面は無い。

```html
<div id="yosegaki"></div>
<script src="https://yk.doany.io/embed.js"></script>
```

これだけで動く。アカウントは要らず、名前だけで書ける。返信・いいね・Markdown・プレビュー・本人による編集と削除・メール通知。既定では承認なしで即公開し、bot は Cloudflare Turnstile とハニーポットで止める。

## 考え方

- **スタイルを押し付けない**: 描画は埋め込み先の DOM に直接行い、色は埋め込み先の文字色を薄めて使う。ライト/ダークの切り替えは何もしなくて追従する。`--ysg-accent` などの変数で寄せられるし、`data-css="false"` で同梱 CSS を丸ごと捨てて自分で書いてもいい。クラスは全部 `ysg-` 始まり
- **管理画面を作らない**: 管理者ログインはコメント欄の「通知」の中にあるが、読者には見せない。記事の URL に `#yosegaki-admin` を付けて開いたときだけボタンが出る。パスワードは持たず OIDC (Entra ID など) だけで、ログインすると、その場で承認・削除ができ、承認待ちと検索のタブが増える。「最近」に並ぶ全記事のコメントもパネルから直接消せる。荒らしの掃除に別のページは要らない
- **API は UI と独立**: `/api/v1` は JSON だけ返す。埋め込みスクリプトはその一利用者に過ぎず、自分で画面を作るならそのまま叩ける
- **1 プロセス 1 ファイル**: SQLite (WAL) を 1 つ持つだけ。バックアップはファイルのコピー

## 埋め込み

`<script>` の `data-*` 属性で調整する。全部省略できる。

| 属性 | 既定 | 意味 |
|---|---|---|
| `data-target` | `#yosegaki` | 描画先のセレクタ |
| `data-page` | `location.origin + pathname` | スレッドの鍵。クエリ文字列は含まれない |
| `data-title` | `document.title` | 通知センターに出す記事名 |
| `data-url` | `data-page` と同じ | 通知やメールからのリンク先 |
| `data-lang` | `<html lang>` から判定 | `ja` / `en` |
| `data-sort` | `newest` | `newest` / `oldest` / `popular` |
| `data-css` | `true` | `false` なら同梱 CSS を差さない |
| `data-auto` | `true` | `false` なら自動で描画せず `Yosegaki.init()` を待つ |
| `data-admin-hash` | `#yosegaki-admin` | この hash を付けて開いたときだけ管理者ログインを出す |

SPA (swup など) でページを差し替えるなら `data-auto="false"` にして、遷移のたびに呼ぶ。

```js
const instance = Yosegaki.init({ page: location.origin + location.pathname });
instance.destroy();   // 次の遷移の前に
```

一覧ページで件数だけ欲しいときは `Yosegaki.counts([url1, url2])` が `{url: 件数}` を返す。

### 見た目を寄せる

```css
#yosegaki {
	--ysg-accent: var(--primary);      /* ボタン・リンク */
	--ysg-accent-fg: #fff;             /* その上の文字 */
	--ysg-radius: 0.75rem;
	--ysg-line: rgb(0 0 0 / 0.1);      /* 罫線 */
	--ysg-surface: rgb(0 0 0 / 0.04);  /* 入力欄などの背景 */
}
```

## 動かす

```sh
docker run -d -p 3000:3000 -v yosegaki:/usr/src/app/data \
  -e ALLOWED_ORIGINS=https://example.com \
  -e SECRET=... \
  -e OIDC_ISSUER=... -e OIDC_CLIENT_ID=... -e OIDC_CLIENT_SECRET=... -e OIDC_ADMIN_GROUPS=... \
  ghcr.io/danything/yosegaki
```

| 環境変数 | 既定 | 意味 |
|---|---|---|
| `ALLOWED_ORIGINS` | (全部許可) | 埋め込みを許すオリジン。カンマ区切り。本番では必ず書く |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | (無効) | 管理者のログイン。3 つ揃うと有効で、無ければ管理機能ごと消える。redirect URI は `https://<host>/admin/callback` |
| `OIDC_ADMIN_GROUPS` | (無し) | 管理者にするグループ。`groups` / `roles` クレームに含まれる値のカンマ区切り (Entra ならグループの Object ID) |
| `OIDC_ADMINS` | (無し) | 管理者にする個人。email / preferred_username / sub のカンマ区切り |
| `OIDC_LABEL` | `SSO` | ログインボタンの表示 (「〜 でログイン」) |
| `ADMIN_NAME` / `ADMIN_EMAIL` | `admin` / (無し) | 管理者の表示名と、新着を受け取るメール |
| `SECRET` | 起動ごとに乱数 | トークン署名と IP ハッシュの鍵。無いと再起動でログアウトする |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET` | (無し) | [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) の鍵。両方あれば投稿に人間の確認を挟む。見た目は必要なときだけ出る |
| `MODERATION` | `none` | `none`: 承認なしで公開 / `links`: リンクが `MAX_LINKS` (2) を超えたら承認待ち / `all`: 全部承認待ち |
| `BLOCK_WORDS` | (無し) | 含んでいたら承認待ちにする語。カンマ区切り |
| `MAX_LENGTH` | `4000` | 本文の上限 |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | `5` / `600` | 同じ IP から 600 秒に 5 件まで |
| `OWNER_EDIT_MINUTES` | `60` | 本人が編集・削除できる時間。`0` で無期限 |
| `AVATAR` | `gravatar` | `none` でアバターを出さない |
| `ALLOW_IMAGES` | `false` | Markdown の画像を許す |
| `CLIENT_IP_HEADER` | (無し) | 接続元 IP を取るヘッダ。Cloudflare なら `CF-Connecting-IP` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_SECURE` | (無し) | 通知メール。`SMTP_HOST` が無ければ送らない |
| `WEBHOOK_URL` | (無し) | 新着と承認を JSON で POST する先 |
| `SITE_NAME` | `yosegaki` | メールの件名 |
| `DB_PATH` | `data/yosegaki.db` | SQLite の置き場 |

### スパム

- **Turnstile**: `TURNSTILE_SITE_KEY` と `TURNSTILE_SECRET` を入れると、送信のたびにトークンを取ってサーバで照会する。Cloudflare のダッシュボードで Turnstile → ウィジェットを作り、ホスト名に埋め込み先 (doany.io) を登録する。ウィジェットのモードは Managed のままでいい。表示は「必要なときだけ」なので普段は何も出ない
- **ハニーポット**: 人間に見えない入力欄が埋まっていたら捨てる
- **レート制限**: 同じ IP から `RATE_LIMIT_WINDOW` 秒に `RATE_LIMIT_MAX` 件まで
- **承認待ち**: `BLOCK_WORDS` を含むものは常に承認待ち。`MODERATION=links` ならリンクの多いものも

### 管理者の OIDC

自前のパスワード認証は持たない。追従が辛い割に得るものが無いので、Entra ID や Keycloak など OIDC が話せる IdP に任せる。記事を `#yosegaki-admin` 付きで開くと通知パネルに「〜 でログイン」が出る。押すとポップアップで `/admin/login` を開き、IdP を経て `/admin/callback` に戻る。そこで id_token を検証して `OIDC_ADMIN_GROUPS` / `OIDC_ADMINS` に照らし、通れば管理者トークンを `postMessage` で開いた元のウィンドウに返す。Cookie は使わないので、埋め込み先のドメインが違っても Safari で困らない。

IdP 側では redirect URI に `https://<host>/admin/callback` を登録し、scope `openid profile email` を許す。グループで絞るなら id_token に `groups` クレームを出す設定にして (Entra: トークン構成 → グループ要求を追加)、`OIDC_ADMIN_GROUPS` にグループの Object ID を書く。

本人の識別は端末ごとの乱数 (`X-Visitor`) で、サーバには SHA-256 だけ残る。メールは通知にしか使わず、API には出ない (アバターは gravatar のハッシュ)。IP もハッシュしてレート制限にだけ使う。

### 通知

- 管理者 (`ADMIN_EMAIL`) には投稿のたびにメール。承認待ちならそう書いてある
- 投稿者がメールを書いて「返信を受け取る」に印を付けていれば、返信が公開された時点でメール
- `WEBHOOK_URL` には `comment.created` / `comment.approved` を POST

### k3s (Helm)

チャートは `oci://ghcr.io/danything/charts/yosegaki`。k3s の HelmChart CRD から参照する。

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: yosegaki
  namespace: kube-system
spec:
  chart: oci://ghcr.io/danything/charts/yosegaki
  version: 0.1.x
  targetNamespace: blog
  valuesContent: |-
    host: yk.doany.io
    allowedOrigins: [https://doany.io]
    turnstile:
      siteKey: 0x...
    oidc:
      issuer: https://login.microsoftonline.com/<tenant>/v2.0
      clientId: ...
      adminGroups: [<グループの Object ID>]
      label: Microsoft
    infisicalSecret:
      enabled: true
      identityId: ...
      projectSlug: k3s-cluster
      path: /yosegaki/yosegaki-secrets
```

`values.yaml` に全部書いてある。秘密は `existingSecret` (既定 `yosegaki-secrets`) のキー `secret` `oidc-client-secret` `smtp-password` `turnstile-secret` で渡し、Infisical 純正 operator で引くなら `infisicalSecret` を有効にする。PVC には `helm.sh/resource-policy: keep` が付いていて、リリースを消しても DB は残る。

## API

すべて `/api/v1` 配下。エラーは常に `{"error": "rate_limited", "message": "..."}` の形。認証は 2 つのヘッダだけ。

- `X-Visitor: <端末ごとの乱数>` … 本人判定 (いいね、編集、自分宛ての返信)
- `Authorization: Bearer <token>` … 管理者

| メソッド | パス | 中身 |
|---|---|---|
| GET | `/comments?page=&sort=&limit=&offset=` | ページのコメント。返信も同じ配列に平らに入る (`parent_id` / `root_id`)。承認待ちは本人と管理者にだけ |
| POST | `/comments` | `{page, title, url, parent_id, name, email, website, body, notify}`。`hp` が埋まっていたら bot とみなして捨てる |
| GET / PATCH / DELETE | `/comments/:id` | 本人 (期限内) か管理者。返信が付いていれば墓標として残り、無ければ消える |
| PUT | `/comments/:id/like` | `{value: true\|false}`。何度送っても同じ |
| POST | `/preview` | `{body}` → `{body_html}` |
| GET | `/count?page=a&page=b` | 承認済みの件数 |
| GET | `/recent?before=&limit=` | サイト全体の新着 |
| GET | `/me/comments` `/me/replies` | 自分の投稿、自分宛ての返信 |
| GET | `/admin/me` `/admin/pending` `/admin/comments?q=&status=` | 管理者の確認、承認待ち、横断検索 |
| GET | `/admin/login?origin=` `/admin/callback` | (API 外) OIDC の入口と戻り先。ポップアップで使う |
| POST | `/admin/comments/:id/approve` | 承認 |
| GET | `/config` `/health` | 公開設定、死活 |

一覧系は `before=<id>` で続きを取る (新しい順)。本文は `body_html` (サニタイズ済み) と `body_md` の両方が返る。

## 開発

```sh
bun i
bun run dev          # 埋め込みを一度ビルドしてから SvelteKit の dev サーバ
bun run dev:widget   # 別ターミナルで埋め込みを監視ビルド
bun run check        # biome + svelte-check
bun test
```

http://localhost:5173 がデモページで、そのサーバ自身に埋め込みを貼ってある。[genkan](https://github.com/DAnything/genkan) があれば `docker compose up` で https://yosegaki.localhost 。

```
src/lib/server/   env / db (bun:sqlite) / comments (取得・投稿・削除) / markdown (marked + sanitize-html) / spam / auth / notify
src/routes/api/   エンドポイント。1 ファイル 1 パス
src/widget/       埋め込み (Svelte 5)。main.ts が入口、store.svelte.ts が状態、widget.css が同梱スタイル
widget-dist/      vite.widget.config.ts で作る生成物 (git には入れない)。routes/embed.js が配る
charts/yosegaki/  Helm チャート。CI が OCI で ghcr に push する
```
