# CLAUDE.md — Take One movie-to-3D pipeline

Guidance for Claude Code (or any agent) working in `pipeline/`.

> **Scope note.** This is a *component* of the Take One repo, not the whole
> repo. The root [`../CLAUDE.md`](../CLAUDE.md) documents the browser game,
> the Node adapter, and the Unreal slice — a different codebase with
> different conventions (vanilla JS, no modules, no build step). Nothing in
> this file applies there, and nothing there applies here. This directory is
> Python, has a test suite, and has enforcement gates.

## What this is

An experimental pipeline that converts video (public domain films,
commissioned capture, licensed footage) into game-ready 3D assets for
Roblox, Unity, and Unreal:

1. Extract frames from video with metadata
2. Run SfM (COLMAP / GLOMAP) to get camera poses
3. Produce dense reconstructions (mesh or point cloud)
4. Export Roblox-compatible assets (decimated, LOD, SurfaceAppearance)

**Stage 1 (extract) is written and tested.** Stages 2–4 are not. The
reconstruction toolchain (COLMAP + GLOMAP + ffmpeg) is installed and
verified end-to-end on synthetic footage — see `configs/toolchain.json` —
but no Python wrapper drives it yet. See Status below.

## Legal boundaries — read first

- ✅ ALLOWED: public domain films, CC-licensed content, government/NASA
  footage, Blender open movies, commissioned capture with model releases,
  explicitly licensed stock.
- ❌ FORBIDDEN: YouTube, Street View, modern films, scraped content,
  anything without a verifiable license in `sources.json`.
- US public domain cutoff is **95 years after publication**, and it moves
  every Jan 1. Do **not** hardcode a year. The `next_review_date` field in
  each record is authoritative, and preflight fails when it goes stale.
- Internet Archive "PD" tags are **uploader-asserted**, not verified. Treat
  IA metadata as a lead, not a license. Preflight rejects
  `verified_by: uploader` / `internet_archive` / `unknown`.
- Audio is a **separate license** from video. Silent films are often
  rescored, and the score may still be under copyright.
- Commissioned capture requires **model releases**, not just object masking.
- Every source needs a full record in `sources.json` that passes the schema.

**Enforcement is by script, not by convention.** The rules above are
descriptions of what `scripts/preflight.py` actually does — not aspirations.
If you change a rule here, change the script and its tests in the same
commit, or the file becomes fiction.

## Enforcement

Two gates. Both exist, both are tested, both have been mutation-tested
(deliberately broken to confirm the tests catch it).

### `scripts/preflight.py` — the license gate

Hard-fails on: unlisted input files; records failing
`schemas/source.schema.json`; `verified_by` of uploader/IA/unknown;
`next_review_date` in the past; `verification_method == "other"` without a
detail field; `consent_status.applicable == true` without
`model_releases_on_file`; duplicate `source_id`; duplicate filename across
records.

```
exit 0  cleared
exit 1  the requested input failed the gate
exit 2  repo-level problem (sources.json missing/malformed/invalid)
```

Structural rules live in the JSON Schema. Semantic rules — "this date is in
the past", "this value is unique across the document", "this field is
required only when another field has a particular value" — live in Python,
because JSON Schema cannot express them. The schema file says so in its own
`description`.

### `scripts/check_env.py` — the environment gate

Hard-fails when the requested stage's RAM/VRAM/CUDA requirements are not
met. `--allow-dense` overrides **dense stages only**, and warns when it does.

```
exit 0  requirements met (or dense override used)
exit 1  requirements not met
exit 2  unknown stage / bad invocation
```

Unmeasurable values count as **not** satisfying a requirement. An unknown
VRAM figure is never optimistically assumed to be enough — there is a test
for exactly this, because the failure direction matters.

## Environment requirements

| Stage | Minimum | Recommended |
|---|---|---|
| Frame extraction | 4 GB RAM, any CPU | any |
| COLMAP sparse | 8 GB RAM | 32 GB RAM |
| COLMAP dense (MVS) | 16 GB RAM, 8 GB VRAM, CUDA | 32 GB RAM, 24 GB VRAM |
| GLOMAP | 16 GB RAM | 64 GB RAM |
| Mesh cleanup (Blender) | 8 GB RAM | 32 GB RAM |
| Roblox export | any | any |

These numbers live in `STAGES` in `check_env.py`. This table documents that
dict; the dict is authoritative.

