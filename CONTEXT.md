# Project context

## What this is, in one paragraph

Take One is a browser game about running a scrappy AI-assisted film
production house: grind gigs as low-tier crew, save up credits and
reputation, Greenlight your own productions, cast an AI-voiced crew with
"persistent personalities," make creative calls (or freeform-improvise and
have the AI rate it), release films for ongoing residuals, and eventually
become a Producer who funds other people's productions. There's a shared
"world catalog" so films from different players/browsers pointed at the same
local adapter show up in one another's Catalog view with cross-player
ratings — a lightweight multiplayer layer without any real backend/database.

## Origin and scope

`ai_production_house_game_design.md` is the original, much larger pitch: a
"Twitch-meets-Netflix" AI filmmaking platform. This repository is explicitly
a **scoped-down, playable vertical slice** of that vision — not the full
product described in the design doc. When reading the design doc for
context, keep in mind large parts of it are aspirational/future scope, not
implemented here.

## Current state (as of this writing)

- Git history is short — 2 commits total: an initial bulk commit
  ("browser game + UE5.8 slice + local LLM adapter") followed by a
  polish commit adding the license, CONTRIBUTING guide, CI, screenshots,
  and an industry-standard README. This is an early-stage project, not
  one with a long iteration history to mine for conventions.
- The browser game is complete enough to play standalone, fully offline,
  with no backend running (deterministic local fallback generators stand
  in for the AI). This is the primary, always-available experience.
- The Node AI adapter and Unreal Engine slice are both real and functional
  but optional/additive — they upgrade the experience (live LLM text,
  real 3D-rendered set shots) without being required to play.
- No test framework or linter is configured. The only automated checks are
  `node --check` syntax validation (CI) and the adapter's own `--check`
  self-test plus a handful of curl-based smoke tests.
- No package.json exists anywhere in the repo — this is intentional
  (zero npm dependencies), not an oversight.

## Non-negotiable design constraints

These show up repeatedly across README.md and CONTRIBUTING.md and should be
treated as constraints on any new feature work, not just documentation:

1. **The AI executes, it never authors.** All AI-generated content (scenes,
   dialogue lines, cast suggestions) must be produced/validated against a
   fixed JSON schema (`Unreal/TakeOne/ServiceContract/scene-generation.schema.json`)
   before it's usable by a client. Free-form, unclamped LLM output should
   never reach the browser or the Unreal engine directly.
2. **No real-person likenesses. Original IP only.** Generated
   characters/scenes/scripts must not represent real people or existing
   copyrighted IP.
3. **The game must stay playable with zero backend.** Every AI-client call
   in `ai-client.js` has a deterministic local-fallback twin, and the Node
   adapter itself falls back to the same kind of deterministic generation
   when no LLM is configured. Don't add an AI-dependent feature that has no
   offline path — that breaks the "just open index.html" experience the
   whole project is built around.

## Why three separate runtimes instead of one

The split (browser game / Node adapter / Unreal project) exists so each
piece can be used independently: the browser game alone requires nothing;
adding the Node adapter upgrades text generation without requiring a game
engine; adding Unreal on top of that upgrades to real rendered 3D shots.
They're glued together only by HTTP and a shared JSON schema, not by a
monorepo build system — that's a deliberate simplicity choice, not a gap to
"fix" by unifying them into one build.

## Where to look for more

- `README.md` — user-facing pitch, quick start, screenshots.
- `PLAY_GUIDE.md` — how to actually play, feature-by-feature.
- `PROJECT_STATUS.md` — a snapshot of what's built vs. not.
- `CONTRIBUTING.md` — contribution conventions, including the
  schema-must-change-together-with-the-parser rule.
- `CLAUDE.md` — architecture map and dev workflow, written for an agent
  editing this codebase.
