# Take One — Project Status Checklist

_Last updated: this session. Verified by automated browser tests, engine builds, and live endpoint checks._

---

## ✅ IMPLEMENTED & VERIFIED

### 1. Web game core (index.html / app.js / styles.css)
- [x] Gig system: 6 gigs across 5 roles (Actor, Writer, Set Crew, Drone Op, Videographer, VFX)
- [x] Brief quiz (creative choices) + timing minigame (execution) → combined take score
- [x] Reputation + credits economy with real fail states (flops lose rep and pay)
- [x] Flop stigma: recent flop (<50 score) cuts gig pay to 75% until recovery
- [x] Greenlight flow: title, script picker, genre, specialist crew hiring (paid up front), 3 budget tiers
- [x] Genre→role demand mapping (§8 Q5): missing key specialists cost audience score
- [x] 4-stage production pipeline with genre-fit bonuses (committed choices only)
- [x] Stage improvisation: write free-form direction, engine rates it 2–9
- [x] Release economics: gross → 20% crew residuals → producer; per-cycle streaming residuals after
- [x] End-cycle settlement: residuals + asset royalties + investment distributions
- [x] Asset library: drafts from high-quality crew/VFX takes, publish with license tiers
- [x] Royalty decay (§8 Q4): −25% per 4 uses past 12
- [x] Ratings feed back into audience scores; catalog sorted by score
- [x] Producer desk (rep 90): fund NPC productions, fixed odds/yields, multi-cycle payouts, rep swings
- [x] Live-watch participation reward (once per cycle), rotating featured production
- [x] Writer loop: writer gig ≥56 delivers a script to library → +6 quality at greenlight
- [x] Mobile nav complete (5 views), localStorage save with field migration

### 2. AI systems (adapter + browser client)
- [x] `ai-scene-service.mjs`: OpenAI-compatible LLM adapter (any provider/local endpoint)
- [x] `POST /v1/scenes/generate` — schema-constrained set generation, server-side clamping
- [x] `POST /v1/director/beat` — adaptive story beats (Hidden Door/Muse-style)
- [x] `POST /v1/npc/line` — persistent-personality performances (Inworld-style)
- [x] `POST /v1/cast/suggest` — original cast generation
- [x] Graceful fallbacks at every layer (LLM → adapter local → browser local)
- [x] `ai-client.js` browser wrapper with health detection + topbar status chip
- [x] CORS + optional bearer token auth
- [x] Object refinement ("text-to-3D local edition"): key proxies decomposed into
      compound geometry (LLM or keyword heuristics), budget-capped, `TAKEONE_REFINE=off` switch
- [x] World-prompt console available to all players (no tier gate), +2 cr/cycle reward

### 3. Unreal Engine 5.8 slice (TakeOne)
- [x] C++ project, no Blueprint dependency; compiles clean (verified 3×)
- [x] Director prompt panel → scene spec → editable actors (meshes, sun, skylight, fog, Cine Camera)
- [x] HTTP generation with schema validation + deterministic offline fallback
- [x] Remote job poller: builds sets prompted from the web game (2.5 s tick)
- [x] Film-id + cast-count carried through job claims
- [x] Performer actors (torso+head proxies) with idle sway/breath, staged per cast size
- [x] Moving master: `R` shoots a 12-frame continuous 360° orbit → PNG → upload
- [x] Automation tests for the scene contract
- [x] Config unified on port 8788, `bConsumeRemoteJobs=True`

### 4. Bridge & media pipeline
- [x] Job queue: `POST /v1/jobs` / `GET /v1/jobs/next` (FIFO, single claim)
- [x] Web "Build in Unreal" → UE constructs the set in ~3 s (verified)
- [x] Scene spec JSON export
- [x] Shot storage + manifest + PNG serving (`/v1/films/:id/...`)
- [x] FFmpeg encode-on-demand → real MP4 (`/v1/films/:id/video.mp4`) — verified valid output
- [x] Film pages auto-upgrade flipbook → `<video>` playback with "encoded film" badge
- [x] FFmpeg installed on this machine (winget Gyan.FFmpeg 9.0) + WinGet path auto-resolution

### 5. Shared world (multiplayer-lite)
- [x] Persistent director identity per browser (`Director-XXXX`)
- [x] Releases publish to shared catalog; all players see all films (creator credit, world tag)
- [x] Cross-player ratings adjust source film scores server-side
- [x] 20 s catalog refresh while on Watch view

### 6. Local AI stack (this machine)
- [x] Ollama running with qwen2.5:7b (verified live generation)
- [x] Adapter verified: `LLM: enabled (qwen2.5:7b)`, ffmpeg resolved
- [x] End-to-end LLM cast generation verified ("Zorix, Enigmatic Explorer…")

### 7. Docs & tooling
- [x] `PLAY_GUIDE.md`: setup (Ollama/adapter/Unreal), gameplay loop, troubleshooting
- [x] `ServiceContract/scene-generation.schema.json` + examples (pre-existing, maintained)
- [x] UE README updated (AI adapter + refinement milestone)
- [x] Node syntax checks + Playwright browser test suite used throughout

---

## ⬜ REMAINING (honest gaps)

### Needs hardware (GPU)
- [ ] **True image/3D model generation** — seam ready (`TAKEONE_3D_BASE_URL`,
      `/v1/assets/generate`); needs self-hosted Hunyuan3D 2.x / TRELLIS / Shap-E
      (16 GB+ VRAM). Until then: refined primitives, not real meshes.

### Needs engineering weeks (not money)
- [ ] **Live multiplayer netcode** — shared-world catalog is async; co-presence,
      live spectate chat, and UE replication are dev-weeks
- [ ] **Video via Movie Render Queue** — current moving master is a 12-frame orbit
      sequence (6 s @ 6fps); true sequenced shots with cuts need MRQ integration
- [ ] **Characters with real performance** — performers are silhouettes with idle
      motion; skeletal animation/lip-sync is a separate pipeline
- [ ] **Text-to-3D proxy replacement** — README milestone: glTF/GLB import →
      Nanite asset swap preserving ID/transform

### Content & polish
- [ ] Content volume: ~6 gig types / 3 genres / 3 investment deals (vertical-slice depth)
- [ ] Balance tuning over long play sessions (economy curve verified mathematically, not playtested for fun)
- [ ] Catalog films for NPC studios use static key art (only player films get rendered footage)
- [ ] Sound design (none anywhere)
- [ ] Live-spectate chat (Twitch-style layer from §6) — stub only

---

## ▶ HOW TO RUN (per session)

```powershell
# 1. Ollama (usually auto-runs; skip if `ollama list` works)
ollama serve

# 2. Adapter (one PowerShell window, leave open)
cd D:\Projects\piston1
$env:TAKEONE_LLM_BASE_URL = "http://127.0.0.1:11434/v1"
$env:TAKEONE_LLM_API_KEY = "ollama"
$env:TAKEONE_LLM_MODEL = "qwen2.5:7b"
node Unreal\TakeOne\Tools\ai-scene-service.mjs

# 3. Game: double-click index.html  (chip = "AI · live (qwen2.5:7b)")

# 4. Unreal (optional, for 3D sets): open Unreal\TakeOne\TakeOne.uproject → Play
#    R = shoot moving master when a set is built
```

`EADDRINUSE` when starting the adapter = it's already running (fine).
