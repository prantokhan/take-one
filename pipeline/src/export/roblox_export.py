#!/usr/bin/env python3
"""Stage 4 (partial): COLMAP/GLOMAP sparse model -> Roblox.

WHAT THIS DOES AND DOES NOT DO
------------------------------
This exports a *sparse point cloud* as Roblox Parts. It does NOT produce a
mesh. Meshing (poisson_mesher / delaunay_mesher) needs a dense point cloud
from MVS, which needs CUDA; see check_env.py --stage dense. With ~10^2
points there is no surface to reconstruct, so pretending otherwise would
just produce garbage geometry.

What you get is the reconstruction rendered as blocks: one small anchored
Part per 3D point, coloured by the point's own RGB (COLMAP samples this
from the source images). Optionally camera markers showing where each
registered frame was shot from.

Two output formats:
  --format luau   a Lua module returning the same {objects={...}} table
                  shape SceneGenerator.Generate() returns, so the existing
                  BuildSceneHandler can build it unchanged.
  --format rbxmx  a standalone Roblox XML model you can drag into Studio.

Coordinate conversion is the fiddly part; see to_roblox() below.

    python -m src.export.roblox_export \
        --model D:/AI/e2e/model/0 --output ScannedSet.lua

Exit codes: 0 ok, 1 export failed, 2 bad input/model not found.
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

EXIT_OK, EXIT_FAILED, EXIT_BAD_INPUT = 0, 1, 2

# Roblox studs per reconstruction unit. SfM output has arbitrary scale --
# there is no metric ground truth without a reference object in frame, so
# this is a presentation choice, not a measurement.
DEFAULT_SCALE = 8.0
DEFAULT_POINT_SIZE = 0.6
# Matches SET_ORIGIN in BuildSceneHandler.server.lua so the scanned set
# lands in the same place as a generated one.
DEFAULT_ORIGIN = (0.0, 0.0, 60.0)

BACKSLASH = chr(92)
QUOTE = chr(34)


def lua_str(value) -> str:
    """Escape a value for embedding in a Lua double-quoted string literal.

    Windows paths are why this exists. An unescaped drive path contains
    sequences like backslash-A (an invalid escape in Lua) and backslash-0
    (a null escape), which would make the emitted module fail to parse.
    """
    text = str(value)
    text = text.replace(BACKSLASH, BACKSLASH * 2)
    text = text.replace(QUOTE, BACKSLASH + QUOTE)
    text = text.replace("\n", " ")
    text = text.replace("\r", " ")
    return text


def read_points3D_text(path: Path) -> list:
    """Parse COLMAP points3D.txt -> [(x,y,z,r,g,b,error,track_len), ...]."""
    pts = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        f = line.split()
        if len(f) < 8:
            continue
        try:
            x, y, z = float(f[1]), float(f[2]), float(f[3])
            r, g, b = int(f[4]), int(f[5]), int(f[6])
            err = float(f[7])
        except ValueError:
            continue
        track = (len(f) - 8) // 2
        pts.append((x, y, z, r, g, b, err, track))
    return pts


def read_points3D_binary(path: Path) -> list:
    """Parse COLMAP points3D.bin (used when no TXT export exists)."""
    pts = []
    with path.open("rb") as fh:
        (count,) = struct.unpack("<Q", fh.read(8))
        for _ in range(count):
            struct.unpack("<Q", fh.read(8))                      # point id
            x, y, z = struct.unpack("<ddd", fh.read(24))
            r, g, b = struct.unpack("<BBB", fh.read(3))
            (err,) = struct.unpack("<d", fh.read(8))
            (tlen,) = struct.unpack("<Q", fh.read(8))
            fh.read(tlen * 8)                                    # track entries
            pts.append((x, y, z, r, g, b, err, tlen))
    return pts


def read_images_text(path: Path) -> list:
    """Parse images.txt -> camera centres [(name, cx, cy, cz), ...].

    COLMAP stores world-to-camera (R|t). The camera centre in world space is
    C = -R^T t, so the quaternion has to be inverted rather than used directly.
    """
    out = []
    lines = [l for l in path.read_text(encoding="utf-8").splitlines()
             if l.strip() and not l.strip().startswith("#")]
    for i in range(0, len(lines), 2):          # every second line is POINTS2D
        f = lines[i].split()
        if len(f) < 10:
            continue
        qw, qx, qy, qz = (float(f[1]), float(f[2]), float(f[3]), float(f[4]))
        tx, ty, tz = (float(f[5]), float(f[6]), float(f[7]))
        name = f[9]
        # R^T from quaternion (transpose == inverse for a rotation matrix)
        r00 = 1 - 2 * (qy * qy + qz * qz)
        r01 = 2 * (qx * qy - qz * qw)
        r02 = 2 * (qx * qz + qy * qw)
        r10 = 2 * (qx * qy + qz * qw)
        r11 = 1 - 2 * (qx * qx + qz * qz)
        r12 = 2 * (qy * qz - qx * qw)
        r20 = 2 * (qx * qz - qy * qw)
        r21 = 2 * (qy * qz + qx * qw)
        r22 = 1 - 2 * (qx * qx + qy * qy)
        cx = -(r00 * tx + r10 * ty + r20 * tz)
        cy = -(r01 * tx + r11 * ty + r21 * tz)
        cz = -(r02 * tx + r12 * ty + r22 * tz)
        out.append((name, cx, cy, cz))
    return out


def to_roblox(x, y, z, scale, origin, centre, flip_y=True):
    """Reconstruction space -> Roblox studs.

    COLMAP is Y-DOWN (computer-vision convention: +Y points toward the
    bottom of the image). Roblox is Y-UP. Without negating Y the whole set
    arrives upside down, which is the single easiest thing to get wrong here.
    """
    cx, cy, cz = centre
    rx = (x - cx) * scale
    ry = (y - cy) * scale
    rz = (z - cz) * scale
    if flip_y:
        ry = -ry
    return (rx + origin[0], ry + origin[1], rz + origin[2])


def load_model(model_dir: Path):
    """Prefer TXT (human-readable); fall back to BIN."""
    p_txt, p_bin = model_dir / "points3D.txt", model_dir / "points3D.bin"
    if p_txt.exists():
        pts = read_points3D_text(p_txt)
    elif p_bin.exists():
        pts = read_points3D_binary(p_bin)
    else:
        raise FileNotFoundError("no points3D.txt or points3D.bin in %s" % model_dir)
    cams = []
    if (model_dir / "images.txt").exists():
        try:
            cams = read_images_text(model_dir / "images.txt")
        except Exception:
            cams = []
    return pts, cams


def build_specs(pts, cams, args):
    """Produce the object list, in SceneGenerator.Generate()'s shape."""
    if not pts:
        return [], (0, 0, 0)

    # Centre on the median so a few far outliers do not shove everything
    # off-origin (the mean is easily dragged by stray triangulations).
    def median(vals):
        s = sorted(vals)
        n = len(s)
        return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2.0

    centre = (median([p[0] for p in pts]),
              median([p[1] for p in pts]),
              median([p[2] for p in pts]))

    specs = []
    for i, (x, y, z, r, g, b, err, track) in enumerate(pts):
        if args.max_error and err > args.max_error:
            continue
        if args.min_track and track < args.min_track:
            continue
        rx, ry, rz = to_roblox(x, y, z, args.scale, args.origin, centre)
        specs.append({
            "id": "point_%05d" % i,
            "label": "Scanned point (err %.3fpx, track %d)" % (err, track),
            "primitive": "Block",
            "pos": (rx, ry, rz),
            "size": (args.point_size,) * 3,
            "color": (r, g, b),
            "castShadow": False,
        })

    if args.cameras and cams:
        for name, cx, cy, cz in cams:
            rx, ry, rz = to_roblox(cx, cy, cz, args.scale, args.origin, centre)
            specs.append({
                "id": "cam_%s" % Path(name).stem,
                "label": "Camera: %s" % name,
                "primitive": "Ball",
                "pos": (rx, ry, rz),
                "size": (args.point_size * 3,) * 3,
                "color": (255, 220, 40),
                "castShadow": False,
            })
    return specs, centre