**On this machine** (i5-10310U, 15.8 GB RAM, Intel UHD, no CUDA): extract,
sparse, clean and export pass. Dense and GLOMAP are correctly refused —
dense for missing CUDA/VRAM, GLOMAP for being 0.2 GB under the RAM bar.
Dense reconstruction is not viable locally without the override.

## Data policy

- **Filenames match exactly.** Each record lists the exact filenames it
  covers. No substring, no fuzzy matching, no inference. Unlisted means
  uncleared. (Mutation-tested: making the matcher fuzzy fails the suite.)
- **Every file belongs to exactly one record.** Duplicate filenames across
  records fail the gate.
- **Every `source_id` is unique**, lowercase/digits/underscores only.
- **Audio is a first-class field.** `audio_license.status` is required.
- **Consent is separate from copyright.** If `consent_status.applicable` is
  true, `model_releases_on_file` must also be true.
- **Provenance is a ledger.** Every stage writes a `manifest.json`
  describing inputs, outputs, parameters and timestamps. The extract stage
  does this today, and records which cleared `source_id` authorised the run
  — including a `gate_bypassed` flag that cannot be quietly omitted.
  *(Stages 2–4 do not exist yet, so they write nothing.)*

## Known gaps — acknowledged, not solved

These are documented limitations. Each has a `risk_flags` field so it
surfaces in logs rather than being silently assumed away. **`risk_flags`
does not clear anything.** It produces a warning. That is the honest
description of what it does.

- **Trademarks and signage** visible in frames become part of
  reconstructions. Surfaced via `risk_flags.contains_trademarks`; preflight
  warns when unset. Not cleared.
- **Architectural copyright** varies by jurisdiction (freedom of panorama —
  the US is permissive, France and Germany are not). Surfaced via
  `risk_flags.contains_architectural_copyright_risk`. Not cleared.
- **Moral rights** (attribution, integrity) exist in some jurisdictions and
  survive copyright expiry. Surfaced via
  `risk_flags.moral_rights_jurisdictions`. Not cleared.
- **AI training provenance standards** (C2PA, EU AI Act) are evolving.
  Output tagging is planned, not implemented.

## Status — what exists on disk right now

Written, tested, and passing (44 tests):

```
pipeline/
├── CLAUDE.md                          # this file
├── sources.json                       # 1 seed record (Nosferatu 1922)
├── schemas/source.schema.json         # structural rules
├── scripts/
│   ├── preflight.py                   # license gate      ✅ tested
│   ├── check_env.py                   # environment gate  ✅ tested
│   └── validate_sources_schema.py     # CI wrapper        ✅ smoke-tested
├── tests/
│   ├── test_preflight.py              # 24 tests
│   ├── test_check_env.py              #  9 tests
│   ├── test_extract.py                # 11 tests
│   └── fixtures/                      # 1 good + 11 deliberately-bad
├── src/extract/extract_frames.py      # stage 1          ✅ tested
├── src/{catalog,score,reconstruct,clean,export}/          # EMPTY
├── configs/toolchain.json             # verified tool paths + version pin
├── data/{raw,frames,reconstructions}/ # gitignored
├── logs/                              # gitignored
└── outputs/
```

**Not yet written** (do not describe these as existing):
no COLMAP/GLOMAP wrapper (`src/reconstruct/`), no scorer, no mesh cleanup,
no exporter. No CI workflow for this directory. No
`.pre-commit-config.yaml`. No `requirements.txt`.

## Tech stack

Present and load-bearing: **Python 3.14**, **jsonschema 4.26**,
**pytest 9.1**, **Pillow 12.3**, **ffmpeg 9.0.1**, **COLMAP 3.12.6 + 4.2.0**
(both no-GPU), **GLOMAP 1.2.0** (no-CUDA).

> ⚠️ **COLMAP version pin is load-bearing.** GLOMAP 1.2.0 *cannot* read a
> COLMAP 4.x database — 4.x added `rigs`/`frames`/`frame_data` tables and
> moved pose columns off `images`, and GLOMAP fails with
> `SQLite error: SQL logic error`. Feed GLOMAP from **3.12.6**
> (`D:/AI/tools/colmap312/bin/colmap.exe`). The two majors also use
> different CLI option names (`--SiftExtraction.use_gpu` in 3.x vs
> `--FeatureExtraction.use_gpu` in 4.x). See `configs/toolchain.json`.

