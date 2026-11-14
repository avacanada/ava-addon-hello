# Hello: your first Ava add-on

Hello is the smallest real add-on for [Ava](https://heyava.ca): a guestbook.
The person types a name in its panel, or asks Ava to "say hello to Ada in
Hello", and a greeting appears. That's all it does, on purpose: every file
here is one piece of the shape every add-on has, and this README walks
through them in order. Copy the repo and change it into yours.

It shows you how to make:
- a **manifest** that says who the add-on is and what it may ask for;
- a **panel**, the page the person sees beside the chat (plain TypeScript and
  the DOM, no framework);
- **one tool for Ava**, with an honest effect class;
- the add-on's **own storage**;
- **assets served from its own bundle**, as its Content-Security-Policy
  requires;
- a **listing** for the catalogue, the website and Ava's Settings.

It's built on [`@avacanada/ava-addon`](https://github.com/avacanada/ava-addon),
the SDK (types for `window.ava` and the manifest), and the official MCP Apps
SDK, [`@modelcontextprotocol/ext-apps`](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps).

```sh
npm ci --ignore-scripts
npm run check    # tsc
npm run build    # writes the add-on's bundle to dist/
npm test         # node --test (run after the build: one test checks dist/)
```

Node 24 or newer.

## What an add-on is

An add-on is a small web app that Ava runs in its own sandboxed webview. Its
page is an MCP server for Ava: technically an *MCP App view* (the MCP Apps
extension of the Model Context Protocol). Ava talks to it with JSON-RPC over
one bridge, both ways:

- the page asks Ava for things: its storage, the person's files (only what
  they gave it), a link opened, a request to a host it declared;
- Ava asks the page for its tools (`tools/list`) and calls them
  (`tools/call`) when the person asks her for something the add-on does.

The bundle is a folder of static files with `manifest.json` at its root.
Ava serves it from the add-on's own origin and nowhere else.

## The files, in the order to read them

| file | what it does |
|---|---|
| [`public/manifest.json`](public/manifest.json) | Who Hello is and what it may ask for. Copied into `dist/` as it is. |
| [`index.html`](index.html) | The page Ava opens (the manifest's `entry`). Loads `/ava.js`, then the app. |
| [`src/greetings.ts`](src/greetings.ts) | The guestbook: plain logic over the add-on's own storage. No DOM, no Ava. |
| [`src/tools.ts`](src/tools.ts) | The tool for Ava, and the MCP side: answering `tools/list` and `tools/call`. |
| [`src/main.ts`](src/main.ts) | The panel: draws the guestbook, and connects to Ava. |
| [`src/style.css`](src/style.css) | Wears Ava's colours, light and dark. |
| [`public/icon.svg`](public/icon.svg) | The icon in Ava's drawer (the manifest's `icon`). |
| [`listing/`](listing) | What the catalogue, heyava.ca and Ava's Settings show. Not part of the bundle. |
| [`vite.config.ts`](vite.config.ts) | Builds `dist/`: every asset a file, nothing inlined. |
| [`test/`](test) | The guestbook, the manifest and listing, the MCP round trip, and the built bundle. |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Runs `check`, `build` and `test` on every PR. |

### 1. The manifest

```json
{
  "id": "hello",
  "name": "Hello",
  "version": "0.1.0",
  "description": "A guestbook that says hello. …",
  "entry": "index.html",
  "icon": "icon.svg",
  "permissions": ["storage", "tools"],
  "egress": [],
  "tools": [{ "name": "greet", "effect": "inside", "description": "…", "input_schema": { … } }]
}
```

- **`id`**: 3 to 32 of `a-z`, `0-9` and `-`. `ava`, `ava-*`, `addis-*` and
  `marketplace` are Ava's own. Ava names the tool `hello_greet`, the id and
  the tool's name.
- **`version`**: the add-on's one version, here and nowhere else (not in
  `package.json`). Every release to the catalogue needs a new one.
- **`permissions`**: what Hello may ask Ava for, and so what Ava's install
  prompt tells the person. `files` (folders or files the person picks),
  `storage` (its own key/value store), `tools` (offer tools to Ava),
  `network` (reach the hosts in `egress`). Hello asks for `storage` and
  `tools` only.
- **`egress`**: the hosts it may reach, through Ava. Hello's is empty, so it
  can't reach the internet at all. `network` and a non-empty `egress` go
  together, or not at all.
