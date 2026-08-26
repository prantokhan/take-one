// Take One — AI adapter service.
//
// Sits behind the same HTTP boundary as the offline mock service, but replaces
// canned responses with a real LLM when credentials are provided. The Option A
// architecture is preserved: Unreal and the web game speak only this contract,
// never to a model provider directly.
//
//   POST /v1/scenes/generate  -> ServiceContract/scene-generation.schema.json
//   POST /v1/director/beat    -> adaptive story beat (Hidden Door / Muse-style)
//   POST /v1/npc/line         -> persistent-personality NPC performance (Inworld-style)
//   POST /v1/cast/suggest     -> original cast suggestions for a production
//   GET  /v1/health           -> capability probe
//
// Configuration (environment):
//   TAKEONE_SCENE_SERVICE_PORT      default 8788
//   TAKEONE_LLM_BASE_URL            default https://api.openai.com/v1
//                                   (any OpenAI-compatible endpoint works)
//   TAKEONE_LLM_API_KEY             when unset, every endpoint serves the
//                                   deterministic local generator instead
//   TAKEONE_LLM_MODEL               default gpt-4o-mini
//   TAKEONE_SCENE_SERVICE_TOKEN     optional bearer token
//
// Self-check: node ai-scene-service.mjs --check

import { timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";

const port = Number.parseInt(process.env.TAKEONE_SCENE_SERVICE_PORT ?? "8788", 10);
const expectedToken = process.env.TAKEONE_SCENE_SERVICE_TOKEN ?? "";
const llmBaseUrl = (process.env.TAKEONE_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const llmApiKey = process.env.TAKEONE_LLM_API_KEY ?? "";
const llmModel = process.env.TAKEONE_LLM_MODEL ?? "gpt-4o-mini";

const maxBodyBytes = 24 * 1024 * 1024; // stills upload as base64 JSON

// Rendered film shots: Map<filmId, Map<index, Buffer>>
const filmShots = new Map();
// Encoded videos: Map<filmId, Buffer>
const filmVideos = new Map();
// Shared world catalog (multiplayer-lite): Map<filmId, film>
const worldFilms = new Map();

const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";
const { existsSync, readdirSync } = await import("node:fs");
const { join } = await import("node:path");

// Resolve a spawnable ffmpeg: explicit override -> PATH name -> known
// WinGet install locations (the Links alias itself often fails to spawn).
let resolvedFfmpeg = null;
function resolveFfmpeg() {
  if (resolvedFfmpeg) return resolvedFfmpeg;
  const candidates = [];
  if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);
  const localAppData = process.env.LOCALAPPDATA ?? "";
  if (localAppData) {
    candidates.push(join(localAppData, "Microsoft", "WinGet", "Links", "ffmpeg.exe"));
    const packagesDir = join(localAppData, "Microsoft", "WinGet", "Packages");
    try {
      if (existsSync(packagesDir)) {
        for (const entry of readdirSync(packagesDir)) {
          if (/^Gyan\.FFmpeg_/i.test(entry)) {
            candidates.push(join(packagesDir, entry, "ffmpeg-9.0-full_build", "bin", "ffmpeg.exe"));
          }
        }
      }
    } catch { /* best effort */ }
  }
  candidates.push("ffmpeg");
  resolvedFfmpeg = candidates.find(candidate => candidate !== "ffmpeg" && existsSync(candidate)) ?? "ffmpeg";
  console.log(`ffmpeg resolved to: ${resolvedFfmpeg}`);
  return resolvedFfmpeg;
}

const takeOne3dBaseUrl = (process.env.TAKEONE_3D_BASE_URL ?? "").replace(/\/+$/, "");

async function encodeFilmVideo(filmId) {
  if (filmVideos.has(filmId)) return filmVideos.get(filmId);
  const shots = filmShots.get(filmId);
  if (!shots || !shots.size) throw Object.assign(new Error("no shots"), { code: "NOSHOTS" });

  // Prefer a workspace-local scratch dir: restricted environments often deny
  // writes to the system temp folder.
  const scratchBase = process.env.TAKEONE_TMP_DIR ?? `${process.cwd()}/.tmp-encode`;
  const { mkdir } = await import("node:fs/promises");
  await mkdir(scratchBase, { recursive: true }).catch(() => {});
  const workDir = await mkdtemp(`${scratchBase}/encode-`);
  try {
    const indexes = [...shots.keys()].sort((a, b) => a - b);
    for (let position = 0; position < indexes.length; position += 1) {
      const framePath = `${workDir}/frame_${String(position).padStart(3, "0")}.png`;
      await writeFile(framePath, shots.get(indexes[position]));
    }
    const outPath = `${workDir}/out.mp4`;
    const args = [
      "-y", "-loglevel", "error",
      "-framerate", "6",
      "-i", `${workDir}/frame_%03d.png`,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath
    ];
    await new Promise((resolve, reject) => {
      // stdio 'ignore' keeps this working under restricted environments that
      // deny piped child output; exit code carries the failure signal.
      const child = spawn(resolveFfmpeg(), args, { windowsHide: true, stdio: "ignore" });
      child.on("error", reject);
      child.on("close", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)));
    });
    const video = await readFile(outPath);
    filmVideos.set(filmId, video);
    console.log(`Encoded '${filmId}' moving master -> ${Math.round(video.length / 1024)} KB mp4 (${indexes.length} frames).`);
    return video;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

function tokenMatches(header) {
  if (!expectedToken) return true;
  const received = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBytes = Buffer.from(expectedToken);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sanitization — every model output is clamped into the contract before it
// leaves this server. Nothing raw from the LLM reaches the game client.
// ---------------------------------------------------------------------------

const clampNumber = (value, min, max, fallback) => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

function sanitizeColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const match = /^#([0-9A-Fa-f]{6})/.exec(value.trim());
  return match ? `#${match[1].toUpperCase()}` : fallback;
}

function sanitizeVector(value, fallback, min, max) {
  const source = typeof value === "object" && value !== null ? value : {};
  return {
    x: clampNumber(source.x, min, max, fallback.x),
    y: clampNumber(source.y, min, max, fallback.y),
    z: clampNumber(source.z, min, max, fallback.z)
  };
}

function sanitizeRotation(value, fallback = { pitch: 0, yaw: 0, roll: 0 }) {
  return sanitizeVector(value, fallback, -3600, 3600);
}

function sanitizeId(value, index) {
  const cleaned = String(value ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return cleaned.length ? cleaned : `object_${index}`;
}

function sanitizeScene(raw, prompt) {
  if (typeof raw !== "object" || raw === null) return null;
  const rawObjects = Array.isArray(raw.objects) ? raw.objects.slice(0, 128) : [];
  if (!rawObjects.length) return null;

  const objects = [];
  rawObjects.forEach((item, index) => {
    if (typeof item !== "object" || item === null) return;
    const primitive = ["cube", "sphere", "cylinder", "cone"].includes(item.primitive)
      ? item.primitive
      : "cube";
    objects.push({
      id: sanitizeId(item.id, index),
      label: String(item.label ?? "Generated object").slice(0, 120) || "Generated object",
      primitive,
      location: sanitizeVector(item.location, { x: 0, y: 0, z: 0 }, -100000, 100000),
      rotation: sanitizeRotation(item.rotation),
      scale: sanitizeVector(item.scale, { x: 1, y: 1, z: 1 }, 0.01, 100),
      color: sanitizeColor(item.color, "#33383C"),
      cast_shadow: item.cast_shadow !== false,
      asset_hint: String(item.asset_hint ?? `${prompt}`.slice(0, 300)).slice(0, 300)
    });
  });
  if (!objects.length) return null;

  const environmentSource = typeof raw.environment === "object" && raw.environment !== null ? raw.environment : {};
  const cameraSource = typeof raw.camera === "object" && raw.camera !== null ? raw.camera : {};

  return {
    schema_version: "1.0",
    title: String(raw.title ?? "Director Set").slice(0, 120) || "Director Set",
    summary: String(raw.summary ?? "").slice(0, 500),
    environment: {
      ground_color: sanitizeColor(environmentSource.ground_color, "#0A0D10"),
      sky_light_color: sanitizeColor(environmentSource.sky_light_color, "#5E7FA0"),
      sky_light_intensity: clampNumber(environmentSource.sky_light_intensity, 0, 20, 0.8),
      sun_color: sanitizeColor(environmentSource.sun_color, "#FFD2A6"),
      sun_intensity: clampNumber(environmentSource.sun_intensity, 0, 100, 6),
      sun_rotation: sanitizeRotation(
        environmentSource.sun_rotation,
        { pitch: -35, yaw: -35, roll: 0 }
      ),
      fog_density: clampNumber(environmentSource.fog_density, 0, 0.1, 0.012)
    },
    camera: {
      location: sanitizeVector(cameraSource.location, { x: -1400, y: -900, z: 550 }, -100000, 100000),
      rotation: sanitizeRotation(cameraSource.rotation, { pitch: -12, yaw: 32, roll: 0 }),
      fov: clampNumber(cameraSource.fov, 20, 120, 50)
    },
    objects
  };
}

// ---------------------------------------------------------------------------
// Object refinement ("text-to-3D, local edition"): key objects are decomposed
// into compound multi-part geometry so sets read as dressed environments
// rather than raw primitives. LLM decomposition when configured; keyword
// heuristics otherwise.
// ---------------------------------------------------------------------------

const refineEnabled = (process.env.TAKEONE_REFINE ?? "on").toLowerCase() !== "off";
const REFINE_BUDGET = 14;      // max objects refined per scene
const TOTAL_OBJECT_CAP = 120;  // stay well under the schema's 128

function shadeColor(hex, factor) {
  const match = /^#([0-9A-Fa-f]{6})/.exec(hex);
  if (!match) return hex;
  const channels = [0, 2, 4].map(offset => {
    const value = Number.parseInt(match[1].slice(offset, offset + 2), 16) * factor;
    return Math.min(255, Math.max(0, Math.round(value)));
  });
  return `#${channels.map(value => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function makePart(base, suffix, primitive, dx, dy, dz, sx, sy, sz, colorFactor) {
  return {
    id: `${base.id}_${suffix}`,
    label: `${base.label} (${suffix})`,
    primitive,
    location: { x: base.location.x + dx, y: base.location.y + dy, z: base.location.z + dz },
    rotation: base.rotation,
    scale: {
      x: clampNumber(base.scale.x * sx, 0.05, 40, base.scale.x),
      y: clampNumber(base.scale.y * sy, 0.05, 40, base.scale.y),
      z: clampNumber(base.scale.z * sz, 0.05, 40, base.scale.z)
    },
    color: shadeColor(base.color, colorFactor),
    cast_shadow: true,
    asset_hint: `${base.asset_hint} — ${suffix} part`.slice(0, 300)
  };
}

function localDecompose(obj) {
  const text = `${obj.label} ${obj.asset_hint}`.toLowerCase();
  const parts = [];

  if (/lamp|lantern|neon|light/.test(text)) {
    parts.push(makePart(obj, "pole", "cylinder", -obj.scale.x * 20, 0, obj.scale.z * 30, 0.12, 0.12, 1.1, 0.55));
    parts.push(makePart(obj, "shade", "cone", obj.scale.x * 18, 0, obj.scale.z * 62, 0.5, 0.5, 0.35, 0.75));
    parts.push(makePart(obj, "glow", "sphere", obj.scale.x * 18, 0, obj.scale.z * 48, 0.3, 0.3, 0.3, 1.9));
  } else if (/tree|palm|foliage|pine/.test(text)) {
    parts.push(makePart(obj, "trunk", "cylinder", 0, 0, -obj.scale.z * 25, 0.28, 0.28, 0.7, 0.5));
    parts.push(makePart(obj, "canopy_a", "sphere", 0, 0, obj.scale.z * 45, 1.15, 1.15, 0.8, 0.6));
    parts.push(makePart(obj, "canopy_b", "sphere", obj.scale.x * 22, obj.scale.y * 14, obj.scale.z * 70, 0.7, 0.7, 0.5, 0.45));
    parts.push(makePart(obj, "canopy_c", "cone", -obj.scale.x * 18, -obj.scale.y * 10, obj.scale.z * 80, 0.5, 0.5, 0.45, 0.35));
  } else if (/table|desk|bench|counter|bar|console/.test(text)) {
    parts.push(makePart(obj, "top", "cube", 0, 0, obj.scale.z * 42, 1.05, 1.05, 0.08, 1.15));
    parts.push(makePart(obj, "leg_a", "cylinder", -obj.scale.x * 42, -obj.scale.y * 42, 0, 0.09, 0.09, 0.85, 0.6));
    parts.push(makePart(obj, "leg_b", "cylinder", obj.scale.x * 42, -obj.scale.y * 42, 0, 0.09, 0.09, 0.85, 0.6));
    parts.push(makePart(obj, "leg_c", "cylinder", -obj.scale.x * 42, obj.scale.y * 42, 0, 0.09, 0.09, 0.85, 0.6));
    parts.push(makePart(obj, "leg_d", "cylinder", obj.scale.x * 42, obj.scale.y * 42, 0, 0.09, 0.09, 0.85, 0.6));
  } else if (/rock|boulder|crater|stone/.test(text)) {
    parts.push(makePart(obj, "mass", "sphere", 0, 0, -obj.scale.z * 10, 1.2, 1.0, 0.65, 0.85));
    parts.push(makePart(obj, "shard", "cone", obj.scale.x * 30, obj.scale.y * 18, obj.scale.z * 18, 0.45, 0.45, 0.4, 1.1));
  } else if (/tower|building|facade|habitat|dome|wall|bunker/.test(text)) {
    parts.push(makePart(obj, "body", "cube", 0, 0, 0, 0.92, 0.92, 0.9, 1.0));
    parts.push(makePart(obj, "band", "cube", 0, 0, obj.scale.z * 34, 1.0, 1.0, 0.06, 0.55));
    parts.push(makePart(obj, "cap", "cube", 0, 0, obj.scale.z * 52, 0.7, 0.7, 0.12, 1.2));
    parts.push(makePart(obj, "vent", "cylinder", obj.scale.x * 24, 0, obj.scale.z * 66, 0.1, 0.1, 0.2, 0.7));
  } else if (/skiff|vehicle|ship|boat|craft|drone|rig/.test(text)) {
    parts.push(makePart(obj, "hull", "cube", 0, 0, -obj.scale.z * 12, 1.15, 0.7, 0.4, 0.9));
    parts.push(makePart(obj, "cabin", "sphere", -obj.scale.x * 12, 0, obj.scale.z * 26, 0.45, 0.4, 0.32, 1.15));
    parts.push(makePart(obj, "fin", "cone", obj.scale.x * 38, 0, obj.scale.z * 30, 0.16, 0.3, 0.4, 0.7));
  } else if (/crate|barrel|box|case|canister/.test(text)) {
    parts.push(makePart(obj, "body", "cube", 0, 0, 0, 1.0, 1.0, 0.82, 1.0));
    parts.push(makePart(obj, "lid", "cube", 0, 0, obj.scale.z * 46, 1.06, 1.06, 0.1, 0.72));
    parts.push(makePart(obj, "strap", "cube", 0, 0, 0, 1.04, 0.12, 0.84, 0.5));
  } else if (/gate|door|portal|arch/.test(text)) {
    parts.push(makePart(obj, "frame_left", "cylinder", -obj.scale.x * 44, 0, 0, 0.14, 0.14, 1.0, 0.7));
    parts.push(makePart(obj, "frame_right", "cylinder", obj.scale.x * 44, 0, 0, 0.14, 0.14, 1.0, 0.7));
    parts.push(makePart(obj, "lintel", "cube", 0, 0, obj.scale.z * 48, 1.2, 0.9, 0.1, 0.7));
    parts.push(makePart(obj, "panel", "cube", 0, 0, 0, 0.78, 0.5, 0.86, 1.25));
  } else if (/subject|statue|monument|machine/.test(text)) {
    parts.push(makePart(obj, "plinth", "cube", 0, 0, -obj.scale.z * 30, 0.7, 0.7, 0.25, 0.65));
    parts.push(makePart(obj, "figure", "cylinder", 0, 0, obj.scale.z * 22, 0.4, 0.4, 0.6, 1.1));
    parts.push(makePart(obj, "crest", "sphere", 0, 0, obj.scale.z * 68, 0.26, 0.26, 0.26, 1.5));
  } else {
    // Generic dressing: pedestal + body + accent keeps any unclassified object
    // from looking like a single floating cube.
    parts.push(makePart(obj, "base", "cube", 0, 0, -obj.scale.z * 26, 0.8, 0.8, 0.22, 0.6));
    parts.push(makePart(obj, "form", "cylinder", 0, 0, obj.scale.z * 14, 0.55, 0.55, 0.7, 1.0));
    parts.push(makePart(obj, "accent", "sphere", 0, 0, obj.scale.z * 58, 0.2, 0.2, 0.2, 1.4));
  }
  return parts;
}

const REFINE_SYSTEM_PROMPT = `You are a 3D set-dressing engine for the "Take One" film game.
Given one placeholder object (label, hint, world location, scale, color), decompose it into 3-6 smaller
primitive parts that together look like the real thing.
Respond ONLY with JSON: {"parts":[{"primitive":"cube"|"sphere"|"cylinder"|"cone",
"offset":{"x":number,"y":number,"z":number},"scale":{"x","y","z"},"color":"#RRGGBB"}]}
Offsets are relative to the object's origin; scales multiply the given scale. Keep proportions believable.`;

async function refineObjectWithLlm(obj) {
  const request = {
    label: obj.label,
    hint: obj.asset_hint,
    primitive: obj.primitive,
    location: obj.location,
    scale: obj.scale,
    color: obj.color
  };
  const raw = await llmJson(REFINE_SYSTEM_PROMPT, JSON.stringify(request), 500);
  if (!Array.isArray(raw.parts)) throw new Error("no parts");
  return raw.parts.slice(0, 6).map((part, index) => ({
    id: `${obj.id}_p${index}`,
    label: `${obj.label} (${index})`,
    primitive: ["cube", "sphere", "cylinder", "cone"].includes(part.primitive) ? part.primitive : "cube",
    location: sanitizeVector(
      {
        x: obj.location.x + clampNumber(part.offset?.x, -20000, 20000, 0),
        y: obj.location.y + clampNumber(part.offset?.y, -20000, 20000, 0),
        z: obj.location.z + clampNumber(part.offset?.z, -20000, 20000, 0)
      },
      obj.location, -100000, 100000
    ),
    rotation: obj.rotation,
    scale: {
      x: clampNumber(obj.scale.x * clampNumber(part.scale?.x, 0.05, 4, 0.5), 0.05, 40, obj.scale.x),
      y: clampNumber(obj.scale.y * clampNumber(part.scale?.y, 0.05, 4, 0.5), 0.05, 40, obj.scale.y),
      z: clampNumber(obj.scale.z * clampNumber(part.scale?.z, 0.05, 4, 0.5), 0.05, 40, obj.scale.z)
    },
    color: sanitizeColor(part.color, obj.color),
    cast_shadow: part.cast_shadow !== false,
    asset_hint: `${obj.asset_hint} — refined part ${index}`.slice(0, 300)
  }));
}

async function refineScene(scene) {
  const objects = [...scene.objects];
  const refined = [];
  // Refine the biggest non-ground objects first: they dominate the frame.
  const candidates = objects
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => !/ground|floor/.test(object.id))
    .sort((a, b) =>
      (b.object.scale.x * b.object.scale.y * b.object.scale.z) -
      (a.object.scale.x * a.object.scale.y * a.object.scale.z))
    .slice(0, REFINE_BUDGET);
  const refineIndexes = new Set(candidates.map(entry => entry.index));

  for (let index = 0; index < objects.length && refined.length < TOTAL_OBJECT_CAP; index += 1) {
    if (!refineIndexes.has(index) || refined.length >= TOTAL_OBJECT_CAP) {
      refined.push(objects[index]);
      continue;
    }
    let parts;
    if (llmApiKey) {
      try {
        parts = await refineObjectWithLlm(objects[index]);
      } catch {
        parts = null;
      }
    }
    if (!parts) parts = localDecompose(objects[index]);
    for (const part of parts) {
      if (refined.length >= TOTAL_OBJECT_CAP) break;
      refined.push(sanitizeSceneObjectPart(part, objects[index]));
    }
  }

  scene.objects = refined;
  return scene;
}

function sanitizeSceneObjectPart(part, fallback) {
  return sanitizeColorAndShape({
    id: sanitizeId(part.id, 0),
    label: String(part.label ?? "").slice(0, 120),
    primitive: ["cube", "sphere", "cylinder", "cone"].includes(part.primitive) ? part.primitive : "cube",
    location: part.location,
    rotation: part.rotation,
    scale: part.scale,
    color: part.color,
    cast_shadow: part.cast_shadow !== false,
    asset_hint: String(part.asset_hint ?? "").slice(0, 300)
  }, fallback);
}

function sanitizeColorAndShape(part, fallback) {
  part.location = sanitizeVector(part.location, fallback.location, -100000, 100000);
  part.rotation = sanitizeRotation(part.rotation);
  part.scale = sanitizeVector(part.scale, fallback.scale, 0.01, 100);
  part.color = sanitizeColor(part.color, fallback.color);
  return part;
}

// ---------------------------------------------------------------------------
// Deterministic local generators (fallback when no LLM is configured).
// ---------------------------------------------------------------------------

function hashOf(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

function localScene(prompt) {
  const lower = prompt.toLowerCase();
  const random = seededRandom(hashOf(prompt));
  const night = /night|dark|midnight|rain/.test(lower);

  const ground = night ? "#0A0F14" : lower.includes("desert") ? "#6B3814" : lower.includes("snow") ? "#AFC4CE" : "#12181C";
  const sun = night ? "#4269B8" : lower.includes("sunset") || lower.includes("dusk") ? "#FF4710" : "#FFD2A6";

  const objects = [
    {
      id: "hero_floor",
      label: "Hero performance area",
      primitive: "cube",
      location: { x: 150, y: 0, z: 25 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
      scale: { x: 16, y: 10, z: 0.5 },
      color: night ? "#141B22" : "#3C464E",
      cast_shadow: true,
      asset_hint: `original hero set piece for: ${prompt}`.slice(0, 300)
    },
    {
      id: "hero_subject",
      label: "Prompt hero subject",
      primitive: ["cube", "sphere", "cylinder", "cone"][hashOf(prompt) % 4],
      location: { x: 120, y: 0, z: 180 },
      rotation: { pitch: 0, yaw: 45, roll: 0 },
      scale: { x: 2.6, y: 2.6, z: 3.4 },
      color: sanitizeColor(`#${(hashOf(prompt) & 0xffffff).toString(16).padStart(6, "0")}`, "#8899AA"),
      cast_shadow: true,
      asset_hint: `hero subject matching: ${prompt}`.slice(0, 300)
    }
  ];

  const count = 10 + Math.floor(random() * 8);
  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 500 + random() * 1800;
    const height = 80 + random() * 900;
    objects.push({
      id: `element_${index}`,
      label: "Prompt-derived set element",
      primitive: ["cube", "sphere", "cylinder", "cone"][Math.floor(random() * 4)],
      location: {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
        z: Math.round(height * 0.5)
      },
      rotation: { pitch: 0, yaw: Math.round(random() * 180), roll: 0 },
      scale: {
        x: Number((0.7 + random() * 3).toFixed(2)),
        y: Number((0.7 + random() * 3).toFixed(2)),
        z: Number((height / 100).toFixed(2))
      },
      color: sanitizeColor(`#${((hashOf(`${prompt}:${index}`) & 0xffffff) | 0x202020).toString(16).padStart(6, "0")}`, "#2A3036"),
      cast_shadow: index % 3 !== 0,
      asset_hint: `${prompt} set dressing element ${index}`.slice(0, 300)
    });
  }

  return sanitizeScene(
    {
      title: `Director Set: ${prompt.slice(0, 40)}`,
      summary: `Offline deterministic layout for: ${prompt.slice(0, 160)}`,
      environment: {
        ground_color: ground,
        sky_light_color: night ? "#16294A" : "#7391AE",
        sky_light_intensity: night ? 0.35 : 0.85,
        sun_color: sun,
        sun_intensity: night ? 1.8 : 7,
        sun_rotation: { pitch: night ? -18 : -32, yaw: -40, roll: 0 },
        fog_density: lower.includes("fog") || lower.includes("mist") ? 0.04 : 0.01
      },
      camera: {
        location: { x: -1650, y: -1250, z: 600 },
        rotation: { pitch: -12, yaw: 36, roll: 0 },
        fov: 52
      },
      objects
    },
    prompt
  );
}

function localBeat(prompt, context = {}) {
  const lower = prompt.toLowerCase();
  const mood = /tense|danger|fear|chase|threat/.test(lower)
    ? "Taut, held breath"
    : /funny|joke|laugh|absurd/.test(lower)
      ? "Warm, comic timing"
      : /quiet|grief|sad|tender|home/.test(lower)
        ? "Hushed, intimate"
        : "Curious, forward-leaning";
  const shot = /wide|landscape|city|crowd/.test(lower)
    ? "Slow lateral wide, letting scale breathe"
    : /close|face|eye/.test(lower)
      ? "Tight close-up, shallow depth"
      : "Medium push-in on the decision point";
  const actions = [
    `The scene opens on ${prompt.slice(0, 90)}.`,
    context.characters?.length
      ? `${context.characters[0]} enters the frame mid-thought, carrying the tension of the previous take.`
      : "A secondary figure crosses frame, resetting the geography.",
    /reveal|discover|realize/.test(lower)
      ? "The turn lands silently — nobody speaks first."
      : /fight|argue|confront/.test(lower)
        ? "Dialogue sharpens until someone breaks pattern."
        : "The beat settles on a small physical gesture instead of a line."
  ];
  return {
    setting: String(context.title ?? "Untitled production"),
    mood,
    shot,
    action: actions,
    quality_hint: clampNumber(Math.min(10, 4 + prompt.trim().split(/\s+/).length / 10), 4, 10, 6),
    source: "local"
  };
}

const NAME_POOL = ["Mara Voss", "Ilya Renner", "Dee Okafor", "Sunder Pahl", "Noor Haddad", "Casey Lindqvist", "Rhea Antonov", "Bo Calloway"];
const ARCHETYPES = [
  { archetype: "guarded professional", trait: "never lets them see effort", quirk: "counts props under her breath before takes" },
  { archetype: "restless comedian", trait: "improvises to break tension", quirk: "collects one object from every set" },
  { archetype: "quiet obsessive", trait: "knows everyone's backstory but never shares his own", quirk: "rewrites his lines' punctuation in the margin" },
  { archetype: "warm veteran", trait: "protects younger cast from the director's bad days", quirk: "brings tea in a chipped thermos to every shoot" }
];

function localCast(context = {}) {
  const seed = hashOf(String(context.genre ?? "") + String(context.title ?? "") + Date.now());
  const random = seededRandom(seed);
  const count = clampNumber(context.count, 1, 4, 3);
  const usedNames = new Set();
  const cast = [];
  for (let index = 0; index < count; index += 1) {
    let name = NAME_POOL[Math.floor(random() * NAME_POOL.length)];
    while (usedNames.has(name)) name = NAME_POOL[(NAME_POOL.indexOf(name) + 1) % NAME_POOL.length];
    usedNames.add(name);
    const template = ARCHETYPES[Math.floor(random() * ARCHETYPES.length)];
    cast.push({
      name,
      role: index === 0 ? "Lead" : "Supporting",
      archetype: template.archetype,
      trait: template.trait,
      quirk: template.quirk,
      source: "local"
    });
  }
  return cast;
}

function localNpcLine(payload) {
  const character = payload.character ?? {};
  const direction = String(payload.direction ?? "Play the moment honestly.").slice(0, 300);
  const openings = [
    `"Understood — but my way of doing that won't look like effort."`,
    `"Give me a second to find it... alright. Again, and watch the pause."`,
    `"You want it bigger or truer? Those aren't the same take."`,
    `"Fine. But if it goes quiet, don't cut."`
  ];
  const pick = openings[hashOf(direction + String(character.name)) % openings.length];
  return {
    line: pick,
    reaction: `${character.name ?? "The performer"} takes the direction through the filter of being ${character.archetype ?? "a professional"} — ${character.trait ?? "composed"} — and gives you one clean rehearsal of it.`,
    source: "local"
  };
}

// ---------------------------------------------------------------------------
// LLM path — OpenAI-compatible chat completions with strict JSON prompts.
// ---------------------------------------------------------------------------

async function llmJson(systemPrompt, userPrompt, maxTokens = 1400) {
  if (!llmApiKey) throw new Error("LLM not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${llmApiKey}`
      },
      body: JSON.stringify({
        model: llmModel,
        temperature: 0.8,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM completion");
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

const SCENE_SYSTEM_PROMPT = `You are the scene-generation engine for "Take One", a film-production game.
The player is a director describing a physical film set. Translate their description into ONE buildable set.
Rules you must obey:
- Output ONLY a JSON object, no prose.
- All people, places, and objects must be ORIGINAL. Never reference real named people, franchises, or brands.
- Schema: {"schema_version":"1.0","title":string<=120,"summary":string<=500,
"environment":{"ground_color":"#RRGGBB","sky_light_color":"#RRGGBB","sky_light_intensity":0..20,"sun_color":"#RRGGBB","sun_intensity":0..100,"sun_rotation":{"pitch":-90..0,"yaw":-180..180,"roll":0},"fog_density":0..0.1},
"camera":{"location":{"x":-8000..8000,"y":-8000..8000,"z":50..4000},"rotation":{"pitch":-60..10,"yaw":-180..180,"roll":0},"fov":20..120},
"objects":[1..64 items]}
- Each object: {"id":"snake_case unique","label":string<=120,"primitive":"cube"|"sphere"|"cylinder"|"cone","location":{x,y,z},"rotation":{"pitch","yaw","roll"},"scale":{"x":0.1..40,"y":0.1..40,"z":0.05..40},"color":"#RRGGBB","cast_shadow":boolean,"asset_hint":string<=300}
- Build a PLAYABLE set: ground plane or terrain mass, a clear open performance area near origin, backdrop elements 1500-6000 units out, and 2-6 practical light-colored objects (emissive-looking bright warm colors) as practicals.
- Match the director's mood words (night, sunset, fog, desert...) in your lighting colors.`;

const BEAT_SYSTEM_PROMPT = `You are the adaptive story engine for "Take One", a film-production game.
A player-director writes free-form direction for a scene. You respond ONLY with JSON:
{"setting":string, "mood":string, "shot":string(one camera move suggestion), "action":[3 short beats of what happens], "quality_hint":number 4..10 (how strong this direction is dramatically)}
All content must be original fiction — no real people, franchises, or brands. Honor the director's intent faithfully; never refuse creative directions inside fiction.`;

const CAST_SYSTEM_PROMPT = `You are the casting engine for "Take One". Generate ORIGINAL performers (never resembling real people).
Respond ONLY with JSON: {"cast":[{"name":string(original fictional name),"role":"Lead"|"Supporting","archetype":string(short),"trait":string(personality core),"quirk":string(specific behavioral detail)}]}
Count must match the requested count.`;

const LINE_SYSTEM_PROMPT = `You voice a film performer with a FIXED persistent personality for "Take One".
Character sheet (never contradict it): {"character":{...}}
Respond ONLY with JSON: {"line":string(in-character spoken line,<=220 chars),"reaction":string(how they took the director's note, referencing their personality)}
Stay in character. Original fiction only.`;

// ---------------------------------------------------------------------------
// HTTP routing
// ---------------------------------------------------------------------------

// In-memory build queue: any client (the web game, scripts) can enqueue a set
// description; Unreal claims jobs FIFO via GET /v1/jobs/next.
const pendingJobs = [];
let jobCounter = 0;
const MAX_QUEUE = 20;

async function buildScene(prompt) {
  let scene = null;
  let source = "local";
  if (llmApiKey) {
    try {
      const llmScene = sanitizeScene(await llmJson(SCENE_SYSTEM_PROMPT, `Director's set description: ${prompt}`), prompt);
      if (llmScene) {
        scene = llmScene;
        source = "llm";
      }
    } catch (error) {
      console.error(`scene LLM failed, using local generator: ${error.message}`);
    }
  }
  if (!scene) scene = localScene(prompt);
  if (refineEnabled) {
    const before = scene.objects.length;
    await refineScene(scene);
    console.log(`Refined ${before} -> ${scene.objects.length} objects.`);
  }
  return { ...scene, source };
}

const server = createServer(async (request, response) => {
  const corsHeaders = {};
  const requestOrigin = request.headers.origin;
  if (requestOrigin) corsHeaders["access-control-allow-origin"] = "*";
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": requestOrigin ? "*" : "",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-max-age": "86400"
    });
    response.end();
    return;
  }

  if (!tokenMatches(request.headers.authorization)) {
    send(response, 401, { error: "Unauthorized" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  // ---- Film shot routes (raw PNG responses, handled before JSON plumbing) --
  if (url.pathname.startsWith("/v1/films/")) {
    const segments = url.pathname.split("/").filter(Boolean); // v1, films, id, ...
    const filmId = segments[2] ?? "";

    if (request.method === "POST" && url.pathname === "/v1/films/shots") {
      const body = await readJsonBody(request);
      if (body === null || !body.film_id || !Number.isInteger(body.index) || typeof body.data !== "string") {
        send(response, 400, { error: "film_id, index and base64 data are required." });
        return;
      }
      let png;
      try {
        png = Buffer.from(body.data, "base64");
      } catch {
        send(response, 400, { error: "Invalid base64 payload." });
        return;
      }
      if (!png.length) {
        send(response, 400, { error: "Empty payload." });
        return;
      }
      if (!filmShots.has(body.film_id)) filmShots.set(body.film_id, new Map());
      filmShots.get(body.film_id).set(body.index, png);
      console.log(`Stored shot ${body.index} for '${body.film_id}' (${Math.round(png.length / 1024)} KB).`);
      send(response, 200, { stored: true, count: filmShots.get(body.film_id).size });
      return;
    }

    if (request.method === "GET" && segments[3] === "manifest" && filmId) {
      const shots = filmShots.get(filmId);
      send(response, 200, {
        film_id: filmId,
        count: shots ? shots.size : 0,
        indexes: shots ? [...shots.keys()].sort((a, b) => a - b) : [],
        has_video: filmVideos.has(filmId)
      });
      return;
    }

    if (request.method === "GET" && segments[3] === "video.mp4" && filmId) {
      try {
        const video = await encodeFilmVideo(filmId);
        response.writeHead(200, {
          "content-type": "video/mp4",
          "content-length": video.length,
          "cache-control": "no-store",
          "access-control-allow-origin": "*"
        });
        response.end(video);
      } catch (error) {
        if (error.code === "NOSHOTS" || /no shots/i.test(error.message)) {
          send(response, 404, { error: "No shots uploaded for this film yet." });
        } else if (/ENOENT|not available/i.test(error.message)) {
          send(response, 501, { error: "ffmpeg not available on the adapter host.", detail: error.message.slice(0, 300), hint: "Install FFmpeg (winget install Gyan.FFmpeg) or set FFMPEG_PATH." });
        } else {
          send(response, 500, { error: error.message.slice(0, 300) });
        }
      }
      return;
    }

    if (request.method === "GET" && segments[3] === "shots" && filmId && segments[4] !== undefined) {
      const indexMatch = /^(\d+)\.png$/.exec(segments[4]);
      if (!indexMatch) {
        send(response, 404, { error: "Unknown films endpoint." });
        return;
      }
      const shots = filmShots.get(filmId);
      const png = shots ? shots.get(Number.parseInt(indexMatch[1], 10)) : undefined;
      if (!png) {
        send(response, 404, { error: "Shot not found." });
        return;
      }
      response.writeHead(200, {
        "content-type": "image/png",
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      });
      response.end(png);
      return;
    }

    send(response, 404, { error: "Unknown films endpoint." });
    return;
  }

  // ---- Shared world catalog (multiplayer-lite) -----------------------------
  // Every connected player publishes releases here; everyone sees and rates
  // the whole player base's films.
  if (url.pathname.startsWith("/v1/world/")) {
    const segments = url.pathname.split("/").filter(Boolean);

    if (request.method === "POST" && url.pathname === "/v1/world/films") {
      const body = await readJsonBody(request);
      if (body === null || !body.id || !body.title) {
        send(response, 400, { error: "id and title are required." });
        return;
      }
      worldFilms.set(String(body.id).slice(0, 80), {
        id: String(body.id).slice(0, 80),
        title: String(body.title ?? "Untitled").slice(0, 120),
        genre: String(body.genre ?? "Unsorted").slice(0, 40),
        score: clampNumber(body.score, 1, 99, 50),
        views: clampNumber(body.views, 0, 1e9, 0),
        length: String(body.length ?? "18 min").slice(0, 20),
        creator: String(body.creator ?? "Anonymous Director").slice(0, 60),
        released_cycle: clampNumber(body.released_cycle, 0, 1e6, 0),
        ratings: worldFilms.get(String(body.id).slice(0, 80))?.ratings ?? 0
      });
      send(response, 200, { published: true, total: worldFilms.size });
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/world/films") {
      const list = [...worldFilms.values()].sort((a, b) => b.score - a.score);
      send(response, 200, { films: list, total: list.length });
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/world/ratings") {
      const body = await readJsonBody(request);
      const film = body && body.film_id ? worldFilms.get(String(body.film_id)) : null;
      const rating = clampNumber(body?.rating, 1, 5, null);
      if (!film || rating === null) {
        send(response, 404, { error: "Unknown film or bad rating." });
        return;
      }
      film.score = clampNumber(film.score + (rating >= 4 ? 1 : rating <= 2 ? -1 : 0), 1, 99);
      film.ratings = (film.ratings ?? 0) + 1;
      send(response, 200, { film_id: film.id, score: film.score, ratings: film.ratings });
      return;
    }

    send(response, 404, { error: "Unknown world endpoint." });
    return;
  }

  // ---- Local image/3D generation seam --------------------------------------
  // Point TAKEONE_3D_BASE_URL at a self-hosted open checkpoint server
  // (Hunyuan3D 2.x, TRELLIS, Shap-E...) exposing POST {prompt} -> {glb_base64}
  // or {url}. Until configured, this reports capability honestly instead of
  // pretending to generate meshes.
  if (url.pathname === "/v1/assets/generate" && request.method === "POST") {
    const body = await readJsonBody(request);
    const prompt = String(body?.prompt ?? "").trim().slice(0, 1000);
    if (prompt.length < 3) {
      send(response, 422, { error: "Describe the asset in at least three characters." });
      return;
    }
    if (!takeOne3dBaseUrl) {
      send(response, 501, {
        error: "No local 3D-generation service configured.",
        hint: "Self-host Hunyuan3D 2.x / TRELLIS / Shap-E and set TAKEONE_3D_BASE_URL to its HTTP endpoint. Expected contract: POST {prompt} -> {glb_base64} | {url} | {object_url}."
      });
      return;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 180000);
      const upstream = await fetch(`${takeOne3dBaseUrl}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!upstream.ok) throw new Error(`3D service HTTP ${upstream.status}`);
      send(response, 200, await upstream.json());
    } catch (error) {
      send(response, 502, { error: `Local 3D service failure: ${error.message}` });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/health") {
    send(response, 200, {
      service: "take-one-ai-adapter",
      llm: { enabled: Boolean(llmApiKey), model: llmModel, base_url: llmBaseUrl },
      endpoints: ["/v1/scenes/generate", "/v1/director/beat", "/v1/npc/line", "/v1/cast/suggest", "/v1/jobs", "/v1/world/films", "/v1/films/:id/video.mp4", "/v1/assets/generate"],
      ffmpeg: { enabled: true, resolved: resolveFfmpeg() },
      local3d: { configured: Boolean(takeOne3dBaseUrl), base_url: takeOne3dBaseUrl || null }
    });
    return;
  }

  const isGetJobs = request.method === "GET" && url.pathname.startsWith("/v1/jobs");
  if (request.method !== "POST" && !isGetJobs) {
    send(response, 405, { error: "Method not allowed" });
    return;
  }

  let body = {};
  if (request.method === "POST") {
    const parsed = await readJsonBody(request);
    if (parsed === null) {
      send(response, 400, { error: "Invalid or oversized JSON body" });
      return;
    }
    body = parsed;
  }

  const prompt = String(body.prompt ?? "").trim().slice(0, 4000);
  const requiresPrompt = url.pathname === "/v1/scenes/generate" || url.pathname === "/v1/director/beat";
  if (requiresPrompt && prompt.length < 3) {
    send(response, 422, { error: "Describe the direction in at least three characters." });
    return;
  }

  try {
    if (url.pathname === "/v1/scenes/generate") {
      const scene = await buildScene(prompt);
      send(response, 200, scene);
      return;
    }

    if (url.pathname === "/v1/director/beat") {
      if (llmApiKey) {
        try {
          const raw = await llmJson(BEAT_SYSTEM_PROMPT, JSON.stringify({ direction: prompt, context: body.context ?? {} }), 700);
          send(response, 200, {
            setting: String(raw.setting ?? body.context?.title ?? "Untitled").slice(0, 200),
            mood: String(raw.mood ?? "").slice(0, 200),
            shot: String(raw.shot ?? "").slice(0, 200),
            action: Array.isArray(raw.action) ? raw.action.map(item => String(item).slice(0, 240)).slice(0, 5) : [],
            quality_hint: clampNumber(raw.quality_hint, 1, 10, 6),
            source: "llm"
          });
          return;
        } catch (error) {
          console.error(`beat LLM failed, using local generator: ${error.message}`);
        }
      }
      send(response, 200, localBeat(prompt, body.context));
      return;
    }

    if (url.pathname === "/v1/npc/line") {
      const character = typeof body.character === "object" && body.character !== null ? body.character : {};
      const payload = { character, direction: prompt, history: body.history ?? [] };
      if (llmApiKey) {
        try {
          const raw = await llmJson(LINE_SYSTEM_PROMPT, JSON.stringify(payload), 350);
          send(response, 200, {
            line: String(raw.line ?? "").slice(0, 260),
            reaction: String(raw.reaction ?? "").slice(0, 400),
            source: "llm"
          });
          return;
        } catch (error) {
          console.error(`npc LLM failed, using local generator: ${error.message}`);
        }
      }
      send(response, 200, localNpcLine(payload));
      return;
    }

    if (url.pathname === "/v1/cast/suggest") {
      const context = typeof body.context === "object" && body.context !== null ? body.context : {};
      if (llmApiKey) {
        try {
          const raw = await llmJson(CAST_SYSTEM_PROMPT, JSON.stringify({ ...context, count: clampNumber(context.count, 1, 4, 3) }), 600);
          if (Array.isArray(raw.cast)) {
            send(response, 200, {
              cast: raw.cast.slice(0, 4).map((member, index) => ({
                name: String(member.name ?? NAME_POOL[index]).slice(0, 80),
                role: member.role === "Lead" ? "Lead" : "Supporting",
                archetype: String(member.archetype ?? "professional").slice(0, 120),
                trait: String(member.trait ?? "composed under pressure").slice(0, 200),
                quirk: String(member.quirk ?? "").slice(0, 200),
                source: "llm"
              }))
            });
            return;
          }
        } catch (error) {
          console.error(`cast LLM failed, using local generator: ${error.message}`);
        }
      }
      send(response, 200, { cast: localCast(context) });
      return;
    }

    if (url.pathname === "/v1/jobs" && request.method === "POST") {
      // Enqueue a set build. The scene is generated immediately (LLM or local)
      // so Unreal receives a ready-to-build spec when it claims the job.
      const scene = await buildScene(prompt);
      jobCounter += 1;
      const castCount = Number.isInteger(body.cast_count) ? Math.min(3, Math.max(0, body.cast_count)) : 2;
      const job = { id: `job_${Date.now()}_${jobCounter}`, prompt, film_id: String(body.film_id ?? ""), cast_count: castCount, created: new Date().toISOString(), scene };
      pendingJobs.push(job);
      while (pendingJobs.length > MAX_QUEUE) pendingJobs.shift();
      console.log(`Queued ${job.id} (${scene.objects?.length ?? 0} objects); queue depth ${pendingJobs.length}`);
      send(response, 200, { id: job.id, queued: true, depth: pendingJobs.length });
      return;
    }

    if (url.pathname === "/v1/jobs/next" && request.method === "GET") {
      // FIFO claim: each job is handed to exactly one consumer.
      const job = pendingJobs.shift() ?? null;
      send(response, 200, { job });
      return;
    }

    if (url.pathname === "/v1/jobs/peek" && request.method === "GET") {
      send(response, 200, { job: pendingJobs[0] ?? null, depth: pendingJobs.length });
      return;
    }

    send(response, 404, { error: "Unknown endpoint" });
  } catch (error) {
    send(response, 500, { error: `Adapter failure: ${error.message}` });
  }
});

if (process.argv.includes("--check")) {
  const sampleScene = localScene("rain-dark railway station at night");
  const lamp = localDecompose({
    id: "lamp_test", label: "Platform lamp", primitive: "cylinder",
    location: { x: 0, y: 0, z: 300 }, rotation: { pitch: 0, yaw: 0, roll: 0 },
    scale: { x: 2, y: 2, z: 6 }, color: "#FF9E3D", cast_shadow: true, asset_hint: "warm tungsten station practical light"
  });
  const checks = [
    sampleScene.schema_version === "1.0",
    sampleScene.objects.length > 0,
    sampleScene.objects.every(item => /^#[0-9A-F]{6}$/.test(item.color)),
    sampleScene.objects.every(item => /^[A-Za-z0-9_-]{1,64}$/.test(item.id)),
    typeof localBeat("a tense chase across rooftops", {}).quality_hint === "number",
    localCast({ count: 3 }).length === 3,
    typeof localNpcLine({ character: ARCHETYPES[0], direction: "play it smaller" }).line === "string",
    lamp.length >= 3 && lamp.every(part => /^#[0-9A-F]{6}$/.test(part.color) && part.scale.z > 0)
  ];
  if (checks.every(Boolean)) {
    console.log("self-check passed");
    process.exit(0);
  }
  console.error("self-check FAILED");
  process.exit(1);
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Take One AI adapter listening on http://127.0.0.1:${port}`);
  console.log(`LLM: ${llmApiKey ? `enabled (${llmModel} @ ${llmBaseUrl})` : "disabled — serving deterministic local generators"}`);
});
