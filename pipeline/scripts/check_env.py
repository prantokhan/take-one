#!/usr/bin/env python3
"""Environment gate. Refuses to start a stage the machine cannot finish.

Exit codes:
    0  environment meets the stage's requirements
    1  requirements not met (use --allow-dense to override dense stages)
    2  unknown stage / bad invocation

Detection is best-effort and deliberately conservative: if a value cannot be
measured it is reported as unknown and treated as NOT satisfying a hard
requirement, rather than optimistically assumed to be fine.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys

# stage -> (min_ram_gb, min_vram_gb, needs_cuda)
STAGES = {
    "extract":     (4,  0,  False),
    "sparse":      (8,  0,  False),
    "dense":       (16, 8,  True),
    "glomap":      (16, 0,  False),
    "clean":       (8,  0,  False),
    "export":      (0,  0,  False),
}

DENSE_STAGES = {"dense"}

EXIT_OK, EXIT_UNMET, EXIT_BAD_USAGE = 0, 1, 2


def total_ram_gb():
    """Returns GB as float, or None if it cannot be determined."""
    try:
        if sys.platform == "win32":
            out = subprocess.run(
                ["wmic", "ComputerSystem", "get", "TotalPhysicalMemory"],
                capture_output=True, text=True, timeout=15)
            for line in out.stdout.split():
                if line.strip().isdigit():
                    return int(line.strip()) / (1024 ** 3)
            # wmic is removed on newer Windows; fall back to PowerShell
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"],
                capture_output=True, text=True, timeout=20)
            digits = out.stdout.strip()
            if digits.isdigit():
                return int(digits) / (1024 ** 3)
        else:
            import os
            return (os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")) / (1024 ** 3)
    except Exception:
        return None
    return None


def gpu_info():
    """Returns (name, vram_gb, has_cuda). Any field may be None/False."""
    if not shutil.which("nvidia-smi"):
        return (None, None, False)
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=15)
        line = out.stdout.strip().splitlines()[0]
        name, mem = [p.strip() for p in line.split(",")]
        return (name, float(mem) / 1024.0, True)
    except Exception:
        return (None, None, False)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Take One environment gate")
    ap.add_argument("--stage", required=True, choices=sorted(STAGES))
    ap.add_argument("--allow-dense", action="store_true",
                    help="Proceed with a dense stage despite unmet requirements")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    min_ram, min_vram, needs_cuda = STAGES[args.stage]
    ram = total_ram_gb()
    gpu_name, vram, has_cuda = gpu_info()

    def say(m):
        if not args.quiet:
            print(m)

    say("stage        : %s" % args.stage)
    say("RAM          : %s (need %d GB)"
        % ("%.1f GB" % ram if ram else "unknown", min_ram))
    say("GPU          : %s" % (gpu_name or "none detected"))
    say("VRAM         : %s (need %s)"
        % ("%.1f GB" % vram if vram else "unknown",
           "%d GB" % min_vram if min_vram else "n/a"))
    say("CUDA         : %s (need %s)" % (has_cuda, needs_cuda))

    unmet = []
    if min_ram:
        if ram is None:
            unmet.append("RAM could not be measured (need %d GB)" % min_ram)
        elif ram < min_ram:
            unmet.append("RAM %.1f GB < %d GB required" % (ram, min_ram))
    if min_vram:
        if vram is None:
            unmet.append("VRAM could not be measured (need %d GB)" % min_vram)
        elif vram < min_vram:
            unmet.append("VRAM %.1f GB < %d GB required" % (vram, min_vram))
    if needs_cuda and not has_cuda:
        unmet.append("CUDA required but no CUDA GPU detected")

    if not unmet:
        say("RESULT       : OK")
        return EXIT_OK

    for u in unmet:
        print("UNMET: %s" % u, file=sys.stderr)

    if args.stage in DENSE_STAGES and args.allow_dense:
        print("WARNING: --allow-dense set; proceeding anyway. Expect OOM or very "
              "long runtimes.", file=sys.stderr)
        return EXIT_OK

    hint = ("Use a lighter stage (sparse/glomap), or pass --allow-dense to override."
            if args.stage in DENSE_STAGES else
            "Use a lighter stage or run this on a bigger machine.")
    print("RESULT: requirements not met. %s" % hint, file=sys.stderr)
    return EXIT_UNMET


if __name__ == "__main__":
    sys.exit(main())
