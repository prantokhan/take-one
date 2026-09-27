#!/usr/bin/env python3
"""Thin CI wrapper: validate sources.json and exit non-zero on any problem.

This is deliberately a wrapper around preflight.py rather than a second
implementation. Two validators drift apart; one validator with two entry
points cannot.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from preflight import main as preflight_main  # noqa: E402

if __name__ == "__main__":
    # No --input: validates the catalog itself rather than clearing a file.
    sys.exit(preflight_main(sys.argv[1:]))