- **`tools`**: every tool, with its **effect class** (below) and a JSON
  Schema for its input. The description is what Ava's model reads to decide
  when to call it, so say what it does and where the result goes.

Ava refuses a manifest with an unknown field or a broken rule before anything
of the add-on runs; [`test/manifest.test.ts`](test/manifest.test.ts) checks
the same rules here first.

### 2. The page

[`index.html`](index.html) loads `/ava.js` first. Ava serves that file in every
add-on's origin, matched to the Ava it runs in, and it sets up `window.ava`.
Never bundle a copy. `@avacanada/ava-addon` only types it:

```ts
import { ava } from '@avacanada/ava-addon'
const client = ava()          // throws outside Ava
```

### 3. Storage

[`src/greetings.ts`](src/greetings.ts) keeps every greeting under one key in
`client.storage`, the add-on's own key/value store (values are JSON). No
other add-on can read it, and it stays on the computer. Two things worth
copying:

- **What comes back from storage is checked, never trusted** (`fromStorage`):
  an older version of your add-on, or a bug, may have written something else.
- **Read-then-write changes run one at a time** (`serial`): Ava's tool and the
  panel can change the guestbook at the same moment, and both must land.
  [`test/greetings.test.ts`](test/greetings.test.ts) fails without it.

### 4. The tool, and its effect class

[`src/tools.ts`](src/tools.ts) builds the `tools/list` answer from the
manifest (one list, never two) and answers `tools/call`. Each tool has one of
three effect classes:

| effect | means | Ava |
|---|---|---|
| `read` | only looks | runs it without asking |
| `inside` | changes the add-on's own data: its storage, files it was given | runs it without asking |
| `outside` | reaches beyond the add-on: the network, a link | asks the person to approve every call |

`greet` writes to Hello's own storage and nothing else, so it's `inside`.
Be honest: the class is a promise to the person, and Ava holds you to it.

- The manifest's class is what counts. The MCP annotations the page sends
  (`readOnlyHint`, `openWorldHint`) are hints; when they claim more than the
  manifest, Ava takes the stricter of the two.
- Ava watches what a tool does while it runs. A `read` tool that writes the
  person's files becomes `inside`; a `read` or `inside` tool that reaches the
  network or opens a link becomes `outside`, and from then on every call
  waits for the person's approval.

