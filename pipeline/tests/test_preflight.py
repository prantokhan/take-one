"""Tests for the license gate.

Every bad fixture must be REJECTED. A gate that is only tested against
good input is theater -- it proves nothing about what it stops.

No test in this file may pass regardless of outcome. Assertions like
`assert rc in (0, 1)` are banned: if a result is environment-dependent,
skip explicitly rather than making the suite green by being vague.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
PREFLIGHT = REPO / "scripts" / "preflight.py"
FIXTURES = Path(__file__).resolve().parent / "fixtures"

EXIT_OK, EXIT_INPUT_FAILED, EXIT_REPO_PROBLEM = 0, 1, 2

# Structural checks need jsonschema. Without it preflight exits 2 by design
# (loudly, rather than silently skipping validation), so schema-dependent
# tests are skipped rather than asserted loosely.
try:
    import jsonschema  # noqa: F401
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

needs_schema = pytest.mark.skipif(
    not HAS_JSONSCHEMA,
    reason="jsonschema not installed; preflight exits 2 before structural checks",
)

# Fixtures rejected by semantic rules (pure Python, no jsonschema needed).
SEMANTIC_BAD = [
    "uploader_verified",
    "ia_verified",
    "stale_review",
    "other_without_detail",
    "consent_missing_releases",
    "duplicate_source_id",
    "duplicate_filename",
]

# Fixtures rejected by the JSON Schema (structure).
SCHEMA_BAD = [
    "bad_source_id_pattern",
    "missing_audio_license",
    "unknown_field",
    "empty_files",
]


def run_gate(sources: Path, input_file: str | None = None):
    cmd = [sys.executable, str(PREFLIGHT), "--sources", str(sources)]
    if input_file:
        cmd += ["--input", input_file]
    return subprocess.run(cmd, capture_output=True, text=True)


def fixture(name: str) -> Path:
    p = FIXTURES / ("sources_bad_%s.json" % name)
    assert p.exists(), "missing fixture: %s" % p
    return p


GOOD = FIXTURES / "sources_good.json"


# --------------------------------------------------------------------------
# The gate must PASS clean input
# --------------------------------------------------------------------------

@needs_schema
def test_good_sources_pass():
    r = run_gate(GOOD)
    assert r.returncode == EXIT_OK, (
        "clean sources.json was rejected:\n%s" % r.stderr)


@needs_schema
def test_listed_file_is_cleared():
    r = run_gate(GOOD, "nosferatu_1922.mp4")
    assert r.returncode == EXIT_OK, r.stderr
    assert "CLEARED" in r.stdout


# --------------------------------------------------------------------------
# The gate must REJECT unlisted input -- the core promise
# --------------------------------------------------------------------------

@needs_schema
def test_unlisted_file_is_rejected():
    r = run_gate(GOOD, "some_random_download.mp4")
    assert r.returncode == EXIT_INPUT_FAILED, (
        "an unlisted file was allowed through (rc=%d)" % r.returncode)
    assert "not listed" in r.stderr


@needs_schema
def test_substring_match_does_not_clear():
    """Exact match only. A near-miss filename must not inherit a license."""
    r = run_gate(GOOD, "nosferatu_1922_REMASTERED.mp4")
    assert r.returncode == EXIT_INPUT_FAILED, (
        "fuzzy/substring filename matching cleared an unlisted file")


@needs_schema
def test_path_does_not_smuggle_clearance():
    """A cleared basename in a different directory is still just the basename."""
    r = run_gate(GOOD, "/tmp/evil/nosferatu_1922.mp4")
    assert r.returncode == EXIT_OK, r.stderr


# --------------------------------------------------------------------------
# Every bad fixture must be rejected, one test per failure mode
# --------------------------------------------------------------------------

@pytest.mark.parametrize("name", SEMANTIC_BAD)
def test_semantic_violations_are_rejected(name):
    r = run_gate(fixture(name))
    assert r.returncode == EXIT_REPO_PROBLEM, (
        "%s was accepted (rc=%d); expected rejection\nstdout:%s\nstderr:%s"
        % (name, r.returncode, r.stdout, r.stderr))
    assert "GATE FAILED" in r.stderr or "REPO PROBLEM" in r.stderr


@needs_schema
@pytest.mark.parametrize("name", SCHEMA_BAD)
def test_schema_violations_are_rejected(name):
    r = run_gate(fixture(name))
    assert r.returncode == EXIT_REPO_PROBLEM, (
        "%s was accepted (rc=%d); expected rejection\nstderr:%s"
        % (name, r.returncode, r.stderr))


# --------------------------------------------------------------------------
# Specific rejection reasons -- not just "it failed", but "it failed for
# the right reason". A gate failing for an unrelated reason is a false pass.
# --------------------------------------------------------------------------

def test_uploader_rejection_names_provenance():
    r = run_gate(fixture("uploader_verified"))
    assert r.returncode == EXIT_REPO_PROBLEM
    assert "uploader-asserted" in r.stderr


def test_stale_review_rejection_names_the_date():
    r = run_gate(fixture("stale_review"))
    assert r.returncode == EXIT_REPO_PROBLEM
    assert "next_review_date" in r.stderr and "past" in r.stderr


def test_consent_rejection_names_releases():
    r = run_gate(fixture("consent_missing_releases"))
    assert r.returncode == EXIT_REPO_PROBLEM
    assert "model_releases_on_file" in r.stderr


def test_duplicate_filename_rejection_names_the_file():
    r = run_gate(fixture("duplicate_filename"))
    assert r.returncode == EXIT_REPO_PROBLEM
    assert "already covered by" in r.stderr


# --------------------------------------------------------------------------
# Repo-level problems are exit 2, distinct from input rejection (exit 1)
# --------------------------------------------------------------------------

def test_missing_sources_is_repo_problem(tmp_path):
    r = run_gate(tmp_path / "does_not_exist.json")
    assert r.returncode == EXIT_REPO_PROBLEM
    assert "not found" in r.stderr


def test_malformed_json_is_repo_problem(tmp_path):
    bad = tmp_path / "sources.json"
    bad.write_text("{ not json at all", encoding="utf-8")
    r = run_gate(bad)
    assert r.returncode == EXIT_REPO_PROBLEM
    assert "not valid JSON" in r.stderr


def test_non_array_sources_is_repo_problem(tmp_path):
    bad = tmp_path / "sources.json"
    bad.write_text(json.dumps({"source_id": "x"}), encoding="utf-8")
    r = run_gate(bad)
    assert r.returncode == EXIT_REPO_PROBLEM
    assert "JSON array" in r.stderr


# --------------------------------------------------------------------------
# risk_flags SURFACE gaps; they do not clear them
# --------------------------------------------------------------------------

@needs_schema
def test_moral_rights_flag_produces_a_warning_not_a_block():
    r = run_gate(GOOD)
    assert r.returncode == EXIT_OK
    assert "moral rights" in r.stdout.lower(), (
        "moral_rights_jurisdictions was set but produced no warning")
