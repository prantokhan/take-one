# [Working Title] — AI Production House
### A Twitch-meets-Netflix filmmaking game built on a generative world engine

---

## 1. High-Concept

Players don't play *a* movie — they **make** movies, together, inside one persistent, AI-rendered world. Every role in real film production (actor, crew, writer, director, producer) is a playable job. Finished films are published to an in-game streaming catalog and rated by the whole player base. Popular productions can be watched live, Twitch-style, as they're being shot.

The "game" is the production pipeline itself. The AI's job is to execute what players direct — not to write or direct on its own.

---

## 2. Core Loop

```
Take a gig (Actor/Crew/Writer/Drone Op)
        ↓
Earn points + reputation
        ↓
Get hired for bigger/better projects
        ↓
Save enough points + reputation to Direct or Produce your own project
        ↓
Hire others → AI generates the film → Publish to catalog
        ↓
Viewers watch, rate, spectate live shoots → Revenue flows back to cast/crew/director/producer
        ↓
(loop continues — bigger reputation → bigger projects)
```

---

## 3. Role Hierarchy

| Tier | Role | Function | Entry Requirement | Payment Model |
|---|---|---|---|---|
| 0 (entry) | **Actor** | Performs scenes; AI generates the on-screen performance from their direction | None | Flat fee per gig + tips |
| 1 | **Writer** | Scripts, dialogue, structure | None (no on-set experience needed) | Flat fee per script, or royalty if produced |
| 1 | **Set Crew** | Locations, props, environment, lighting mood | A few completed gigs | Rental fees when assets are reused |
| 2 | **Drone Operator** | Aerial/establishing/chase shots | Some completed gigs (specialist) | Per-shot fee |
| 2 | **Videographer** | Ground cinematography, framing, pacing | Some completed gigs (specialist) | Per-project fee |
| 3 | **VFX Artist** | Post-production compositing, effects, color grade, creature/environment FX beyond what raw generation gives you | Portfolio of prior work (crew/videographer gigs) | Per-shot/per-project fee, premium-tier pricing |
| 3 | **Director** | Creative execution — hires crew, makes shot-by-shot calls, owns the film's creative reputation | Capital + reputation | Revenue share |
| 4 (capstone) | **Producer** | Bankrolls the project, assembles the deal, takes on financial risk | Real capital + track record of funded hits | Ongoing ownership stake in film's revenue |

**Progression philosophy:** Actor is the zero-dependency entry point everyone starts from. Every other role requires actors to exist first, which naturally teaches new players how production works before they take on responsibility. Director and Producer are earned, not chosen — you need both saved capital *and* a reputation trail to unlock them.

---

## 4. The Economy

**Points earned by:**
- Completing gigs (acting, crew work, writing, drone/camera work)
- Voting/rating other players' films (small reward — keeps the catalog side active)
- Contributing reusable assets (a set, a prop, a character model others can rent)

**Points spent by:**
- Hiring crew for your own project (as Director)
- Funding a project (as Producer)
- Renting assets (locations, props, character models built by other players)
- Unlocking premium AI-generation tiers (8K output, longer runtime, more complex VFX)

**Revenue loop (what closes the circle):**
Published films earn ongoing revenue from views/ratings. That revenue splits: Producer (largest ownership cut) → Director (creative revenue share) → cast/crew (smaller residual, proportional to role tier) → asset creators (rental royalties any time their asset is reused in *future* projects, not just this one).

This is the key mechanic that makes reputation matter long-term: a good asset or a good performance keeps earning passively, long after the original gig is done — same logic as real residuals.

---

## 5. Anti-Spam / Quality Mechanic

**Reputation cuts both ways.** A Director or Producer with poor ratings will struggle to hire good Actors/Crew for their next project — nobody wants a flop on their portfolio. This naturally discourages mass-producing low-effort films just to farm the points economy, without needing a hard content cap.

---

## 6. Distribution Layer (In-Game Netflix + Twitch)

- **On-demand catalog:** finished films get title cards, thumbnails, genre tags; discoverable via trending charts, ratings, genre browsing
- **Live spectate mode:** popular directors/productions can be watched *while being shot* — chat alongside other spectators, Twitch-style
- **Rating/review system:** drives the revenue split above, and feeds the reputation system that gates Director/Producer access

---

## 7. World & Generation Layer (the AI/technical backbone)

- **One persistent world-model map**, reskinned per project's theme/genre — same underlying physics and rendering engine (per the Unreal + neural rendering discussion), different art direction per film
- **AI's role is execution, not authorship:** it renders what's directed (shot composition, performance, VFX) — it does not write scripts or make creative decisions unprompted
- **No real-person likenesses:** actors are original AI-generated performers directed by the player, not likenesses of real actors/directors — avoids the legal/rights issues real named public figures would create, and keeps every asset genuinely player-owned
- **Original IP only:** genres, styles, and "inspired by" tones are fine (a moody nonlinear thriller, a martial-arts original hero); recreating a specific real person's name/likeness is out of scope for the reasons above

---

## 8. Open Design Questions (worth deciding before build)