A tool that fails answers with `isError` and a sentence (`callTool`), so Ava
can tell the person what went wrong. A thrown error never breaks the channel.
[`test/tools.test.ts`](test/tools.test.ts) plays Ava's part: it does the
handshake, lists the tools, checks each one's annotations against its
manifest class (by Ava's own rule), and calls `greet`.

### 5. The panel

[`src/main.ts`](src/main.ts) is plain DOM. It draws the newest 20 greetings,
counts the rest, and redraws when Ava's tool writes one. It connects to Ava
with the MCP Apps SDK:

```ts
const hello = view(handlers(book, () => void refresh()))
hello.connect(client.transport())   // the handshake: ui/initialize
```

The handshake brings Ava's theme and colours, as MCP Apps' standard CSS
variables (`--color-background-primary`…); `applyHostStyleVariables` takes
`ctx.styles.variables`. [`src/style.css`](src/style.css) uses them, with Ava's
own tokens as fallbacks, for light, dark and the system's choice.

### 6. Assets, and the Content-Security-Policy

Ava serves every add-on page with a strict CSP:

```
default-src 'self'; connect-src 'self'; img-src 'self' blob: data:;
media-src 'self' blob:; worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline'; font-src 'self'; form-action 'none'; base-uri 'none'; …
```

So everything the page uses is a file in the bundle:
- fonts come from `@fontsource` (DM Sans here) and are built into `dist/`,
  never loaded from Google Fonts or a CDN;
- `vite.config.ts` sets `assetsInlineLimit: 0`, because a font inlined as
  `data:` is refused (`font-src 'self'`);
- scripts are the bundle's own; there is no `fetch` to anywhere (`connect-src
  'self'`). Reaching a host goes through `client.net.fetch`, which needs the
  `network` permission and the host in `egress`.

[`test/bundle.test.ts`](test/bundle.test.ts) checks the built `dist/` for all
of that.

### 7. The listing

[`listing/listing.toml`](listing/listing.toml) is what the catalogue, heyava.ca
and Ava's Settings › Add-ons show: a category, an icon, a long description and
up to four screenshots. The name, version and short description stay in the
manifest. The catalogue reads `listing/` at the pinned commit, before your
build runs, and checks it: an SVG icon must be a picture only (no scripts, no
event handlers, no references outside itself), at most 64 KiB; screenshots are
PNGs of at most 1 MiB, 320–2560 by 200–1600 pixels.

## The security model, in short

- **A sandbox per add-on.** Each add-on runs in its own webview, in its own
  origin, under the CSP above. It can't see Ava's page, other add-ons or the
  disk.
- **One way out, and it's gated.** Everything that leaves the add-on goes
  through Ava's bridge: the person's files, the network, links, other
  add-ons. Ava knows which add-on is calling by its webview, never by
  anything the page says, and checks every call against the manifest and the
  person's grants. Calls are logged.
- **Files only by grant.** An add-on with `files` sees only the folders and
  files the person picks in Ava's own picker (`client.pickFolder()`). Each
  grant is a token, and the person can take it back.
- **The network only by `egress`.** With an empty `egress`, like Hello's, an
  add-on can't reach any host. With hosts listed (and `network`), it reaches
  those hosts only, through `client.net.fetch`.
- **Tools by effect class.** `outside` tools wait for the person's approval;
  a tool seen doing more than its class is made stricter (above).
- **What's installed is what was reviewed.** Catalogue packages are built from
  a pinned commit and signed; Ava checks the signature, and that the
  package's manifest asks for exactly what its install prompt showed.

## Run it in Ava, as a dev add-on

A debug build of Ava (from Ava's source) loads add-ons from its repo as well
as the installed ones: every `addons/<name>/dist/` that has a
`manifest.json`, and every folder in `addons/dev/`. Release builds never do.

1. Build Hello: `npm run build`.
2. In your Ava checkout, link this repo in as `addons/hello`, so Ava finds
   `addons/hello/dist/`:

   ```sh
   ln -s /path/to/ava-addon-hello /path/to/ava/addons/hello
   ```

3. Start Ava's debug build there (`bun run tauri dev`). Hello is in the
   add-on drawer. Open it, type a name, then ask Ava to "say hello to Ada in
   Hello".
4. After `npm run build`, close and reopen Hello's panel: Ava serves the
   bundle from disk. A manifest change needs Ava restarted, because Ava reads
   manifests when it starts.

Ava's debug build can also be driven by a script (`--data`, `--script` with
`open hello`, `tool hello_greet {…}`, `snap …`; see
`src-tauri/src/addons/dev.rs`), and its QA runner can run a suite with an
add-on in it (`qa/README.md`, "Add-ons").

## Publish it to the catalogue

Add-ons reach people through the signed catalogue,
[avacanada/ava-catalogue](https://github.com/avacanada/ava-catalogue). Its
README is the whole procedure; in short:

1. Your add-on is in its own repo, with a `package-lock.json`, and
   `npm ci --ignore-scripts && npm run build` writes the bundle to `dist/` with
   `dist/manifest.json`, as here. Pick your own `id`: `hello` is taken.
2. Open a PR on the catalogue that adds `addons/<id>.toml`, pinned to a full
   commit of your repo:

   ```toml
   repo = "you/your-addon"
   commit = "<the full 40-character SHA>"
   version = "0.1.0"                 # the manifest's version at that commit
   publisher = "Your name"           # shown as "From …" in Ava's install prompt
   permissions = ["storage", "tools"]
   egress = []

   [[tools]]
   name = "greet"
   effect = "inside"
   ```

   The permissions, tools and egress are repeated there on purpose: the
   reviewer reads, in the diff, exactly what Ava's install prompt will say.
3. The PR's CI builds your add-on from that commit in a clean directory,
   checks the built manifest against the entry and the listing, packs it,
   signs it with the test key and verifies it. A version that's already
   published can't change its bytes: every change needs a new version.
4. Once a reviewer merges it, the release signs it with the catalogue's key
   and publishes it, and Ava can install it.

## License

MIT, see [LICENSE](LICENSE). Copy it, change it, ship your own. (Hello and
the SDK are Ava's open-source teaching code: Ava APS 1, avacanada/aps#1.)
