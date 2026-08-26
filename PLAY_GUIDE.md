# Take One — Complete Play Guide

The full loop: **direct in the browser → your local LLM generates sets, cast, and story → Unreal Engine builds the set in real 3D.** Everything runs on your machine. No paid API required.

---

## 0. What you need installed

| Component | Required? | Purpose |
|---|---|---|
| Any modern browser (Chrome/Edge) | Yes | The playable game (economy, career, AI consoles) |
| [Node.js](https://nodejs.org) 18+ | Recommended | Runs the AI adapter (the shared "brain") |
| Unreal Engine **5.8** | Optional | Builds generated sets as real 3D scenes (`E:\epicunrealEngine\UE_5.8` on this machine) |
| [Ollama](https://ollama.com) | Optional | Free local LLM — powers novel AI text instead of templates |

---

## 1. Start your local LLM (free)

```powershell
ollama pull qwen2.5:7b        # once; any JSON-capable instruct model works
ollama serve                  # if not already running as a service
```

## 2. Start the AI adapter

```powershell
cd D:\Projects\piston1
$env:TAKEONE_LLM_BASE_URL = "http://127.0.0.1:11434/v1"
$env:TAKEONE_LLM_API_KEY = "ollama"          # any non-empty value; empty = offline templates
$env:TAKEONE_LLM_MODEL   = "qwen2.5:7b"
node Unreal\TakeOne\Tools\ai-scene-service.mjs
```

You should see: `LLM: enabled (qwen2.5:7b @ http://127.0.0.1:11434/v1)`.
(No Ollama? Skip the env vars and just run `node ...ai-scene-service.mjs` — everything still works with deterministic generators.)

## 3. Play the game (browser)

Open `D:\Projects\piston1\index.html`. Topbar chip should read **AI · live (<model>)**.

- **Studio → "Prompt the world"** — describe any set, watch it get built (+2 cr/cycle)
- **Gigs** — take work, answer the brief, hit the timing marks (Space)
- At **60 rep + 420 credits**: **Greenlight** a film — cast is generated with persistent personalities, and your key set spec auto-builds
- **Direct the set** — give performance notes to named cast, improvise story beats
- Release → residuals every **End cycle** → at **90 rep** the **Producer desk** opens
- Flops are real: score <50 loses money/reputation and crews pay you less until you recover

## 4. See your film's set in Unreal 5.8

1. Open `Unreal\TakeOne\TakeOne.uproject` → compile if asked → **Play**
2. In the web game, open any active production → click **"Build in Unreal"**
3. Within ~3 seconds the UE window clears and constructs the LLM-designed set — meshes, lighting mood, fog, and an AI-placed director camera. Press **Preview Shot** to see it framed.
4. **Press `R` in Unreal** → it shoots a **moving master**: a 12-frame continuous 360° orbit of the set (with performers staged in frame), streamed back to the adapter.
5. Back in the browser: your production's catalog card and film page show **real UE-rendered motion** — the film page plays the orbit as a looping shot, with a "moving master" badge.
6. You can also type prompts directly in UE's own panel (`Tab`) — same adapter, same model.

The bridge works through a job queue: web enqueues → adapter generates/validates → UE claims and builds → `R` shoots stills → web displays them. No engine restarts needed.

## 5. Watch your films as real video

When UE has shot a moving master, the adapter FFmpeg-encodes it to MP4 on
demand and the film page plays an actual `<video>` — no flipbook needed.
FFmpeg is required on the adapter host:

```powershell
winget install Gyan.FFmpeg        # once
```

(Without it you still get the frame-flipbook playback.)

## 6. Shared world (multiplayer-lite)

Every browser gets a director identity (`Director-XXXX`). Released films are
published to the adapter's shared catalog; every connected player sees the
whole player base's films in their catalog (marked with view counts and
creator), and ratings you give travel back to the source player's score.
Run one adapter on a LAN box and point everyone's `take-one-ai-url`
(localStorage) at it — that's a persistent shared world per the design doc.

## 7. Local 3D-model generation seam

The adapter exposes `POST /v1/assets/generate {prompt}`. Point it at a
self-hosted open checkpoint server (Hunyuan3D 2.x, TRELLIS, Shap-E — needs a
16GB+ GPU) via `TAKEONE_3D_BASE_URL`; expected contract: `POST {prompt} →
{glb_base64}` or `{url}`. Until configured it reports 501 honestly rather
than pretending.

## 8. Troubleshooting

- **Chip says "AI · offline"** — adapter isn't running or port blocked. Check the console window from step 2.
- **Chip says "adapter (local gen)"** — adapter runs but no LLM configured (env vars missing).
- **UE builds nothing** — confirm `bConsumeRemoteJobs=True` in `Config/DefaultEngine.ini` and that the adapter console logs `Queued job_...` when you click Build.
- **Ollama timeouts / broken JSON** — small models sometimes fail JSON mode; the adapter silently falls back to local generation. Try `qwen2.5:14b` or larger.
- **"ffmpeg not available" (501)** — install FFmpeg or set `FFMPEG_PATH`; the adapter auto-detects WinGet installs.
- **Tiny test frames fail to encode** — libx264 needs even dimensions ≥ 2; real UE frames are 1280×720 and always fine.
- **Running the adapter inside a restricted dev sandbox** may block spawning ffmpeg; on a normal shell it works as documented here.

---

### Architecture (why this stays Option A)

```
   │ R = shoot moving  └─► /v1/jobs queue: web enqueues, UE claims & builds,
   │   master (12 frames)   stages performers, orbits the camera, and refines
   │                        key objects into compound geometry (lamp poles +
   │                        shades + glows, tree trunks + canopies, table
   │                        tops + legs — LLM-decomposed or heuristic)
   └──── /v1/films/shots: rendered frames flow back and play as motion

Set TAKEONE_REFINE=off to disable object refinement.
```

The game logic never talks to a model directly; the schema contract keeps both clients safe from bad model output.
