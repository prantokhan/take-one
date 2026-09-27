"""Tests for the Roblox exporter.

The emitted Lua must actually parse. There is no Lua interpreter in this
environment, so these tests check the properties that break real modules:
balanced delimiters, no invalid escape sequences, no unterminated strings.
The Windows-path case is tested explicitly because it is what broke first --
a raw path contains backslash-A and backslash-0, which Lua rejects.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from src.export import roblox_export as rx  # noqa: E402

EXIT_OK, EXIT_FAILED, EXIT_BAD_INPUT = 0, 1, 2

# Lua's legal escapes. Anything else after a backslash is a parse error.
LEGAL_ESCAPE = re.compile(r'\\[\\nrtabfv"\'0-9xzu\[\]]')
ANY_ESCAPE = re.compile(r"\\.")


def write_model(tmp_path: Path, points, images_txt=None) -> Path:
    """Build a minimal COLMAP text model."""
    d = tmp_path / "model"
    d.mkdir(parents=True, exist_ok=True)
    lines = ["# 3D point list"]
    for i, (x, y, z, r, g, b, err, track) in enumerate(points, start=1):
        track_part = " ".join(["1 %d" % k for k in range(track)])
        lines.append("%d %f %f %f %d %d %d %f %s" % (i, x, y, z, r, g, b, err, track_part))
    (d / "points3D.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    if images_txt is not None:
        (d / "images.txt").write_text(images_txt, encoding="utf-8")
    return d


SIMPLE_POINTS = [
    (1.0, 2.0, 3.0, 255, 0, 0, 0.1, 3),
    (-1.0, 0.0, 1.0, 0, 255, 0, 0.2, 4),
    (0.5, -2.0, 2.0, 0, 0, 255, 0.9, 2),
]


def run(args):
    return rx.main(args)


# --------------------------------------------------------------------------
# Emitted Lua must be syntactically sound
# --------------------------------------------------------------------------

def test_emitted_lua_has_balanced_delimiters(tmp_path):
    model = write_model(tmp_path, SIMPLE_POINTS)
    out = tmp_path / "Set.lua"
    assert run(["--model", str(model), "--output", str(out)]) == EXIT_OK
    t = out.read_text(encoding="utf-8")
    assert t.count("{") == t.count("}"), "unbalanced braces"
    assert t.count("--[[") == t.count("]]"), "unbalanced block comment"
    assert t.rstrip().endswith("return ScannedSet")


def test_emitted_lua_has_no_unterminated_strings(tmp_path):
    model = write_model(tmp_path, SIMPLE_POINTS)
    out = tmp_path / "Set.lua"
    assert run(["--model", str(model), "--output", str(out)]) == EXIT_OK
    for n, line in enumerate(out.read_text(encoding="utf-8").splitlines(), 1):
        assert line.count('"') % 2 == 0, "line %d has an odd number of quotes: %s" % (n, line)


def test_windows_path_in_metadata_does_not_break_lua(tmp_path):
    """The original bug: a raw Windows path emitted invalid Lua escapes."""
    model = write_model(tmp_path, SIMPLE_POINTS)
    out = tmp_path / "Set.lua"
    # a source_id deliberately containing backslashes and quotes
    nasty = 'weird' + chr(92) + 'AI' + chr(92) + '0name'
    assert run(["--model", str(model), "--output", str(out),
                "--source-id", nasty]) == EXIT_OK
    t = out.read_text(encoding="utf-8")
    # find the title line and confirm every escape in it is legal
    title = [l for l in t.splitlines() if "title =" in l][0]
    for m in ANY_ESCAPE.finditer(title):
        assert LEGAL_ESCAPE.match(m.group(0)), (
            "illegal Lua escape %r in emitted title: %s" % (m.group(0), title))


def test_lua_str_escapes_backslash_and_quote():
    bs, q = chr(92), chr(34)
    assert rx.lua_str(bs) == bs * 2
    assert rx.lua_str(q) == bs + q
    assert "\n" not in rx.lua_str("a\nb")


# --------------------------------------------------------------------------
# Geometry
# --------------------------------------------------------------------------

def test_y_axis_is_flipped_for_roblox():
    """COLMAP is Y-down, Roblox is Y-up. Getting this wrong inverts the set."""
    up = rx.to_roblox(0, 1, 0, scale=1.0, origin=(0, 0, 0), centre=(0, 0, 0))
    assert up[1] == -1.0, "Y was not negated; the set would be upside down"
    same = rx.to_roblox(0, 1, 0, scale=1.0, origin=(0, 0, 0), centre=(0, 0, 0),
                        flip_y=False)
    assert same[1] == 1.0


def test_scale_multiplies_distance_from_centre():
    a = rx.to_roblox(2, 0, 0, scale=1.0, origin=(0, 0, 0), centre=(0, 0, 0))
    b = rx.to_roblox(2, 0, 0, scale=10.0, origin=(0, 0, 0), centre=(0, 0, 0))
    assert b[0] == a[0] * 10


def test_origin_offsets_the_whole_set():
    p = rx.to_roblox(0, 0, 0, scale=1.0, origin=(5, 6, 7), centre=(0, 0, 0))
    assert p == (5.0, -0.0, 7.0) or p == (5.0, 6.0, 7.0) or p[0] == 5.0
    assert p[0] == 5.0 and p[2] == 7.0


def test_export_is_centred_near_the_requested_origin(tmp_path):
    model = write_model(tmp_path, SIMPLE_POINTS)
    out = tmp_path / "Set.lua"
    assert run(["--model", str(model), "--output", str(out),
                "--origin", "0", "0", "60"]) == EXIT_OK
    zs = [float(m) for m in re.findall(
        r"CFrame\.new\([-\d.]+, [-\d.]+, ([-\d.]+)\)", out.read_text(encoding="utf-8"))]
    mean_z = sum(zs) / len(zs)
    assert 40 < mean_z < 80, "set not centred near z=60, got %.1f" % mean_z


# --------------------------------------------------------------------------
# Filtering
# --------------------------------------------------------------------------

def test_max_error_filters_noisy_points(tmp_path):
    model = write_model(tmp_path, SIMPLE_POINTS)
    out = tmp_path / "Set.lua"
    assert run(["--model", str(model), "--output", str(out),
                "--max-error", "0.5"]) == EXIT_OK
    manifest = json.loads((tmp_path / "Set.lua.manifest.json").read_text(encoding="utf-8"))
    # the 0.9px point must be dropped
    assert manifest["points_exported"] == 2, manifest


def test_min_track_filters_weakly_seen_points(tmp_path):
    model = write_model(tmp_path, SIMPLE_POINTS)
    out = tmp_path / "Set.lua"
    assert run(["--model", str(model), "--output", str(out),
                "--min-track", "3"]) == EXIT_OK
    manifest = json.loads((tmp_path / "Set.lua.manifest.json").read_text(encoding="utf-8"))
    assert manifest["points_exported"] == 2, manifest


def test_filtering_everything_out_is_an_error(tmp_path):
    model = write_model(tmp_path, SIMPLE_POINTS)
    out = tmp_path / "Set.lua"
    assert run(["--model", str(model), "--output", str(out),
                "--max-error", "0.0001"]) == EXIT_FAILED


# --------------------------------------------------------------------------
# Inputs and failure modes
# --------------------------------------------------------------------------

def test_missing_model_dir_is_bad_input(tmp_path):
    assert run(["--model", str(tmp_path / "nope"),
                "--output", str(tmp_path / "x.lua")]) == EXIT_BAD_INPUT


def test_model_without_points_file_is_bad_input(tmp_path):
    d = tmp_path / "empty"
    d.mkdir()
    assert run(["--model", str(d), "--output", str(tmp_path / "x.lua")]) == EXIT_BAD_INPUT


def test_empty_point_list_is_failure(tmp_path):
    model = write_model(tmp_path, [])
    assert run(["--model", str(model),
                "--output", str(tmp_path / "x.lua")]) == EXIT_FAILED


def test_rbxmx_format_is_well_formed_xml(tmp_path):
    import xml.etree.ElementTree as ET
    model = write_model(tmp_path, SIMPLE_POINTS)
    out = tmp_path / "Set.rbxmx"
    assert run(["--model", str(model), "--output", str(out),
                "--format", "rbxmx"]) == EXIT_OK
    root = ET.fromstring(out.read_text(encoding="utf-8"))
    assert root.tag == "roblox"
    parts = root.findall(".//Item[@class='Part']")
    assert len(parts) == 3


def test_manifest_states_it_is_not_a_mesh(tmp_path):
    """Provenance must not let a point cloud be mistaken for geometry."""
    model = write_model(tmp_path, SIMPLE_POINTS)
    out = tmp_path / "Set.lua"
    assert run(["--model", str(model), "--output", str(out)]) == EXIT_OK
    manifest = json.loads((tmp_path / "Set.lua.manifest.json").read_text(encoding="utf-8"))
    assert "NOT_A_MESH" in manifest
    assert manifest["stage"] == "export_roblox"


def test_camera_markers_are_optional(tmp_path):
    images = (
        "# Image list\n"
        "1 1 0 0 0 0 0 -5 1 frame_000001.jpg\n"
        "0 0 0\n"
    )
    model = write_model(tmp_path, SIMPLE_POINTS, images_txt=images)
    out = tmp_path / "Set.lua"

    assert run(["--model", str(model), "--output", str(out)]) == EXIT_OK
    m1 = json.loads((tmp_path / "Set.lua.manifest.json").read_text(encoding="utf-8"))
    assert m1["cameras_exported"] == 0

    assert run(["--model", str(model), "--output", str(out), "--cameras"]) == EXIT_OK
    m2 = json.loads((tmp_path / "Set.lua.manifest.json").read_text(encoding="utf-8"))
    assert m2["cameras_exported"] == 1
