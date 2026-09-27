# Take One — group movie-making session design

Scoping doc for turning the current single-mechanic MVP (walk around one
shared, overwritable prompt-generated set) into something a group of ~10-12
kids can actually use to "make a movie" together in one Roblox server. Not
implemented yet — this is the plan to review before building.

## Constraint that shapes everything: no native video export

Roblox scripts have no video-encoder API — a `Script` cannot produce an
`.mp4` or any video file. **This design uses OBS (or Xbox Game Bar, or any
other screen recorder) as the actual recording tool**: one kid runs it on
their own PC and captures the live performance while it happens. Roblox's
job is to make that capture session easy to run and coordinate — a live
"take" with a countdown and clear on-screen state — not to solve recording
itself.

This means there's no in-engine recorder/replayer to build. What Roblox
*does* need to add is: something for the camera operator to actually frame
a shot with (a free-fly camera, not the walking first-person view), and a
lightweight "take" cue system (countdown, REC indicator, take counter) so
the OBS operator and the actors stay in sync about when a take is actually
rolling — the game-side equivalent of a director calling "action."

## Session model

One Roblox server = one production. A `SessionState` (new
`ServerScriptService` module) replaces the current single global
`Workspace.GeneratedSet` with:

```
SessionState = {
  director: Player?,        -- one player, assigned at session start
  roles: { [Player]: "Director" | "Actor" | "Camera" | "Crew" },
  scenes: {
    [sceneIndex] = {
      prompt: string,
      folder: Folder,       -- this scene's generated set, kept (not
                             -- destroyed) once built
      takeCount: number,    -- how many times "Action" was called on this
                             -- scene, just a counter for the slate/HUD
    },
  },
  activeScene: number,
  takeState: "idle" | "countdown" | "rolling",
}
```

### Why scenes must stop overwriting each other

Today, `BuildSceneHandler` destroys and rebuilds one shared
`Workspace.GeneratedSet` folder on every prompt — the current design's
biggest group-use problem: any player's prompt erases whatever the group
was just standing in. The fix is structural, not cosmetic: each generated
set becomes its own named scene folder (`Scene_1`, `Scene_2`, ...) that
persists in `Workspace.Scenes`, and only one scene is *active/visible*
(others `Folder.Parent = nil`'d out, not deleted) to keep the world
navigable and performant. Switching the active scene is an explicit action
(director advances to "next scene"), not a side effect of someone typing a
prompt.

### Roles

- **Director** (1 per session, assigned when the session starts — first
  player in, or a lobby pick): the only role that can prompt new scenes,
  advance the active scene, and start/stop a take recording. Everyone else
  can still walk around and act, but can't reset the world out from under
  the group.
- **Actor** (however many): just plays the game as it exists today —
  walks, performs in-frame during a take.
- **Camera** (0-2): during a take, possesses a free-flying camera pawn
  (a plain `ADefaultPawn`-style free camera, not the walking character) so
  someone can actually frame a shot rather than everyone being stuck at
  their own eye height. This is the role whose screen the OBS capture is
  usually pointed at.
- **Crew** (everyone else, or a catch-all): can walk the set, help block
  scenes, but has no special powers. Not a hard gate — this is about
  making the *default* not-conflicting, not enforcing strict permissions
  with a real security model (this is a casual group session, not a
  production with a trust boundary).

Role assignment: simplest version is a lobby `ScreenGui` shown before the
session starts — each player picks Director/Actor/Camera/Crew from a list,
first pick wins Director, no re-picking once taken. No need for anything
fancier for a one-off group session.

## The actual "make a movie" loop

1. **Lobby**: players join, pick roles. Director gets a distinct HUD
   (prompt console + take controls); everyone else gets the normal
   walk-around HUD.
2. **Director prompts a scene**: same `SceneGenerator`/`PromptGui` as
   today, but writes to a new named scene folder instead of clearing the
   old one. Scene becomes active; everyone gets teleported/notified.
3. **Blocking**: actors position themselves in the scene while it's active
   (just walking — no new mechanic needed here for a v1). Whoever's on
   Camera duty gets into position with the free-fly pawn and frames the
   shot.
4. **Roll camera**: the kid on Camera duty starts their OBS/Game Bar
   recording on their own PC — this is the actual "recording," entirely
   outside Roblox.
5. **Take**: Director presses "Action." A synced 3-2-1 countdown shows on
   every player's screen (so actors know exactly when the take starts, and
   the Camera operator knows exactly when to be rolling in OBS already),
   then a "REC"/take-number indicator shows for the duration. Actors
   perform live. Director presses "Cut" when done — this just clears the
   REC indicator and bumps the scene's `takeCount`; nothing is captured by
   Roblox itself.
6. **Repeat 3-5** for as many takes of a scene as the group wants — cheap,
   since nothing needs to be saved/managed on the Roblox side between
   takes; whichever OBS recording the group likes best is "the take" by
   virtue of existing as a file on that kid's PC.
7. **Repeat 2-6** for as many scenes as the group wants to shoot.
8. **Assembly**: happens entirely outside Roblox — the group's saved OBS
   clips get trimmed/ordered into a finished video with whatever editor
   they already have (even just picking clips in order and gluing them, no
   real editing skill required for a first movie). Not this project's
   problem to solve.

## What this explicitly does NOT attempt (v1 scope cut)

- Any in-engine recording/replay/export — deliberately punted to OBS per
  the constraint above; Roblox only provides the countdown/cue system.
- Dialogue/voice — no lines, no lip sync, no AI-voiced NPCs (that's the
  browser game's `openDirectSet`/AI cast feature; porting it is a separate,
  larger effort and not needed for a first playable group session).
- Costumes/character customization — everyone's default avatar. Fine for
  v1; easy to add later (equip accessories from the Roblox catalog) without
  touching the session/recording architecture.
- Real permissions/anti-grief hardening — Director-only prompt/take-control
  is a convention enforced by the UI, not a hardened security boundary.
  Acceptable for a supervised group of 10-12 kids in one session; would
  need real hardening before any public/unsupervised deployment.
- Trimming/cutting, multi-angle cuts, music/sound, any real editing —
  that all happens in whatever external tool the group edits their OBS
  clips with, not in Roblox.

## Build order (once this design is approved)

1. `SessionState` module + lobby role-pick UI.
2. Non-destructive scene folders (fixes the current overwrite bug as a
   side effect — this is the most urgent existing problem regardless of
   the rest of this design).
3. Camera-role free-fly pawn — the operator needs somewhere to stand
   before there's a point building the countdown/cue system.
4. Countdown/"Action"-"Cut" cue system (synced HUD state for
   countdown/REC/take-number) — the actual new capability this design
   adds; everything past this point is "point OBS at the Camera role's
   screen and hit record."

Steps 1-2 are the highest-value, lowest-risk starting point: they fix the
one bug that actively breaks group use *today*, independent of whether the
cue system ever gets built. Recommend building and play-testing those
first before committing to steps 3-4.
