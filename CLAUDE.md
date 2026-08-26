# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repository.

## What this is

**Take One** is a browser-playable game where you run a scrappy film production
house. Take gigs as low-tier crew, earn credits/reputation, then Greenlight
your own productions, hire cast, make creative calls (or freeform-improvise
with an AI-voiced cast), and release films for residual income. There is an
optional Unreal Engine 5.8 slice that can build a real 3D set from the same
AI-generated scene spec and shoot a short clip that appears back in the web
game. See [CONTEXT.md](CONTEXT.md) for the fuller background/vision and
current scope, and `ai_production_house_game_design.md` for the long-form
original pitch (this repo is a scoped-down "playable vertical slice" of it).

The one rule that shapes almost every design decision here, repeated in
README.md and CONTRIBUTING.md: **the AI executes, it never authors.** Every
AI-generated result (scene, line, cast suggestion) is clamped through a fixed
JSON schema before it reaches a client — see `ServiceContract/` and
`TakeOneSceneJson` in the Unreal source. Also: **no real-person likenesses,
original IP only.**

## Architecture at a glance

Three loosely-coupled pieces, talking to each other only over plain HTTP —
there is no bundler, no framework, no `package.json`, no build step anywhere
in the repo.

```
Browser game (index.html + app.js + ai-client.js + styles.css)
        │  fetch() over HTTP, base URL from localStorage "take-one-ai-url"
        ▼
Node adapter (Unreal/TakeOne/Tools/ai-scene-service.mjs, port 8788)
        │  optional: proxies to a local/remote OpenAI-compatible LLM (Ollama etc.)
        │  optional: enqueues jobs for —
        ▼
Unreal Engine 5.8 project (Unreal/TakeOne/) — polls /v1/jobs/next, builds a
3D set from the scene spec, shoots a 12-frame orbit, encodes to MP4 via
FFmpeg, uploads it back to the adapter for the web game to display.
```

1. **The web game** (root: `index.html`, `app.js`, `ai-client.js`,
   `styles.css`). Pure vanilla JS, no imports/exports, everything a global
   top-level function. `index.html` is a static shell (nav, topbar, an
   `#app-view` mount div, a `<dialog>` for modals, a toast stack);
   `app.js` renders every screen into `#app-view`/`#dialog-content` via
   template-string HTML and re-injects it (`innerHTML`) on every state
   change. Game state lives in one global mutable `state` object,
   persisted to `localStorage` after most mutations
   (key: `take-one-production-house-v1`). **This alone is fully playable**
   — with no backend running, `ai-client.js` transparently falls back to
   deterministic local generators (see below), so the AI chip just shows
   an offline/fallback state.

2. **The Node adapter** (`Unreal/TakeOne/Tools/ai-scene-service.mjs`,
   ~1089 lines, zero npm dependencies — only `node:http`, `node:crypto`,
   `node:child_process`, `node:fs/promises`, `node:os`). Run it with
   `node Unreal/TakeOne/Tools/ai-scene-service.mjs` (Node 18+). It serves:
   - `/v1/health`, `/v1/scenes/generate`, `/v1/director/beat`,
     `/v1/npc/line`, `/v1/cast/suggest` — AI generation endpoints, proxied
     to an OpenAI-compatible LLM if `TAKEONE_LLM_BASE_URL` /
     `TAKEONE_LLM_API_KEY` / `TAKEONE_LLM_MODEL` env vars are set, else
     served by the adapter's own deterministic offline generators (same
     approach as the browser fallback, so behavior is consistent whether
     or not a real LLM is attached).
   - `/v1/jobs`, `/v1/jobs/next` — the job queue the Unreal project polls.
   - `/v1/films/:id/...` — shot/video storage for Unreal-rendered clips.
   - `/v1/world/films`, `/v1/world/ratings` — the shared "world catalog":
     a lightweight multiplayer-lite layer where films published from any
     browser pointed at the same adapter show up in everyone's Catalog
     view with cross-player ratings.
   - `Unreal/TakeOne/Tools/mock-scene-service.mjs` — a lighter, offline-only
     stand-in used by CI/smoke tests.

