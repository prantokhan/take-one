"""Tests for the environment gate.

These must not assert machine-specific outcomes. This suite runs on laptops
without CUDA and on CI runners without GPUs, so a test like
"dense stage passes" would be a lie on most machines.

What IS machine-independent, and therefore what is tested here:
  - the exit-code contract (0 / 1 / 2)
  - the override actually overrides
  - a stage whose requirements are all zero can never be unmet
  - unmeasurable values are treated as NOT satisfying a requirement

No `assert rc in (0, 1)` style assertions: where the outcome genuinely
depends on hardware, the test branches explicitly on measured capability
rather than accepting either result.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
CHECK_ENV = REPO / "scripts" / "check_env.py"

EXIT_OK, EXIT_UNMET, EXIT_BAD_USAGE = 0, 1, 2

sys.path.insert(0, str(REPO / "scripts"))
import check_env  # noqa: E402


def run(*args):
    return subprocess.run(
        [sys.executable, str(CHECK_ENV), *args],
        capture_output=True, text=True)


# --------------------------------------------------------------------------
# Exit-code contract
# --------------------------------------------------------------------------

def test_unknown_stage_is_bad_usage():
    r = run("--stage", "does_not_exist")
    assert r.returncode == EXIT_BAD_USAGE


def test_missing_stage_argument_is_bad_usage():
    r = run()
    assert r.returncode == EXIT_BAD_USAGE


def test_export_stage_has_no_requirements_so_always_passes():
    """export requires (0, 0, False) -- there is nothing to be unmet."""
    assert check_env.STAGES["export"] == (0, 0, False)
    r = run("--stage", "export", "--quiet")
    assert r.returncode == EXIT_OK, (
        "a stage with zero requirements was refused:\n%s" % r.stderr)


# --------------------------------------------------------------------------
# Hardware-dependent outcomes: branch on measured capability, never
# accept "either answer is fine"
# --------------------------------------------------------------------------

def test_dense_outcome_matches_measured_hardware():
    ram = check_env.total_ram_gb()
    _, vram, has_cuda = check_env.gpu_info()
    min_ram, min_vram, needs_cuda = check_env.STAGES["dense"]

    satisfied = (
        ram is not None and ram >= min_ram
        and vram is not None and vram >= min_vram
        and (has_cuda or not needs_cuda)
    )
    r = run("--stage", "dense", "--quiet")
    if satisfied:
        assert r.returncode == EXIT_OK, (
            "hardware meets dense requirements but gate refused:\n%s" % r.stderr)
    else:
        assert r.returncode == EXIT_UNMET, (
            "hardware does NOT meet dense requirements but gate allowed it "
            "(rc=%d) -- this is the dangerous direction" % r.returncode)


def test_allow_dense_overrides_a_refusal():
    """The override only matters when the stage would otherwise be refused."""
    plain = run("--stage", "dense", "--quiet")
    if plain.returncode == EXIT_OK:
        pytest.skip("this machine satisfies dense requirements; nothing to override")
    overridden = run("--stage", "dense", "--allow-dense", "--quiet")
    assert overridden.returncode == EXIT_OK, (
        "--allow-dense failed to override a refusal:\n%s" % overridden.stderr)
    assert "WARNING" in overridden.stderr, (
        "override proceeded silently; it must warn")


def test_override_does_not_apply_to_non_dense_stages():
    """--allow-dense must not become a blanket bypass."""
    assert "glomap" not in check_env.DENSE_STAGES
    ram = check_env.total_ram_gb()
    min_ram = check_env.STAGES["glomap"][0]
    if ram is not None and ram >= min_ram:
        pytest.skip("this machine satisfies glomap RAM; nothing to override")
    r = run("--stage", "glomap", "--allow-dense", "--quiet")
    assert r.returncode == EXIT_UNMET, (
        "--allow-dense wrongly bypassed a non-dense stage (rc=%d)" % r.returncode)


# --------------------------------------------------------------------------
# Unmeasurable values must not be optimistically assumed fine
# --------------------------------------------------------------------------

def test_unmeasurable_vram_counts_as_unmet(monkeypatch):
    monkeypatch.setattr(check_env, "gpu_info", lambda: (None, None, False))
    monkeypatch.setattr(check_env, "total_ram_gb", lambda: 999.0)
    rc = check_env.main(["--stage", "dense", "--quiet"])
    assert rc == EXIT_UNMET, (
        "unknown VRAM was treated as satisfying an 8 GB requirement")


def test_unmeasurable_ram_counts_as_unmet(monkeypatch):
    monkeypatch.setattr(check_env, "total_ram_gb", lambda: None)
    monkeypatch.setattr(check_env, "gpu_info", lambda: ("fake", 99.0, True))
    rc = check_env.main(["--stage", "sparse", "--quiet"])
    assert rc == EXIT_UNMET, (
        "unknown RAM was treated as satisfying an 8 GB requirement")


def test_sufficient_hardware_passes_when_mocked(monkeypatch):
    """Proves the gate can say yes -- otherwise the tests above prove nothing."""
    monkeypatch.setattr(check_env, "total_ram_gb", lambda: 64.0)
    monkeypatch.setattr(check_env, "gpu_info", lambda: ("mock GPU", 24.0, True))
    rc = check_env.main(["--stage", "dense", "--quiet"])
    assert rc == EXIT_OK, "gate refused hardware that exceeds every requirement"
