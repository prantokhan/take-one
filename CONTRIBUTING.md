# Contributing to Take One

Thanks for your interest in improving the game. This project keeps two hard
design rules — please respect them in any PR:

1. **The AI executes, never authors.** Model output must always be clamped
   into `ServiceContract/scene-generation.schema.json` (or the narrative
   response shapes) server-side before it reaches a client.
2. **Original IP only.** No real-person likenesses, franchises, or brands in
   generators, prompts, or content pools.

## Getting set up

```powershell
git clone https://github.com/Hamza-32/take-one.git
cd take-one
node Unreal/TakeOne/Tools/ai-scene-service.mjs --check   # adapter self-test
```

Optional: Ollama for live-model generation (see `PLAY_GUIDE.md`), and
Unreal Engine 5.8 for the C++ slice.

## Before you open a PR

- `node --check` every `.js` / `.mjs` file you touched
- `node Unreal/TakeOne/Tools/ai-scene-service.mjs --check` passes
- If you changed the UE `Source/`, state the engine version you compiled with
- If you changed the scene schema, update `ServiceContract/` **and** the
  parser/clamps in `TakeOneSceneJson.cpp` together

## Code layout

| Path | What lives there |
|---|---|
| `index.html` / `app.js` / `styles.css` / `ai-client.js` | The playable browser game |
| `Unreal/TakeOne/Tools/ai-scene-service.mjs` | AI adapter (generation, jobs, shots, video, world) |
| `Unreal/TakeOne/Source/TakeOne/` | UE 5.8 C++ slice |
| `Unreal/TakeOne/ServiceContract/` | Versioned scene JSON schema + examples |
| `docs/` | Screenshots |

PRs that add features should include a short note in the PR description on how
they were tested — a Playwright snippet or manual steps are both fine.