3. **The Unreal Engine 5.8 project** (`Unreal/TakeOne/`) — fully optional,
   not required to play the browser game. C++ source in
   `Unreal/TakeOne/Source/TakeOne/`; the important files for the
   AI-integration boundary are `TakeOneSceneJson` (parses/validates/clamps
   the scene JSON — the Unreal-side half of "AI executes, never authors"),
   `TakeOneSceneBuilder`/`TakeOneSceneGeneratorSubsystem` (turn the spec
   into an actual 3D set), `TakeOnePerformer` (cast actors), and
   `TakeOneDirectorWidget` (in-engine prompt UI). It polls the same Node
   adapter's job queue, and on pressing `R` in-engine shoots a 12-frame
   orbit that gets FFmpeg-encoded and uploaded back for the web game to
   show on film pages.

### The scene JSON contract

`Unreal/TakeOne/ServiceContract/scene-generation.schema.json` (plus example
request/response JSON alongside it) is the single source of truth for the
shape of an AI-generated scene. **Both** the Node adapter's generators and
the Unreal C++ parser (`TakeOneSceneJson`) must agree with it. Per
CONTRIBUTING.md: if you change this schema, update the schema file, the
adapter's generators, and the Unreal parser together in the same change —
they will silently drift apart otherwise since nothing enforces this beyond
convention and the CI smoke tests.

## `app.js` map (2037 lines, single file, no modules)

Roughly, top to bottom:

| Lines | What's there |
|---|---|
| 1–8 | `STORAGE_KEY`, `images` (genre → key-art asset map) |
| 9–269 | `gigs` — gig definitions (brief + quiz questions) |
| 270+ | `baseFilms`, `assets`, `assetWorkByGig`/`scriptWorkByGig`, `openInvestments`, `genreCrewDemand`, `crewRates`, `roleGigSource` — static game-balance data |
| 353–398 | `productionStages` — the 4-stage Greenlight creative pipeline (options + effects + genre-fit per stage) |
| 400–520 | State management: `createDefaultState`, `loadState`/`saveState` (localStorage), `syncPortfolioAssetDrafts`, small pure helpers (`clamp`, `formatNumber`, `formatViews`, `escapeHTML`), `getRank`/`nextRankLabel`/`hasFlopStigma`/`availableGigCount` |
| 442–449 | Module-level mutable state: `state`, `currentView`, `catalogFilter`, `activeShootCleanup`, cached DOM refs |
| 520–541 | `addActivity`, `toast`, `setView` |
| 541–931 | View renderers, one per nav section: `renderApp` (dispatcher), `renderStudio`, `renderProducerDesk`/`investIn`, `renderGigRow`/`renderGigs`, `renderProductions`/`renderSlatePanel`, `renderCatalog`, `renderAssets`/`openPublishAsset` |
| 974–1332 | Event binding + core gameplay: `bindViewEvents` (wires all click handlers), `openDialog`, the gig flow (`openGig` → quiz → `startShootChallenge` timing minigame → `completeGig` scoring), end-of-cycle economy settlement (`settleAssetRental`, `settleInvestments`, `advanceCycle`, `refreshBoard`) |
| 1342–1917 | Production/Greenlight/AI-driven flows: `openGreenlight` (hire crew, pick script/genre), `openProductionStage` (the 4-stage pipeline), `composeSetPrompt`, `openDirectSet` (AI cast dialogue), `openWorldPrompt` ("prompt the world" set-generation console), `releaseProduction`, `openLiveSet`/`stopMotionPlayback` (moving-master shot playback), `openFilm` |
| 2006+ | `renderAiChip`, and bootstrap code: hooks `TakeOneAI.onStatusChange`, health-checks the adapter, assigns a random `Director-XXXX` identity, starts the 20s world-catalog poll, calls `renderApp()` |

Everything renders by building an HTML template string and setting
`innerHTML` — there's no virtual DOM, no diffing. Event handlers are
(re)bound in `bindViewEvents` after each render rather than via persistent
listeners, so if you add a new interactive element in a view's template you
must also wire it up in `bindViewEvents`.

## `ai-client.js` map (297 lines)

An IIFE exposing `window.TakeOneAI`, with three layers:

- **Transport**: `rawRequest` (fetch + `AbortController` timeout), `checkHealth`
  (`GET /v1/health`), `post` (POST that catches failures and transparently
  falls back — see below). Adapter base URL is read from localStorage key
  `take-one-ai-url`, default `http://127.0.0.1:8788`.
