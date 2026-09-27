#!/usr/bin/env node
// Take One Reel Maker — turns raw gameplay recordings (any Roblox game, any
// recorder) into upload-ready vertical Instagram Reels. Zero npm deps; needs
// ffmpeg + ffprobe on PATH.
//
//   node reel-maker.mjs <file-or-folder> [options]
//   node reel-maker.mjs --watch "C:\Users\me\Videos"      (auto-edit new recordings)
//
// Pipeline per input: loudness scan -> pick best highlight moments ->
// cut + join -> 1080x1920 (blurred-fill or crop) -> hook title + handle
// watermark -> fades -> loudness-normalised audio (+ optional music bed) ->
// H.264/AAC MP4 with faststart.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, watch } from "node:fs";
import path from "node:path";

const VIDEO_EXT = new Set([".mp4", ".mkv", ".mov", ".webm", ".flv", ".avi"]);

function parseArgs(argv) {
  const opts = {
    inputs: [],
    out: null,
    handle: "@take.one.roblox",
    title: "",
    reels: 1,           // how many reels to cut from each recording
    clips: 3,           // highlight moments per reel
    clipLen: 8,         // seconds per highlight
    layout: "blur",     // blur | crop
    music: null,
    musicVol: 0.18,
    watch: false,
    font: "C:/Windows/Fonts/arialbd.ttf",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--out": opts.out = next(); break;
      case "--handle": opts.handle = next(); break;
      case "--title": opts.title = next(); break;
      case "--reels": opts.reels = Math.max(1, +next()); break;
      case "--clips": opts.clips = Math.max(1, +next()); break;
      case "--clip-len": opts.clipLen = Math.max(2, +next()); break;
      case "--layout": opts.layout = next(); break;
      case "--music": opts.music = next(); break;
      case "--music-vol": opts.musicVol = +next(); break;
      case "--font": opts.font = next(); break;
      case "--watch": opts.watch = true; break;
      case "-h": case "--help": usage(); process.exit(0);
      default: opts.inputs.push(a);
    }
  }
  return opts;
}

function usage() {
  console.log(`Take One Reel Maker
  node reel-maker.mjs <file-or-folder> [options]

  --out <dir>        output folder (default: <input dir>/reels)
  --title "text"     hook text shown at the top for the first 3 s
  --handle "@x"      watermark (default @take.one.roblox; "" to disable)
  --reels N          reels per recording (default 1)
  --clips N          highlight moments per reel (default 3)
  --clip-len S       seconds per highlight (default 8)
  --layout blur|crop blurred-fill letterbox (default) or centre crop
  --music file.mp3   background music bed, ducked under game audio
  --music-vol 0.18   music volume
  --watch            keep running; auto-edit new files in the folder`);
}

