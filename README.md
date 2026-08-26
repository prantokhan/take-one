# Take One — AI Production House

A playable AI filmmaking game: direct films in your browser, generate sets, cast,
and story with a **local LLM** (Ollama), build them as **real 3D sets in Unreal
Engine 5.8**, shoot them, and publish to a shared catalog — all free, no paid APIs.

![status](https://img.shields.io/badge/status-playable%20vertical%20slice-green)

## What it is

- **Browser game** — the full career loop: gigs → director → producer. Brief
  quizzes, timing-based execution, an AI set-prompt console, cast members with
  persistent personalities, story-beat improvisation, residuals, real flops.
- **AI adapter** (`Unreal/TakeOne/Tools/ai-scene-service.mjs`) — one dependency-free
  Node service that both clients speak to. Routes to a local LLM (Ollama or any
  OpenAI-compatible endpoint) and clamps every response into a versioned JSON
  schema. Falls back to deterministic generators when no model is configured.
- **Unreal 5.8 slice** (`Unreal/TakeOne/`) — C++ vertical slice: AI-designed sets
  built as editable actors with lighting, fog, performers, and a cine camera.
  Shoots a moving master (`R`) that streams back to the web catalog as encoded video.

## Quick start

```powershell
# 1. AI adapter (optional but recommended; leave running)
cd D:\Projects\piston1   # wherever you cloned
node Unreal\TakeOne\Tools\ai-scene-service.mjs

# 2. Play
start index.html
```

Optional local LLM:
```powershell
ollama pull qwen2.5:7b
$env:TAKEONE_LLM_BASE_URL = "http://127.0.0.1:11434/v1"
$env:TAKEONE_LLM_API_KEY  = "ollama"
$env:TAKEONE_LLM_MODEL    = "qwen2.5:7b"
node Unreal\TakeOne\Tools\ai-scene-service.mjs
```

Full setup (Unreal, FFmpeg video, shared world): see **[PLAY_GUIDE.md](PLAY_GUIDE.md)**.
Implementation status: **[PROJECT_STATUS.md](PROJECT_STATUS.md)**.
Design document: **[ai_production_house_game_design.md](ai_production_house_game_design.md)**.

## Architecture

```
Browser game ─┐
              ├─► ai-scene-service.mjs ──► local LLM (Ollama) or templates
Unreal 5.8 ───┘        │  validates & clamps every response into
   ▲                   │  ServiceContract/scene-generation.schema.json
   │ R = shoot moving  └─► /v1/jobs queue: web enqueues, UE claims & builds
   └──── /v1/films/shots → FFmpeg → catalog plays real MP4s
```

The game logic never talks to a model provider directly; the schema contract
keeps both clients safe from bad model output.

## Requirements

| Component | Required |
|---|---|
| Node.js 18+ | for the AI adapter |
| Any modern browser | to play |
| Unreal Engine 5.8 | only for the 3D slice |
| Ollama (or any OpenAI-compatible endpoint) | optional, for live generation |
| FFmpeg | optional, for MP4 encoding (`winget install Gyan.FFmpeg`) |

## Repo notes

Unreal `Binaries/`, `Intermediate/`, `DerivedDataCache/`, and `Saved/` are
intentionally not committed — UE rebuilds them from `Source/` on first open.