1. **Producer creative veto** — does funding a project give the Producer power to override the Director mid-production (real studio-interference tension), or are they purely financial/hands-off once funded?
2. **Matchmaking mechanic** — how does a Director actually discover and book available Actors/Crew? (Job board? Algorithmic matching by reputation tier? Open applications?)
3. **Drone/Videographer skill-check** — do specialist shots have a success/fail roll tied to operator skill (adds gameplay texture), or is it a flat "hire = guaranteed good shot" execution?
4. **Asset royalty duration** — do rental royalties last forever, or decay over time/uses (prevents early players from permanently dominating the passive-income economy)?
5. **Genre-to-role demand mapping** — which genres inherently need which specialists (e.g., action = drone-heavy, drama = writer/actor-heavy) — useful for balancing the economy so no single role is universally optional.

---

## 10. Technical Stack

**Rendering/Engine Layer**
- **Unreal Engine 5** as the base — per the earlier research, this is where NVIDIA's neural tooling already plugs in (NNE abstraction layer, DLSS 4, ACE for NPC/character behavior, TensorRT for RTX inference acceleration). Building on an engine with that integration already maturing beats building a renderer from scratch.
- **Neural physics module** (NVIDIA-style) for the "cheap, fast, good-enough" physics layer — cloth, fluid, soft-body — rather than full traditional physics simulation on every frame.

**Generation Layer (the actual "AI world model" piece)**
- This is the hardest and least mature part of the whole stack, worth being honest about. Two real architectural choices exist, and they're not equally ready:
  - **(A) Traditional engine + AI-assisted content generation** — Unreal renders the scene normally; AI generates/suggests assets, dialogue, shot suggestions, NPC behavior (ACE-style) on top. **This is buildable today** with existing tools.
  - **(B) Full neural rendering** — no traditional geometry/rasterization at all, the model predicts every frame directly from player input (the DeepMind Genie-style approach). **This is still research-stage** — by DeepMind's own framing, visual quality isn't yet on par with Unreal Engine 5. Not viable as your v1 foundation.
  - **Practical read: start with (A), architect toward (B).** Ship on a traditional engine with AI-assisted generation now; treat full neural rendering as a v2/v3 upgrade path once the underlying research matures, not a v1 requirement.

**Data/Training Layer**
- Every completed production (scenes shot, choices made, ratings received) is itself training data — this is the same input→outcome pairing pattern from the whole conversation, just applied to *creative* choices instead of physics. A director's shot choices, an audience's ratings, an actor's performance style — logged and fed back to improve generation quality over time.
- This is also a plausible **secondary revenue stream**, same as Origin Lab's model: aggregated, consented creative-direction data has real value to AI labs building story/cinematography-aware generation models, separate from the game's own player-facing economy.

**Backend/Infrastructure**
- Server-side generation (per the earlier "AI will be server-side, not local" discussion) — thin client, heavy lifting in the cloud, likely GPU-cluster-backed given generation cost.
- Streaming delivery (GeForce NOW-style architecture) for both the "play/direct" experience and the "spectate a live shoot" Twitch-style layer.

---

## 11. How the World Model "Evolves With User Requirements"

This is the genuinely hard, unsolved part of the stack — worth being precise about the real mechanism rather than hand-waving it.

**What "evolves" actually has to mean, concretely:** the model needs to expand its capability set (new genres, new prop types, new shot styles) based on what players actually try to direct, not just get generically "better" over time.

**The realistic mechanism, in three stages:**

1. **Fine-tuning loop, not full retraining.** You don't retrain the whole world model from scratch every time a player wants a new capability — that's prohibitively expensive and slow. Instead, popular/successful player-directed scenes (ones with good ratings, meaning the generation "worked") become fine-tuning examples fed back into the base model on a regular cadence (weekly/monthly), gradually expanding what it handles well.
2. **Asset-library expansion as the near-term substitute for true model evolution.** In the early stack (Option A above — traditional engine + AI-assisted generation), "evolving with user requirements" mostly means an expanding, player-and-studio-contributed asset library (new props, sets, character models get added faster than the core model itself needs to change) — same as how a real game engine's *content* grows without the engine's *core* needing to be rebuilt.
3. **True adaptive world-model behavior (Option B, later-stage) requires online/continual learning research that isn't solved yet.** A model that genuinely reshapes its own generation behavior in near-real-time based on aggregate player direction is a real, open ML research problem — continual learning without catastrophic forgetting (the model losing old capabilities while gaining new ones) is one of the harder unsolved problems in the field. Don't build a v1 business plan assuming this works smoothly — treat it as a research bet, not a guaranteed roadmap item.

**The honest bottom line:** "the model evolves with user requirements" is achievable in a *limited, human-supervised, periodic fine-tuning* sense starting now. A model that *autonomously and continuously* reshapes itself in real time based on player behavior is not something anyone has fully solved yet — including the frontier labs (DeepMind, OpenAI, etc.) working on exactly this class of problem. Plan the business assuming the slower, human-in-the-loop version; treat the fully autonomous version as long-term upside, not a launch dependency.

---

## 9. Why This Design Holds Together

Every mechanic in this doc maps to something already proven or already real:
- The gig economy layer mirrors Google's Crowdsource/TaskMate model (real, live, paid microtask apps)
- The world-model rendering layer maps to the physics/engine discussion (Unreal + neural rendering, action→outcome data pairing)
- The role hierarchy mirrors how real film crews are actually structured and how real careers progress through them
- The revenue/residual system mirrors real entertainment-industry economics (residuals, ownership stakes, reputation-gated access)

Nothing here requires inventing a new business model — it's an existing, validated pattern (pay real people for real contributions, let a generative engine handle execution) wrapped in a coherent film-industry theme.