def emit_luau(specs, meta) -> str:
    """A module returning the same table shape BuildSceneHandler consumes."""
    L = []
    L.append("--[[")
    L.append("  ScannedSet -- generated by pipeline/src/export/roblox_export.py")
    L.append("")
    L.append("  This is a SPARSE POINT CLOUD from photogrammetry, not a mesh.")
    L.append("  Each entry is one triangulated 3D point rendered as a small Part.")
    L.append("")
    for k, v in meta.items():
        # Block comments cannot contain a closing bracket pair; paths are safe
        # here but keep values on one line regardless.
        L.append("  %-22s %s" % (k + ":", str(v).replace("\n", " ")))
    L.append("")
    L.append("  Shape matches SceneGenerator.Generate() so BuildSceneHandler can")
    L.append("  build it with no changes:  require(...).Generate() -> {objects=...}")
    L.append("]]")
    L.append("")
    L.append("local ScannedSet = {}")
    L.append("")
    L.append("local OBJECTS = {")
    for s in specs:
        x, y, z = s["pos"]
        sx, sy, sz = s["size"]
        r, g, b = s["color"]
        L.append("\t{")
        L.append('\t\tid = "%s",' % lua_str(s["id"]))
        L.append('\t\tlabel = "%s",' % lua_str(s["label"]))
        L.append('\t\tprimitive = "%s",' % lua_str(s["primitive"]))
        L.append("\t\tcframe = CFrame.new(%.4f, %.4f, %.4f)," % (x, y, z))
        L.append("\t\tsize = Vector3.new(%.3f, %.3f, %.3f)," % (sx, sy, sz))
        L.append("\t\tcolor = Color3.fromRGB(%d, %d, %d)," % (r, g, b))
        L.append("\t\tcastShadow = %s," % ("true" if s["castShadow"] else "false"))
        L.append("\t},")
    L.append("}")
    L.append("")
    L.append("-- Same signature as SceneGenerator.Generate(prompt); the prompt is")
    L.append("-- ignored because this set came from a scan, not a prompt.")
    L.append("function ScannedSet.Generate(_prompt)")
    L.append("\treturn {")
    L.append('\t\ttitle = "Scanned set: %s",' % lua_str(meta.get("source_id", "unknown")))
    L.append('\t\tsummary = "%d points from photogrammetry (%s)",'
             % (len(specs), lua_str(Path(str(meta.get("model", ""))).name)))
    L.append('\t\tmood = "day",')
    L.append("\t\twater = false,")
    L.append("\t\tobjects = OBJECTS,")
    L.append("\t}")
    L.append("end")
    L.append("")
    L.append("return ScannedSet")
    return "\n".join(L) + "\n"


