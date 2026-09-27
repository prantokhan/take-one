#!/usr/bin/env python3
"""License gate. Nothing enters the pipeline until this exits 0.

Exit codes (contract -- tests and CI depend on these):
    0  cleared
    1  the requested input failed the gate
    2  repo-level problem (sources.json missing/malformed/invalid)

Structural rules live in schemas/source.schema.json. The rules enforced HERE
are the ones JSON Schema cannot express: "this date is in the past", "this
value is unique across the document", "this field is required only when
another field has a particular value".
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_SOURCES = REPO / "sources.json"
SCHEMA_PATH = REPO / "schemas" / "source.schema.json"

# IA "public domain" tags are uploader-asserted, not verified. A record whose
# only provenance is the uploader is a lead, not a license.
UNTRUSTED_VERIFIERS = {
    "uploader", "ia", "internet_archive", "internetarchive",
    "unknown", "", "n/a", "na", "anonymous", "archive.org",
}

EXIT_OK, EXIT_INPUT_FAILED, EXIT_REPO_PROBLEM = 0, 1, 2

JSONSCHEMA_MISSING = "__JSONSCHEMA_MISSING__"


class GateFailure(Exception):
    """Raised for repo-level problems (exit 2), not per-input rejections."""


def load_records(path: Path) -> list:
    if not path.exists():
        raise GateFailure("sources.json not found at %s" % path)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise GateFailure("%s is not valid JSON: %s" % (path, exc)) from exc
    if not isinstance(data, list):
        raise GateFailure("%s must contain a JSON array of records" % path)
    return data


def validate_schema(records: list) -> list:
    """Structural validation. Returns problems; empty list means clean."""
    try:
        import jsonschema
    except ImportError:
        # Deliberately loud. A silent skip would let malformed records through
        # while the gate still reported success.
        return [JSONSCHEMA_MISSING]

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema)
    problems = []
    for i, rec in enumerate(records):
        label = rec.get("source_id") if isinstance(rec, dict) else None
        if not label:
            label = "record[%d]" % i
        for err in sorted(validator.iter_errors(rec), key=lambda e: list(e.path)):
            loc = ".".join(str(p) for p in err.path) or "(root)"
            problems.append("%s: schema: %s: %s" % (label, loc, err.message))
    return problems


def validate_semantics(records: list) -> list:
    """Rules JSON Schema structurally cannot express."""
    problems = []
    today = date.today()
    seen_ids = {}
    seen_files = {}

    for i, rec in enumerate(records):
        if not isinstance(rec, dict):
            problems.append("record[%d]: not an object" % i)
            continue
        sid = rec.get("source_id") or ("record[%d]" % i)

        # duplicate source_id
        if sid in seen_ids:
            problems.append(
                "%s: duplicate source_id (also record[%d])" % (sid, seen_ids[sid]))
        else:
            seen_ids[sid] = i

        # duplicate filename across records -- every file belongs to exactly one
        for fname in rec.get("files") or []:
            if fname in seen_files:
                problems.append(
                    "%s: file %r already covered by %r" % (sid, fname, seen_files[fname]))
            else:
                seen_files[fname] = sid

        ver = rec.get("verification") or {}

        # uploader-asserted provenance
        verified_by = str(ver.get("verified_by", "")).strip().lower()
        if verified_by in UNTRUSTED_VERIFIERS:
            problems.append(
                "%s: verified_by=%r is uploader-asserted, not verified provenance"
                % (sid, ver.get("verified_by")))

        # 'other' method demands a detail field
        detail = str(ver.get("verification_method_detail", "")).strip()
        if ver.get("verification_method") == "other" and not detail:
            problems.append(
                "%s: verification_method 'other' requires verification_method_detail" % sid)

        # stale review date -- the PD cutoff moves every Jan 1
        nrd = ver.get("next_review_date")
        if nrd:
            try:
                if date.fromisoformat(str(nrd)) < today:
                    problems.append(
                        "%s: next_review_date %s is in the past; re-verify before use"
                        % (sid, nrd))
            except ValueError:
                problems.append("%s: next_review_date %r is not an ISO date" % (sid, nrd))

        # consent is separate from copyright
        consent = rec.get("consent_status") or {}
        if consent.get("applicable") is True and consent.get("model_releases_on_file") is not True:
            problems.append(
                "%s: consent applicable but model_releases_on_file is not true" % sid)

    return problems


def warn_risk_flags(records: list) -> list:
    """Surfaces known gaps. These WARN -- they do not clear anything."""
    warnings = []
    for rec in records:
        if not isinstance(rec, dict):
            continue
        sid = rec.get("source_id", "?")
        flags = rec.get("risk_flags") or {}
        if "contains_trademarks" not in flags:
            warnings.append("%s: risk_flags.contains_trademarks unset (unreviewed)" % sid)
        elif flags.get("contains_trademarks"):
            warnings.append(
                "%s: contains trademarks -- NOT cleared, review before export" % sid)
        if flags.get("contains_architectural_copyright_risk"):
            warnings.append(
                "%s: architectural copyright risk -- freedom of panorama varies by jurisdiction"
                % sid)
        if flags.get("moral_rights_jurisdictions"):
            warnings.append(
                "%s: moral rights may apply in %s (survives copyright expiry)"
                % (sid, ",".join(flags["moral_rights_jurisdictions"])))
    return warnings


def find_record_for(records: list, filename: str):
    """Exact filename match only. No substring, no fuzzy, no inference."""
    for rec in records:
        if isinstance(rec, dict) and filename in (rec.get("files") or []):
            return rec
    return None


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Take One license gate")
    ap.add_argument("--input", help="Input file to clear (exact filename match)")
    ap.add_argument("--sources", default=str(DEFAULT_SOURCES))
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    def say(msg):
        if not args.quiet:
            print(msg)

    try:
        records = load_records(Path(args.sources))
    except GateFailure as exc:
        print("REPO PROBLEM: %s" % exc, file=sys.stderr)
        return EXIT_REPO_PROBLEM

    schema_problems = validate_schema(records)
    if schema_problems == [JSONSCHEMA_MISSING]:
        print("REPO PROBLEM: jsonschema is not installed; cannot validate structure.\n"
              "              pip install jsonschema", file=sys.stderr)
        return EXIT_REPO_PROBLEM

    problems = schema_problems + validate_semantics(records)
    if problems:
        print("GATE FAILED -- sources.json has problems:", file=sys.stderr)
        for p in problems:
            print("  - %s" % p, file=sys.stderr)
        return EXIT_REPO_PROBLEM

    for w in warn_risk_flags(records):
        say("WARNING: %s" % w)

    if not args.input:
        say("sources.json OK: %d record(s) passed the gate." % len(records))
        return EXIT_OK

    name = Path(args.input).name
    rec = find_record_for(records, name)
    if rec is None:
        print("GATE FAILED: %r is not listed in any source record.\n"
              "             Unlisted means uncleared. Add it to sources.json first." % name,
              file=sys.stderr)
        return EXIT_INPUT_FAILED

    say("CLEARED: %s -> %s (%s, audio: %s)"
        % (name, rec["source_id"], rec["license"]["status"], rec["audio_license"]["status"]))
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
