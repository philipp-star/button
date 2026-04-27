# Press The Button — static webpage

Self-contained webpage version of the Curio Digital "Press The Button" game. Designed to be hosted on GitHub Pages and embedded into Airtable via the `curio_website` extension pattern (iframe), to avoid Airtable's bundle-size timeout.

## Files

| File | Purpose |
|---|---|
| `index.html` | Document. Loads Tailwind CDN + React 19 CDN + Babel-standalone + `styles.css` + `app.js` |
| `styles.css` | All custom keyframes (`pb-shockwave`, `pb-pulse`, `pb-emoji-fly`, `pb-hype`, `pb-confetti-fly`, `pb-news`) plus the `html/body` reset |
| `app.js` | Full game in JSX, transformed in-browser by Babel (`<script type="text/babel">`) |
| `music.mp3` | Licensed audio loop (Curio's Artlist license required to redistribute) |

No build step. Open `index.html` in a browser and it runs (Tailwind, React, and Babel all load from CDN).

## Local preview

```bash
cd C:\Users\52442\press_button_web
# any static file server works:
python -m http.server 8000
# then open http://localhost:8000
```

(Just opening `index.html` directly may fail because browsers block `fetch` from `file://` for the audio — serve it locally.)

## Hosting on GitHub Pages

1. Create a new public repo, e.g. `curio-press-button`
2. Drop these files into the repo root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `music.mp3`
   - `README.md` (this file)
3. Push to GitHub.
4. Repo → **Settings** → **Pages** → Source = `main` branch / `/ (root)` → Save
5. Wait ~30 seconds, GitHub gives you a URL like
   `https://<your-username>.github.io/curio-press-button/`
6. Visit the URL to confirm it loads.

## Embedding inside Airtable

You already have the `curio_website` extension that does iframe embedding with a configurable URL. Two options:

### Option A — point that extension at this URL
1. In the Interface Designer, select the `curio_website` extension on the page
2. Properties panel → set `siteUrl` = `https://<your-username>.github.io/curio-press-button/`
3. Done. The iframe loads from GitHub Pages, no extension bundle bloat.

### Option B — duplicate `curio_website` for this purpose
If you want both Curio.io AND the game to live on different pages, copy the `curio_website` folder, give it a new `blockId`, and set its default URL to the GitHub Pages URL.

## License notes

- The MP3 (`music.mp3`) is from Artlist and only redistributable under your active Curio Digital subscription. If the GitHub repo is **public**, anyone can download the file directly. To be safe, either:
  - **Use a private repo** + GitHub Pages (paid plans only support Pages on private repos), OR
  - **Replace `music.mp3`** with a CC0 / royalty-free track, OR
  - **Strip the `music.mp3`** and accept that the game runs without music when hosted publicly.

## How it differs from the Airtable extension version

- No `@airtable/blocks` SDK — pure React + DOM
- No bundle step — Babel transforms JSX in the browser at load time (slightly slower first-paint, much smaller download since the audio is a separate file streamed by the browser)
- Music is a real `<audio>` element pointing at `./music.mp3`, not a base64 data URI
- All Tailwind classes work via the play CDN with the Curio palette config inlined into `index.html`

## Updating

Edit `app.js` directly — no rebuild needed. Push to GitHub and refresh.
