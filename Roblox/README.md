# Take One — Roblox MVP

A minimal, playable-FPV port of one feature from the browser game and the
Unreal slice: walk around a set that gets built from a text prompt. This is
**not** a port of the full game (gigs, Greenlight, catalog, economy) — just
the walkable-set piece, since that's what was asked for and what's realistic
to stand up quickly on Roblox. See [../CONTEXT.md](../CONTEXT.md) and
[../CLAUDE.md](../CLAUDE.md) for the full project's scope.

## Why Roblox for this

Unlike the [Unreal slice](../Unreal/TakeOne) (which needed ~250 lines of
hand-written C++ for capsule collision, WASD movement, mouse-look, and a
first-/third-person toggle — see `TakeOneWalkPawn`), Roblox's default
character (`Humanoid` + its camera) already provides all of that. The only
code here is: a deterministic scene generator (ported from `ai-client.js`'s
offline fallback, so "prompt → set" needs no backend) and the small UI to
drive it.

## What's here

```
default.project.json                                  — Rojo project file
src/ReplicatedStorage/Modules/SceneGenerator.lua       — prompt -> part-spec table (deterministic, offline)
src/ServerScriptService/BuildSceneHandler.server.lua   — builds real Parts in Workspace from a prompt
src/StarterGui/PromptTheWorld/PromptGui.client.lua     — press P, type a prompt, hit Generate/Enter
src/StarterPlayer/StarterPlayerScripts/FirstPersonCamera.client.lua — locks camera to first-person
```

## Running it (needs Roblox Studio — I can't launch this myself)

1. Install **Roblox Studio** (free, ~2 minute install, no engine source
   download or account-linking beyond a normal Roblox account) —
   https://create.roblox.com/
2. Install the **Rojo** Studio plugin (free) — either from the Roblox
   plugin marketplace inside Studio, or via the
   [Rojo docs](https://rojo.space/docs/) if you want the CLI too.
3. Open Studio, start from the **Baseplate** template (gives you a floor
   and a `SpawnLocation` — this project doesn't create its own spawn).
4. In the Rojo plugin, click **Connect**, then run `rojo serve` from this
   `Roblox/` folder in a terminal (or use Rojo's "Open Project" flow if
   you're on a Rojo version that supports it without the CLI).
5. Press **Play**. You should spawn locked into first-person view.
   - **WASD** — move (built into Roblox's default Humanoid, no code here)
   - **Space** — jump (same, built-in)
   - **Mouse** — look around (same, built-in)
   - **P** — open the "Prompt the world" panel, type a description,
     press **Enter** or click **Generate set**
   - The set builds ~60 studs from spawn and teleports you to it

## Known gaps / things to check on first run

I wrote and reasoned through this code but **could not run Roblox Studio
in the environment I authored it in** (no GUI/display available there) —
same caveat as the Unreal C++. Likely things to check:

- `Enum.PartType.Wedge` doesn't exist — wedges use a separate `WedgePart`
  instance, which `BuildSceneHandler.server.lua` does create correctly,
  but double-check the geometry reads sensibly in-scene (wedges rotate
  differently than blocks around the same pivot).
- Cylinder orientation (`CFrame.Angles(0, 0, math.rad(90))`) — verify
  cylinders actually stand upright rather than lying on their side; Roblox
  cylinders default to lying along local X.
- `SceneGenerator`'s `bit32` usage assumes standard Luau `bit32` semantics
  (unsigned 32-bit) — should be fine on current Roblox, but worth a quick
  sanity check that colors/positions look intentional rather than garbled
  for a few different prompts.
- No collision tuning was done beyond `CanCollide = true` — dense prompts
  (`count` up to 15 dressing elements) could plausibly spawn overlapping
  geometry the player gets stuck in; worth testing a "busy" prompt.