def emit_rbxmx(specs, meta) -> str:
    """Standalone Roblox XML model -- drag straight into Studio."""
    from xml.sax.saxutils import escape as xml_escape

    P = []
    P.append('<roblox version="4">')
    P.append('<Item class="Folder" referent="RBX0">')
    P.append("<Properties>")
    P.append('<string name="Name">ScannedSet</string>')
    P.append("</Properties>")
    for i, s in enumerate(specs):
        x, y, z = s["pos"]
        sx, sy, sz = s["size"]
        r, g, b = s["color"]
        P.append('<Item class="Part" referent="RBX%d">' % (i + 1))
        P.append("<Properties>")
        P.append('<string name="Name">%s</string>' % xml_escape(s["id"]))
        P.append('<bool name="Anchored">true</bool>')
        P.append('<bool name="CanCollide">false</bool>')
        P.append('<bool name="CastShadow">false</bool>')
        P.append('<token name="shape">%d</token>'
                 % (0 if s["primitive"] == "Ball" else 1))
        P.append('<Vector3 name="size"><X>%.3f</X><Y>%.3f</Y><Z>%.3f</Z></Vector3>'
                 % (sx, sy, sz))
        P.append('<CoordinateFrame name="CFrame">'
                 '<X>%.4f</X><Y>%.4f</Y><Z>%.4f</Z>'
                 '<R00>1</R00><R01>0</R01><R02>0</R02>'
                 '<R10>0</R10><R11>1</R11><R12>0</R12>'
                 '<R20>0</R20><R21>0</R21><R22>1</R22>'
                 '</CoordinateFrame>' % (x, y, z))
        P.append('<Color3uint8 name="Color3uint8">%d</Color3uint8>'
                 % ((255 << 24) | (r << 16) | (g << 8) | b))
        P.append("</Properties>")
        P.append("</Item>")
    P.append("</Item>")
    P.append("</roblox>")
    return "\n".join(P) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Export a sparse SfM model to Roblox")
    ap.add_argument("--model", required=True, help="COLMAP model dir (contains points3D.*)")
    ap.add_argument("--output", required=True, help="Output .lua or .rbxmx path")
    ap.add_argument("--format", choices=["luau", "rbxmx"], default="luau")
    ap.add_argument("--scale", type=float, default=DEFAULT_SCALE)
    ap.add_argument("--point-size", type=float, default=DEFAULT_POINT_SIZE)
    ap.add_argument("--max-error", type=float, default=None,
                    help="Drop points with reprojection error above this (px)")
    ap.add_argument("--min-track", type=int, default=None,
                    help="Drop points seen in fewer than N images")
    ap.add_argument("--cameras", action="store_true",
                    help="Also emit a marker at each registered camera position")
    ap.add_argument("--origin", type=float, nargs=3, default=list(DEFAULT_ORIGIN),
                    metavar=("X", "Y", "Z"))
    ap.add_argument("--source-id", default="unknown",
                    help="sources.json source_id, recorded in the output header")
    args = ap.parse_args(argv)

    model_dir = Path(args.model)
    if not model_dir.is_dir():
        print("Model directory not found: %s" % model_dir, file=sys.stderr)
        return EXIT_BAD_INPUT

    try:
        pts, cams = load_model(model_dir)
    except Exception as exc:
        print("Could not read model: %s" % exc, file=sys.stderr)
        return EXIT_BAD_INPUT

    if not pts:
        print("Model contains no 3D points -- nothing to export.", file=sys.stderr)
        return EXIT_FAILED

    args.origin = tuple(args.origin)
    specs, centre = build_specs(pts, cams, args)
    if not specs:
        print("All %d points were filtered out; loosen --max-error/--min-track."
              % len(pts), file=sys.stderr)
        return EXIT_FAILED

    meta = {
        "source_id": args.source_id,
        "model": str(model_dir),
        "points_in_model": len(pts),
        "points_exported": len([s for s in specs if s["id"].startswith("point_")]),
        "cameras_exported": len([s for s in specs if s["id"].startswith("cam_")]),
        "scale": args.scale,
        "mean_error_px": round(sum(p[6] for p in pts) / len(pts), 4),
        "NOT_A_MESH": "sparse point cloud; dense MVS requires CUDA",
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    text = emit_luau(specs, meta) if args.format == "luau" else emit_rbxmx(specs, meta)
    out.write_text(text, encoding="utf-8")

    sidecar = out.with_suffix(out.suffix + ".manifest.json")
    sidecar.write_text(json.dumps({"stage": "export_roblox", **meta}, indent=2),
                       encoding="utf-8")

    print("Exported %d part(s) -> %s" % (len(specs), out))
    print("  points %d/%d, cameras %d, scale %.1f"
          % (meta["points_exported"], len(pts), meta["cameras_exported"], args.scale))
    print("  manifest: %s" % sidecar)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
