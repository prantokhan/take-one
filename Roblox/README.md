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

## Verified via live play-testing (Roblox Studio MCP)

Unlike the Unreal C++, this was actually played, not just reasoned about —
via Roblox Studio's built-in MCP server (Assistant → Manage MCP Servers),
connected to and driven directly from this environment. Confirmed working
end-to-end: spawn locked into first-person → press P → panel opens → click
the TextBox → type a prompt → press Enter → server builds a real, collidable
Part set in Workspace → GUI closes → player teleports to the new set → night
lighting triggers correctly for prompts with "midnight"/"dark"/etc.

Two real bugs were found and fixed this way (both fixed in the current
source, not left as gaps):

1. **Enter didn't submit.** `MultiLine = true` TextBoxes don't fire
   `FocusLost(enterPressed=true)` on Return — Return just inserts a newline
   instead. Fixed by handling Return explicitly via
   `UserInputService:GetFocusedTextBox()` rather than relying only on
   `FocusLost`.
2. **Clicks on the panel silently did nothing.** `LockFirstPerson` camera
   mode keeps the mouse locked to screen center for camera look, and
   Roblox's built-in camera controller re-asserts that lock every frame —
   so setting `MouseBehavior` once when the panel opened was immediately
   overwritten. Fixed by also switching `workspace.CurrentCamera.CameraType`
   to `Scriptable` while the panel is open (pausing the built-in
   controller), restored to `Custom` on close.

## Remaining things worth a look

- `Enum.PartType.Wedge` doesn't exist — wedges use a separate `WedgePart`
  instance, which `BuildSceneHandler.server.lua` does create correctly, but
  wedge orientation relative to other primitives around the same pivot
  wasn't specifically eyeballed.
- Cylinder orientation (`CFrame.Angles(0, 0, math.rad(90))`) renders
  without errors, but wasn't specifically confirmed upright vs. on its side
  for every seed — Roblox cylinders default to lying along local X.
- No collision tuning was done beyond `CanCollide = true` — a dense prompt
  (`count` up to 15 dressing elements) could plausibly spawn overlapping
  geometry the player gets stuck in; only a couple of prompts were tested.
