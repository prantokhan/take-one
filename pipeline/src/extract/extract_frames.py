#!/usr/bin/env python3
"""Stage 1: video -> frames, with a provenance manifest.

Runs the license gate before touching the video. An unlisted input is
refused here, not merely warned about -- this is the enforcement point the
rest of the pipeline relies on.

    python -m src.extract.extract_frames --input data/raw/film.mp4 \
        --output data/frames/film --fps 2

Exit codes:
    0  frames extracted
    1  input failed the license gate, or extraction failed
    2  repo/environment problem (ffmpeg missing, sources.json broken)
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import preflight  # noqa: E402

EXIT_OK, EXIT_FAILED, EXIT_ENV = 0, 1, 2

# Frames below this Laplacian variance are too blurry to match reliably.
# Matches the "reject frames with Laplacian variance < 100" rule in CLAUDE.md.
DEFAULT_BLUR_THRESHOLD = 100.0


def find_tool(name: str) -> str | None:
    """Locate a binary, including the winget Links dir that may not be on PATH."""
    found = shutil.which(name)
    if found:
        return found
    candidates = [
        Path.home() / "AppData/Local/Microsoft/WinGet/Links" / (name + ".exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def probe(ffprobe: str, video: Path) -> dict:
    """Read stream metadata. Variable frame rate is reported, not silently averaged."""
    cmd = [
        ffprobe, "-v", "error", "-select_streams", "v:0",
        "-show_entries",
        "stream=width,height,r_frame_rate,avg_frame_rate,nb_frames,codec_name,duration",
        "-of", "json", str(video),
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if out.returncode != 0:
        raise RuntimeError("ffprobe failed: %s" % out.stderr.strip())
    streams = json.loads(out.stdout).get("streams") or []
    if not streams:
        raise RuntimeError("no video stream found in %s" % video)
    s = streams[0]

    def ratio(v):
        try:
            n, d = str(v).split("/")
            return float(n) / float(d) if float(d) else None
        except Exception:
            return None

    r = ratio(s.get("r_frame_rate"))
    a = ratio(s.get("avg_frame_rate"))
    s["_r_fps"] = r
    s["_avg_fps"] = a
    # VFR detection: r_frame_rate is the max, avg_frame_rate the mean. A gap
    # means the source is variable-rate and timestamps will not be uniform.
    s["_variable_frame_rate"] = bool(r and a and abs(r - a) / max(r, a) > 0.05)
    return s


def blur_score(path: Path) -> float | None:
    """Laplacian variance. Returns None if OpenCV is unavailable."""
    try:
        import cv2
    except ImportError:
        return None
    import numpy as np
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None
    return float(np.var(cv2.Laplacian(img, cv2.CV_64F)))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Extract frames from a cleared video")
    ap.add_argument("--input", required=True, help="Video file (must be in sources.json)")
    ap.add_argument("--output", required=True, help="Directory to write frames into")
    ap.add_argument("--fps", type=float, default=2.0,
                    help="Frames per second to extract (default 2; spec says 2-5)")
    ap.add_argument("--quality", type=int, default=2, help="ffmpeg -q:v (2 = high)")
    ap.add_argument("--sources", default=str(REPO / "sources.json"))
    ap.add_argument("--blur-threshold", type=float, default=DEFAULT_BLUR_THRESHOLD)
    ap.add_argument("--keep-blurry", action="store_true",
                    help="Score blur but do not discard low-variance frames")
    ap.add_argument("--skip-gate", action="store_true",
                    help=argparse.SUPPRESS)  # deliberately undocumented; see below
    args = ap.parse_args(argv)

    video = Path(args.input)
    outdir = Path(args.output)

    # ---- the gate -------------------------------------------------------
    # There is a --skip-gate flag only so the test suite can exercise the
    # extraction path with synthetic files. It is hidden from --help and
    # prints a warning, because a silent bypass is how enforcement rots.
    if args.skip_gate:
        print("WARNING: license gate BYPASSED (--skip-gate). Never use this on "
              "real footage.", file=sys.stderr)
        record = None
    else:
        rc = preflight.main(["--input", str(video), "--sources", args.sources, "--quiet"])
        if rc != EXIT_OK:
            print("Refusing to extract: license gate returned %d for %s"
                  % (rc, video.name), file=sys.stderr)
            return EXIT_FAILED if rc == 1 else EXIT_ENV
        records = preflight.load_records(Path(args.sources))
        record = preflight.find_record_for(records, video.name)

    if not video.exists():
        print("Input file does not exist on disk: %s" % video, file=sys.stderr)
        return EXIT_FAILED

    ffmpeg = find_tool("ffmpeg")
    ffprobe = find_tool("ffprobe")
    if not ffmpeg or not ffprobe:
        print("REPO PROBLEM: ffmpeg/ffprobe not found. Install with:\n"
              "  winget install Gyan.FFmpeg", file=sys.stderr)
        return EXIT_ENV

    try:
        meta = probe(ffprobe, video)
    except Exception as exc:
        print("Could not probe %s: %s" % (video, exc), file=sys.stderr)
        return EXIT_FAILED

    if meta.get("_variable_frame_rate"):
        print("WARNING: source appears to be variable frame rate "
              "(r=%.3f avg=%.3f). Frame timestamps will not be uniform; "
              "extracted frames are resampled at a constant %.2f fps."
              % (meta["_r_fps"], meta["_avg_fps"], args.fps), file=sys.stderr)

    outdir.mkdir(parents=True, exist_ok=True)
    for old in outdir.glob("frame_*.jpg"):
        old.unlink()

    cmd = [ffmpeg, "-y", "-i", str(video), "-vf", "fps=%s" % args.fps,
           "-q:v", str(args.quality), str(outdir / "frame_%06d.jpg")]
    started = datetime.now(timezone.utc)
    run = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
    if run.returncode != 0:
        print("ffmpeg failed:\n%s" % run.stderr[-2000:], file=sys.stderr)
        return EXIT_FAILED

    frames = sorted(outdir.glob("frame_*.jpg"))
    if not frames:
        print("ffmpeg produced no frames", file=sys.stderr)
        return EXIT_FAILED

    # ---- blur scoring ---------------------------------------------------
    scored, rejected = [], []
    for f in frames:
        v = blur_score(f)
        scored.append((f.name, v))
        if v is not None and v < args.blur_threshold and not args.keep_blurry:
            rejected.append(f.name)
            f.unlink()

    have_scores = any(v is not None for _, v in scored)
    if not have_scores:
        print("NOTE: OpenCV not installed; blur scoring skipped "
              "(pip install opencv-python)", file=sys.stderr)

    kept = sorted(outdir.glob("frame_*.jpg"))

    # ---- provenance ledger ---------------------------------------------
    manifest = {
        "stage": "extract",
        "started_utc": started.isoformat(),
        "finished_utc": datetime.now(timezone.utc).isoformat(),
        "input": {
            "path": str(video),
            "filename": video.name,
            "size_bytes": video.stat().st_size,
        },
        "source_record": {
            "source_id": record.get("source_id") if record else None,
            "license_status": (record or {}).get("license", {}).get("status"),
            "audio_license_status": (record or {}).get("audio_license", {}).get("status"),
            "gate_bypassed": bool(args.skip_gate),
        },
        "video_metadata": {
            "codec": meta.get("codec_name"),
            "width": meta.get("width"),
            "height": meta.get("height"),
            "r_frame_rate": meta.get("r_frame_rate"),
            "avg_frame_rate": meta.get("avg_frame_rate"),
            "variable_frame_rate": meta.get("_variable_frame_rate"),
            "duration_s": meta.get("duration"),
        },
        "parameters": {
            "fps": args.fps,
            "quality": args.quality,
            "blur_threshold": args.blur_threshold,
            "keep_blurry": args.keep_blurry,
        },
        "outputs": {
            "directory": str(outdir),
            "frames_extracted": len(frames),
            "frames_kept": len(kept),
            "frames_rejected_blurry": len(rejected),
            "rejected": rejected,
            "blur_scores": {n: v for n, v in scored} if have_scores else None,
        },
        "tools": {
            "ffmpeg": ffmpeg,
            "ffprobe": ffprobe,
        },
    }
    (outdir / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8")

    print("Extracted %d frame(s), kept %d, rejected %d blurry -> %s"
          % (len(frames), len(kept), len(rejected), outdir))
    print("Manifest: %s" % (outdir / "manifest.json"))
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