- **Endpoints**: `generateScene`, `directBeat`, `npcLine`, `suggestCast`
  (core AI features), `requestUnrealBuild`/`shotManifest`/`shotUrl`/`videoUrl`
  (Unreal-bridge), `publishWorldFilm`/`fetchWorldFilms`/`rateWorldFilm`
  (shared world catalog).
- **Local fallback**: `localFor` + `hashOf` (a small string hash used for
  seeded pseudo-randomness) mirror the adapter's own offline generators
  closely enough that gameplay looks the same whether or not the adapter is
  reachable. `post()` always returns `{ ...localFor(...), _fallback: true }`
  on any failure rather than throwing — **callers in `app.js` should expect
  every AI call to always resolve**, and can check `_fallback` if they need
  to distinguish real vs. local generation.

## Dev workflow

There is no build step and no test framework — the entire toolchain is
Node's own syntax checker plus a couple of hand-rolled scripts.

```bash
# Play the browser game standalone (fully offline-capable)
# — just open index.html in a browser.

# Run the AI adapter (optional but recommended)
node Unreal/TakeOne/Tools/ai-scene-service.mjs        # listens on :8788

# Adapter self-test (this is what CI runs)
node Unreal/TakeOne/Tools/ai-scene-service.mjs --check

# Syntax-check everything (what CI also runs, over every .js/.mjs file)
node --check app.js
node --check ai-client.js
node --check Unreal/TakeOne/Tools/ai-scene-service.mjs
```

For live LLM text instead of the deterministic fallback generators: install
[Ollama](https://ollama.com), `ollama pull qwen2.5:7b`, `ollama serve`, then
set before starting the adapter:

```bash
TAKEONE_LLM_BASE_URL=http://127.0.0.1:11434/v1
TAKEONE_LLM_API_KEY=ollama
TAKEONE_LLM_MODEL=qwen2.5:7b
```

For 3D sets: open `Unreal/TakeOne/TakeOne.uproject` in UE 5.8, Play, use
"Build in Unreal" in the web UI, press `R` in-engine to shoot. FFmpeg
(`winget install Gyan.FFmpeg`) is required to encode the moving-master shots
to MP4.

CI (`.github/workflows/ci.yml`) runs `node --check` over all `.js`/`.mjs`
files, plus the adapter's `--check` self-test and a few curl-based smoke
tests against `/v1/health`, `/v1/cast/suggest`, `/v1/jobs`, `/v1/jobs/next`.
There is no linter configured — match existing style by eye.

## Conventions worth knowing before editing

- **No modules.** Everything in `app.js` is a global top-level function or
  const. Don't introduce `import`/`export` or IIFE-wrap sections unless
  you're deliberately changing this — it would break the plain-`<script>`
  loading in `index.html`.
- **State shape lives in `createDefaultState()`.** If you add a new field to
  game state, add it there with a sensible default, and check
  `loadState()`/`syncPortfolioAssetDrafts()` for any migration logic needed
  so existing players' saved `localStorage` state doesn't break.
- **Every render is a full re-render.** Views are plain functions returning
  HTML strings; nothing tracks partial updates. If a new element needs a
  click/change handler, wire it in `bindViewEvents`, not inline in the
  template (the codebase doesn't use inline `onclick=` attributes).
- **Every AI call must have a local-fallback twin.** If you add a new
  `TakeOneAI` endpoint, add a matching deterministic generator case in
  `localFor` in `ai-client.js`, and ideally keep the adapter's own offline
  generator in `ai-scene-service.mjs` in sync — the whole point of this
  layer is that the game degrades gracefully with zero backend.
- **Schema changes are three-way.** Any change to the AI scene JSON shape
  needs to touch `ServiceContract/scene-generation.schema.json`, the
  adapter's generator/validation code, and `TakeOneSceneJson` in the Unreal
  C++ source together.
- **"AI executes, never authors"** and **no real-person likenesses /
  original IP only** are non-negotiable product constraints repeated across
  README/CONTRIBUTING — keep generated content within schema-clamped bounds
  and don't add features that let free-form AI output reach the client
  unvalidated.