function run(cmd, args, { capture = "stderr" } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = "";
    p.stdout.on("data", (d) => { if (capture === "stdout") out += d; });
    p.stderr.on("data", (d) => { if (capture === "stderr") out += d; });
    p.on("error", reject);
    p.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}\n${out.slice(-2000)}`)));
  });
}

async function probe(file) {
  const json = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", file], { capture: "stdout" });
  const info = JSON.parse(json);
  const video = info.streams.find((s) => s.codec_type === "video");
  return {
    duration: parseFloat(info.format.duration) || 0,
    hasAudio: info.streams.some((s) => s.codec_type === "audio"),
    width: video?.width || 1920,
    height: video?.height || 1080,
  };
}

// RMS loudness per half-second window. Loud = action (explosions, crowds,
// your reactions), which is a decent zero-config highlight signal.
async function loudnessProfile(file) {
  const out = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn",
    "-af", "aresample=48000,asetnsamples=24000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
    "-f", "null", "-"], { capture: "stdout" });
  const levels = [];
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/RMS_level=(-?[\d.]+|-inf)/);
    if (m) levels.push(m[1] === "-inf" ? -90 : Math.max(-90, parseFloat(m[1])));
  }
  return levels; // index * 0.5 = seconds
}

function pickHighlights(levels, duration, count, clipLen) {
  const step = 0.5;
  const win = Math.round(clipLen / step);
  const usable = Math.max(0, duration - clipLen);
  const picks = [];
  if (levels.length < win || usable <= 0) {
    // Short or silent recording: spread evenly.
    for (let i = 0; i < count; i++) picks.push(usable * (i + 0.5) / count);
    return dedupe(picks, clipLen, duration);
  }
  // Windowed mean loudness, weighted toward peaks.
  const scores = [];
  for (let i = 0; i + win <= levels.length; i++) {
    let sum = 0, peak = -90;
    for (let j = i; j < i + win; j++) { sum += levels[j]; peak = Math.max(peak, levels[j]); }
    scores.push({ start: i * step, score: sum / win * 0.6 + peak * 0.4 });
  }
  scores.sort((a, b) => b.score - a.score);
  for (const s of scores) {
    if (picks.length >= count) break;
    if (s.start > usable) continue;
    if (picks.every((p) => Math.abs(p - s.start) >= clipLen)) picks.push(s.start);
  }
  return picks; // best-first; each reel re-sorts chronologically
}

function dedupe(starts, clipLen, duration) {
  return [...new Set(starts.map((s) => Math.max(0, Math.min(s, duration - clipLen))))];
}

// drawtext needs ':' '\'' ',' escaped; keep it simple and safe.
function esc(text) {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "\\%").replace(/,/g, "\\,");
}

function buildFilter(starts, opts, info) {
  const len = opts.clipLen;
  const total = starts.length * len;
  const font = opts.font.replace(/:/g, "\\:");
  const parts = [];
  const concatIn = [];
  starts.forEach((s, i) => {
    parts.push(`[0:v]trim=start=${s.toFixed(2)}:duration=${len},setpts=PTS-STARTPTS,fps=30,` +
      `fade=t=in:st=0:d=0.25,fade=t=out:st=${len - 0.25}:d=0.25[v${i}]`);
    if (info.hasAudio) {
      parts.push(`[0:a]atrim=start=${s.toFixed(2)}:duration=${len},asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=0.2,afade=t=out:st=${len - 0.2}:d=0.2[a${i}]`);
      concatIn.push(`[v${i}][a${i}]`);
    } else {
      concatIn.push(`[v${i}]`);
    }
  });
  parts.push(`${concatIn.join("")}concat=n=${starts.length}:v=1:a=${info.hasAudio ? 1 : 0}${info.hasAudio ? "[cv][ca]" : "[cv]"}`);

  if (opts.layout === "crop") {
    parts.push(`[cv]scale=-2:1920,crop=1080:1920,setsar=1[fr]`);
  } else {
    parts.push(`[cv]split[bgs][fgs]`);
    parts.push(`[bgs]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.12[bg]`);
    parts.push(`[fgs]scale=1080:-2[fg]`);
    parts.push(`[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[fr]`);
  }

  let v = "[fr]";
  const text = [];
  if (opts.title) {
    text.push(`drawtext=fontfile='${font}':text='${esc(opts.title)}':fontsize=76:fontcolor=white:` +
      `borderw=6:bordercolor=black:x=(w-text_w)/2:y=260:enable='lt(t,3.2)'`);
  }
  if (opts.handle) {
    text.push(`drawtext=fontfile='${font}':text='${esc(opts.handle)}':fontsize=44:fontcolor=white@0.85:` +
      `borderw=3:bordercolor=black@0.6:x=(w-text_w)/2:y=h-300`);
  }
  text.push(`fade=t=in:st=0:d=0.3,fade=t=out:st=${total - 0.4}:d=0.4`);
  parts.push(`${v}${text.join(",")}[vout]`);

  let audioOut = null;
  if (info.hasAudio && opts.music) {
    parts.push(`[1:a]atrim=duration=${total},asetpts=PTS-STARTPTS,volume=${opts.musicVol},afade=t=out:st=${total - 1}:d=1[mus]`);
    parts.push(`[ca][mus]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
    audioOut = "[aout]";
  } else if (info.hasAudio) {
    parts.push(`[ca]loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
    audioOut = "[aout]";
  } else if (opts.music) {
    parts.push(`[1:a]atrim=duration=${total},asetpts=PTS-STARTPTS,afade=t=out:st=${total - 1}:d=1,loudnorm=I=-14:TP=-1.5[aout]`);
    audioOut = "[aout]";
  }
  return { filter: parts.join(";"), audioOut, total };
}

async function makeReels(file, opts) {
  const info = await probe(file);
  if (info.duration < 3) { console.log(`  skip (too short): ${file}`); return []; }
  const clipLen = Math.min(opts.clipLen, info.duration / opts.clips);
  const o = { ...opts, clipLen };

  const levels = info.hasAudio ? await loudnessProfile(file) : [];
  const all = pickHighlights(levels, info.duration, opts.clips * opts.reels, clipLen);

  // Deal highlights round-robin so each reel gets a mix of the best moments.
  const groups = Array.from({ length: opts.reels }, () => []);
  all.forEach((s, i) => groups[i % opts.reels].push(s));

  const outDir = opts.out || path.join(path.dirname(file), "reels");
  mkdirSync(outDir, { recursive: true });
  const base = path.basename(file, path.extname(file));
  const made = [];
  for (let r = 0; r < groups.length; r++) {
    const starts = groups[r].sort((a, b) => a - b);
    if (!starts.length) continue;
    const { filter, audioOut, total } = buildFilter(starts, o, info);
    const outFile = path.join(outDir, `${base}_reel${groups.length > 1 ? r + 1 : ""}.mp4`);
    const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", file];
    if (opts.music) args.push("-stream_loop", "-1", "-i", opts.music);
    args.push("-filter_complex", filter, "-map", "[vout]");
    if (audioOut) args.push("-map", audioOut, "-c:a", "aac", "-b:a", "192k", "-ar", "48000");
    args.push("-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high",
      "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", "-t", total.toFixed(2), outFile);
    console.log(`  reel ${r + 1}/${groups.length}: ${starts.map((s) => fmt(s)).join(", ")} -> ${path.basename(outFile)}`);
    await run("ffmpeg", args);
    made.push(outFile);
  }
  return made;
}

function fmt(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; }

function listVideos(target) {
  if (statSync(target).isDirectory()) {
    return readdirSync(target).filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()))
      .map((f) => path.join(target, f));
  }
  return [target];
}

async function processFile(file, opts) {
  console.log(`> ${path.basename(file)}`);
  try {
    const made = await makeReels(file, opts);
    made.forEach((m) => console.log(`  done: ${m}`));
  } catch (e) {
    console.error(`  failed: ${e.message}`);
  }
}

// Recorders keep writing for a while; wait until the file size stops changing.
async function waitUntilStable(file) {
  let last = -1;
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    if (!existsSync(file)) return false;
    const size = statSync(file).size;
    if (size > 0 && size === last) return true;
    last = size;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.inputs.length) { usage(); process.exit(1); }

  if (opts.watch) {
    const dir = opts.inputs[0];
    const seen = new Set(listVideos(dir));
    const busy = new Set();
    console.log(`Watching ${dir} for new recordings (Ctrl+C to stop)...`);
    watch(dir, async (_evt, name) => {
      if (!name || !VIDEO_EXT.has(path.extname(name).toLowerCase())) return;
      const file = path.join(dir, name);
      if (seen.has(file) || busy.has(file)) return;
      busy.add(file);
      if (await waitUntilStable(file)) { seen.add(file); await processFile(file, opts); }
      busy.delete(file);
    });
    return;
  }

  for (const input of opts.inputs) {
    if (!existsSync(input)) { console.error(`not found: ${input}`); continue; }
    for (const file of listVideos(input)) await processFile(file, opts);
  }
}

main();
