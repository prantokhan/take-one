"""Tests for the frame extraction stage.

The property that matters most here is that the license gate is not
bypassable by accident: extraction must refuse an unlisted file even when
the file exists and is perfectly valid video.

Tests that need real video generate it with ffmpeg's lavfi testsrc, so no
licensed footage is involved and nothing has to be committed.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "scripts"))

from src.extract import extract_frames  # noqa: E402

EXIT_OK, EXIT_FAILED, EXIT_ENV = 0, 1, 2

FFMPEG = extract_frames.find_tool("ffmpeg")
needs_ffmpeg = pytest.mark.skipif(FFMPEG is None, reason="ffmpeg not installed")

GOOD_SOURCES = REPO / "tests" / "fixtures" / "sources_good.json"


def make_video(path: Path, seconds=2, fps=30, size="320x240"):
    """Synthetic test video -- no licensing questions."""
    path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [FFMPEG, "-y", "-f", "lavfi",
           "-i", "testsrc=size=%s:rate=%d:duration=%d" % (size, fps, seconds),
           "-pix_fmt", "yuv420p", str(path)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    assert r.returncode == 0, r.stderr[-800:]
    return path


# --------------------------------------------------------------------------
# The gate is the point
# --------------------------------------------------------------------------

@needs_ffmpeg
def test_unlisted_video_is_refused_even_though_it_exists(tmp_path):
    """A real, readable, valid video that nobody cleared must not be processed."""
    vid = make_video(tmp_path / "not_in_catalog.mp4")
    out = tmp_path / "frames"
    rc = extract_frames.main([
        "--input", str(vid), "--output", str(out),
        "--sources", str(GOOD_SOURCES)])
    assert rc == EXIT_FAILED, "extraction proceeded on an uncleared file"
    assert not list(out.glob("*.jpg")), "frames were written despite gate failure"


@needs_ffmpeg
def test_listed_video_is_extracted(tmp_path):
    """The cleared filename from sources_good.json passes and produces frames."""
    vid = make_video(tmp_path / "nosferatu_1922.mp4", seconds=3, fps=30)
    out = tmp_path / "frames"
    rc = extract_frames.main([
        "--input", str(vid), "--output", str(out),
        "--sources", str(GOOD_SOURCES), "--fps", "2", "--keep-blurry"])
    assert rc == EXIT_OK
    frames = sorted(out.glob("frame_*.jpg"))
    assert len(frames) == 6, "expected 3s @ 2fps = 6 frames, got %d" % len(frames)
    assert frames[0].name == "frame_000001.jpg", "naming must be zero-padded sequential"


@needs_ffmpeg
def test_missing_file_fails_even_if_listed(tmp_path):
    """Listed in the catalog but absent from disk is still a failure."""
    rc = extract_frames.main([
        "--input", str(tmp_path / "nosferatu_1922.mp4"),
        "--output", str(tmp_path / "frames"),
        "--sources", str(GOOD_SOURCES)])
    assert rc == EXIT_FAILED


# --------------------------------------------------------------------------
# Provenance ledger
# --------------------------------------------------------------------------

@needs_ffmpeg
def test_manifest_records_provenance(tmp_path):
    vid = make_video(tmp_path / "nosferatu_1922.mp4", seconds=2, fps=30)
    out = tmp_path / "frames"
    rc = extract_frames.main([
        "--input", str(vid), "--output", str(out),
        "--sources", str(GOOD_SOURCES), "--fps", "2", "--keep-blurry"])
    assert rc == EXIT_OK

    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["stage"] == "extract"
    # the chain of custody: which cleared record authorised this
    assert manifest["source_record"]["source_id"] == "nosferatu_1922"
    assert manifest["source_record"]["license_status"] == "public_domain"
    assert manifest["source_record"]["gate_bypassed"] is False
    # parameters must be reproducible from the manifest alone
    assert manifest["parameters"]["fps"] == 2.0
    assert manifest["outputs"]["frames_kept"] > 0
    assert manifest["input"]["filename"] == "nosferatu_1922.mp4"


@needs_ffmpeg
def test_manifest_marks_a_bypassed_gate(tmp_path):
    """If the gate is skipped the manifest must say so -- provenance cannot lie."""
    vid = make_video(tmp_path / "whatever.mp4", seconds=1, fps=30)
    out = tmp_path / "frames"
    rc = extract_frames.main([
        "--input", str(vid), "--output", str(out),
        "--fps", "2", "--keep-blurry", "--skip-gate"])
    assert rc == EXIT_OK
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["source_record"]["gate_bypassed"] is True
    assert manifest["source_record"]["source_id"] is None


# --------------------------------------------------------------------------
# Frame rate handling
# --------------------------------------------------------------------------

@needs_ffmpeg
@pytest.mark.parametrize("fps,seconds,expected", [(2, 3, 6), (5, 2, 10), (1, 4, 4)])
def test_fps_controls_frame_count(tmp_path, fps, seconds, expected):
    vid = make_video(tmp_path / "nosferatu_1922.mp4", seconds=seconds, fps=30)
    out = tmp_path / "frames"
    rc = extract_frames.main([
        "--input", str(vid), "--output", str(out),
        "--sources", str(GOOD_SOURCES), "--fps", str(fps), "--keep-blurry"])
    assert rc == EXIT_OK
    got = len(list(out.glob("frame_*.jpg")))
    assert got == expected, "fps=%s over %ss should give %d frames, got %d" % (
        fps, seconds, expected, got)


@needs_ffmpeg
def test_probe_reports_frame_rate(tmp_path):
    vid = make_video(tmp_path / "probe.mp4", seconds=1, fps=30)
    meta = extract_frames.probe(extract_frames.find_tool("ffprobe"), vid)
    assert meta["width"] == 320 and meta["height"] == 240
    assert abs(meta["_r_fps"] - 30.0) < 0.01
    # constant-rate source must not be flagged as variable
    assert meta["_variable_frame_rate"] is False


# --------------------------------------------------------------------------
# Environment
# --------------------------------------------------------------------------

def test_missing_ffmpeg_is_env_problem(tmp_path, monkeypatch):
    """A missing toolchain is exit 2 (fix your environment), not exit 1."""
    monkeypatch.setattr(extract_frames, "find_tool", lambda name: None)
    vid = tmp_path / "nosferatu_1922.mp4"
    vid.write_bytes(b"not really a video, never read")
    rc = extract_frames.main([
        "--input", str(vid), "--output", str(tmp_path / "f"),
        "--sources", str(GOOD_SOURCES)])
    assert rc == EXIT_ENV


def test_find_tool_locates_ffmpeg_if_installed():
    """Guards the winget-Links fallback: if ffmpeg is installed we must find it."""
    if shutil.which("ffmpeg") is None and FFMPEG is None:
        pytest.skip("ffmpeg genuinely not installed")
    assert extract_frames.find_tool("ffmpeg") is not None