Planned, not yet used: PySceneDetect, OpenCV (blur scoring degrades
gracefully without it), Open3D, Trimesh, Blender (bpy), Rojo.

> ⚠️ The interpreter currently resolving as `python` on this machine is
> `D:\pk\developme\.venv\Scripts\python.exe` — an **unrelated project's**
> virtualenv, where `jsonschema` and `pytest` were installed. This pipeline
> has no venv of its own yet. Creating one is a TODO; until then, tests
> depend on a sibling project's environment, which is fragile.

## Conventions

- Scripts take `--input`/`--output`; never hardcode paths.
- Config via YAML in `configs/`, not CLI sprawl.
- Log to `logs/<stage>/<timestamp>.log`, not stdout only.
- Frames named `frame_%06d.jpg` (zero-padded, sequential).
- Meshes: `scene_<source_id>_<lod>.glb`, lod in `L0`–`L3`.
- Source IDs match `^[a-z0-9_]+$`.
- The schema uses `additionalProperties: false`, so a field-name typo is a
  hard failure rather than a silent no-op.

## Reconstruction defaults

- Extraction frame rate: **2–5 fps**, not 30.
- COLMAP matcher: **sequential** for video, exhaustive for photos.
- Overlap target: 60–80% between consecutive frames.
- Reject frames with Laplacian variance < 100 (blurry).
- Mask dynamic objects (people, cars) before matching where possible.
- Scale is unknown by default; metric output needs a reference object.
- Long sequences: prefer **GLOMAP** over COLMAP incremental to avoid drift.

## Roblox export rules

- Max 20,000 triangles per mesh (10k for accessories).
- Texture atlas 1024×1024 max, baked.
- Output `.rbxmx`, or Rojo-compatible `.project.json` + `.fbx`.
- StreamingEnabled assumed for large scenes.
- SurfaceAppearance for PBR where supported.
- Terrain: heightmap PNG for `Terrain:ImportHeightmap()`.
- Round-trip in Roblox Studio before any asset ships.

The repo already has a working Rojo project at `../Roblox/` (see
`../Roblox/default.project.json`). An exporter should target that structure
rather than inventing a new one.

## Testing

```bash
cd pipeline
python -m pytest tests/ -q          # 33 tests, ~24s
```

Rules this suite is held to:

- **Bad fixtures are mandatory.** Every failure mode has a fixture that must
  be rejected. A gate tested only against good input proves nothing.
- **No can't-fail tests.** Assertions like `assert rc in (0, 1)` are banned.
  Where an outcome genuinely depends on hardware, the test branches on
  measured capability or skips explicitly — it never accepts either answer.
- **Mutation-test before trusting green.** Both gates have been deliberately
  broken to confirm the tests catch it: disabling the uploader check failed
  3 tests; making filename matching fuzzy failed 1; assuming unknown RAM is
  fine failed 1. A suite that has never been seen to fail is not evidence.

## Workflow for sessions in this directory

1. Read this file and the root `../CLAUDE.md` (different project, different
   rules).
2. `python scripts/preflight.py --input <file>` before processing any video.
   If it fails, fix `sources.json` — do not bypass.
3. `python scripts/check_env.py --stage <stage>` before any reconstruction.
   If it fails, downgrade the stage rather than forcing it.
4. Update the Status section when you add a stage. Move things from "not yet
   written" to the tree only once they exist *and* pass.
5. Ask before deleting anything in `data/` or `outputs/`.
6. **Do not put a claim in this file that isn't backed by a script that
   exists.** If it isn't written, it belongs in Status or TODO, not in
   present tense. This rule is why the Status section exists.

## TODO

- [ ] `requirements.txt` + a venv of this project's own (currently borrowing
      `developme`'s — fragile)
- [ ] `.github/workflows/pipeline-ci.yml` — must not be merged until every
      file it references exists and passes locally
- [ ] `.pre-commit-config.yaml` — fast subset only (<5s), or people will
      `--no-verify` and the gate becomes decorative
- [ ] `src/catalog/` — IA query + license verification helpers
- [ ] `manifest.json` writer for stages 2+ (extract already writes one)
- [ ] `src/reconstruct/` — COLMAP/GLOMAP wrappers (toolchain verified working)
- [ ] Roblox exporter + Studio round-trip test
- [ ] Variable frame rate: currently detected and warned, not corrected
- [ ] C2PA provenance tagging
- [ ] A second real `sources.json` record (commissioned capture, exercising
      the consent path end-to-end)
