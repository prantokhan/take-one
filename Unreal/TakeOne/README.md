# Take One — Unreal scene-generation vertical slice

This is the first playable implementation of the director-first idea:

1. The player describes a physical film set.
2. A scene generator returns a constrained scene specification.
3. Unreal creates ordinary, editable actors, lighting, fog, and a director camera.
4. The player can inspect the set with a free camera or preview the generated shot.

The AI proposes and builds the scene. It does not write the film or make the director's creative decisions.

## What is implemented

- UE 5.8 C++ project with no Blueprint dependency.
- Runtime director prompt panel.
- Provider-neutral HTTP scene-generation client.
- Versioned JSON Schema contract with bounds checking.
- Deterministic offline generator for development.
- Runtime construction of editable proxy geometry.
- Generated directional light, skylight, fog, ground, and Cine Camera.
- Free-camera inspection and generated-shot preview.
- Automatic fallback when the remote generator is unavailable.
- Unreal automation coverage for valid and invalid scene responses.

The current vertical slice deliberately uses Unreal primitive meshes as generated-asset proxies. Each object also carries an `asset_hint` describing the intended final object. The next asset pipeline can replace a proxy with a generated or licensed mesh without changing the director workflow.

## Verified toolchain

This project compiles with:

- Unreal Engine 5.8.1
- Visual Studio 2022 Build Tools / MSVC 14.44
- Windows SDK 10.0.26100.0
- .NET Framework 4.8.1 Developer Pack

## Run it

1. Open `TakeOne.uproject` with Unreal Engine 5.8.
2. Allow Unreal to compile the game module if prompted.
3. Press **Play**.

To rebuild explicitly from PowerShell, run:

```powershell
& 'E:\epicunrealEngine\UE_5.8\Engine\Build\BatchFiles\Build.bat' TakeOneEditor Win64 Development 'D:\Projects\piston1\Unreal\TakeOne\TakeOne.uproject' -WaitMutex -NoHotReloadFromIDE
```

The project begins in offline mock mode. Enter a set description and choose **Generate Editable Scene**.

Controls:

- `Tab`: show or hide the director panel
- `WASD`: move the free camera
- Mouse: look
- `Space` / `Left Ctrl`: move vertically
- **Preview Shot**: look through the generated Cine Camera
- **Free Camera**: return to inspection mode

## Exercise the HTTP boundary locally

Run the dependency-free mock service:

```powershell
node .\Tools\mock-scene-service.mjs
```

### Or run the live AI adapter

`Tools/ai-scene-service.mjs` implements the same contract plus narrative endpoints
(`/v1/director/beat`, `/v1/npc/line`, `/v1/cast/suggest`, `GET /v1/health`). With an
API key it calls a real LLM and clamps every response into the schema server-side;
without one it serves deterministic local generators. CORS is enabled for the web game.

```powershell
$env:TAKEONE_LLM_API_KEY = "sk-..."      # optional; omit for offline mode
$env:TAKEONE_LLM_MODEL = "gpt-4o-mini"   # any OpenAI-compatible model
node .\Tools\ai-scene-service.mjs        # listens on 127.0.0.1:8788
```

Then change this line in `Config/DefaultEngine.ini`:

```ini
bUseMockGenerator=False
```

The Unreal client will POST to:

```text
http://127.0.0.1:8787/v1/scenes/generate
```

The complete request and response contract lives in `ServiceContract/scene-generation.schema.json`. The mock service can also self-check:

```powershell
node .\Tools\mock-scene-service.mjs --check
```

## Connect a real AI generator

Keep the Unreal API unchanged and replace the local mock service with a server-side AI adapter that:

1. Accepts the request in `ServiceContract/example-request.json`.
2. Uses the director's prompt as the source of creative intent.
3. Constrains model output to `scene-generation.schema.json`.
4. Validates and clamps the model response server-side.
5. Returns a scene like `ServiceContract/example-response.json`.

Keep the model-provider credential on that server. Never package it in Unreal. If the scene service itself requires authentication, set `TAKEONE_SCENE_SERVICE_TOKEN` in the environment before starting the Unreal client.

For production, the service should return an immediate job ID for slow text/image-to-3D work, then stream progress and signed asset URLs. The synchronous endpoint in this slice is intentionally small enough for scene-layout generation.

## Code map

- `TakeOneSceneTypes.h`: versioned scene data model
- `TakeOneSceneJson.*`: request writer and defensive response parser
- `TakeOneSceneGeneratorSubsystem.*`: mock/HTTP generation boundary
- `TakeOneSceneBuilder.*`: converts generated scene data into Unreal actors
- `TakeOneGeneratedObject.*`: editable proxy object with semantic asset hint
- `TakeOneDirectorWidget.*`: director-facing prompt and camera interface
- `TakeOnePlayerController.*`: connects generation, scene building, and input
- `TakeOneAutomationTests.cpp`: scene-contract automation tests

## Next production milestone

Replace one selected proxy object end to end:

1. Generate a concept image from its `asset_hint`.
2. Send the approved image to a text/image-to-3D provider.
3. Import the resulting glTF/GLB through a controlled server-side conversion pipeline.
4. Create a Nanite-ready Unreal asset.
5. Replace only that proxy while preserving its ID, transform, and undo history.

That proves the central promise—AI generates the actual scene—without surrendering control of the set to an autonomous director.

**Interim step shipped:** the adapter now refines key proxies into compound
primitive geometry (LLM-decomposed when an API key is configured, keyword
heuristics otherwise), so lamp posts, trees, tables, towers and vehicles build
as multi-part dressed objects instead of single cubes — with zero client
changes, because refinement happens inside the schema contract. Set
`TAKEONE_REFINE=off` to disable.
