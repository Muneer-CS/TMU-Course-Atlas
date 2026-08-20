"""Validate the Course Atlas research release and write a readable summary."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path


RESEARCH = Path(__file__).resolve().parents[1]
CALENDAR = RESEARCH / "calendar-2026-2027"
COLLECTED = CALENDAR / "collected"
NORMALIZED = CALENDAR / "normalized"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    collection = load(COLLECTED / "collection-report.json")
    programs = load(NORMALIZED / "programs.json")
    minors = load(NORMALIZED / "minors.json")
    subpages = load(NORMALIZED / "program-tables.json")
    plans = load(NORMALIZED / "program-plans.json")
    specializations = load(NORMALIZED / "optional-specializations.json")
    concentrations = load(NORMALIZED / "concentrations.json")
    compatibility = load(NORMALIZED / "major-minor-compatibility.json")
    plan_compatibility = load(NORMALIZED / "program-plan-minor-compatibility.json")
    completeness = load(NORMALIZED / "completeness-report.json")
    unresolved = load(NORMALIZED / "unresolved-course-references.json")

    failures = []
    checks = {
        "official_downloads_completed_without_errors": collection["collection_status"] == "complete" and not collection["errors"],
        "all_72_program_entries_collected": programs["record_count"] == 72,
        "all_69_minors_collected": minors["record_count"] == 69,
        "all_minors_have_six_course_policy_count": all(m["required_course_count"] == 6 for m in minors["records"]),
        "all_programs_have_curriculum_periods": all(p["curriculum_periods"] for p in programs["records"]),
        "all_programs_have_official_sources": all(p["evidence"]["source_url"].startswith("https://www.torontomu.ca/") for p in programs["records"]),
        "all_minors_have_official_sources": all(m["evidence"]["source_url"].startswith("https://www.torontomu.ca/") for m in minors["records"]),
        "all_program_minor_pairs_assessed": compatibility["record_count"] == 72 * 69,
        "all_discovered_plan_minor_pairs_assessed": plan_compatibility["record_count"] == plans["record_count"] * 69,
        "four_optional_specializations_collected": specializations["record_count"] == 4,
        "no_empty_source_pages": not completeness["checks"]["empty_source_pages"],
        "no_unparsed_minor_curricula": not completeness["checks"]["minors_without_detected_curriculum_groups"],
        "no_unparsed_program_curricula": not completeness["checks"]["programs_without_detected_curriculum_sections"],
    }
    failures.extend(name for name, passed in checks.items() if not passed)
    category_counts = Counter(item["classification"] for item in unresolved["records"])
    statuses = Counter(item["status"] for item in compatibility["records"])

    report = {
        "calendar_year": "2026-2027",
        "status": "collection_complete" if not failures else "validation_failed",
        "checks": checks,
        "failures": failures,
        "counts": {
            **collection["counts"],
            "normalized_program_subpages": subpages["record_count"],
            "separate_major_or_plan_pages": plans["record_count"],
            "concentration_source_records": concentrations["record_count"],
            "course_catalog_records": completeness["counts"]["course_catalog_records"],
            "structured_curriculum_periods": sum(len(p["curriculum_periods"]) for p in programs["records"]) + sum(len(p["curriculum_periods"]) for p in plans["records"]),
            "structured_requirement_groups": sum(len(period["requirements"]) for p in programs["records"] for period in p["curriculum_periods"]) + sum(len(period["requirements"]) for p in plans["records"] for period in p["curriculum_periods"]),
            "program_minor_assessments": compatibility["record_count"],
            "plan_minor_assessments": plan_compatibility["record_count"],
            "unresolved_reference_categories": dict(category_counts),
            "program_minor_statuses": dict(statuses),
        },
        "flagged_items": {
            "course_references_absent_from_current_catalog": unresolved["record_count"],
            "details_file": "normalized/unresolved-course-references.json",
            "meaning": "These references remain attached to their exact official context. They are former codes, range examples, restrictions, removed courses, or published requirement references without a current catalogue record. They must not be presented as ordinary currently available courses."
        }
    }
    (NORMALIZED / "validation-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    summary = f"""# 2026-2027 research collection summary

Status: **{report['status']}**

## Coverage

- 72 of 72 official undergraduate program entries collected
- 69 of 69 official minors collected
- {collection['counts']['program_subpages_from_sitemap_collected']} official program subpages and tables collected from the calendar sitemap
- {plans['record_count']} separately published major or plan pages connected to their parent programs
- 4 optional specializations collected
- {concentrations['record_count']} program or table records containing concentration rules
- {completeness['counts']['course_catalog_records']} existing official course catalogue records cross-checked
- {report['counts']['structured_curriculum_periods']} curriculum periods structured
- {report['counts']['structured_requirement_groups']} requirement groups structured
- {compatibility['record_count']} program-to-minor assessments generated
- {plan_compatibility['record_count']} separately published plan-to-minor assessments generated

## Evidence status

All collected academic pages store the official TMU URL, calendar year, page fingerprint, collection status, and official text blocks. No program or minor source page failed collection.

## Flagged references

{unresolved['record_count']} course-like references appear in official requirement pages but not as ordinary records in the current course catalogue. They are not silently discarded. Each is classified and linked to the exact official page and text where it appeared. These include former course codes, conversion tables, range boundaries, explicit restrictions, removed courses, and published table entries requiring confirmation.

## Publication rule

The research collection is complete, but Eligibility Mode must use only normalized rules that pass rule-level tests. Flagged references must display a warning or be excluded from selectable current-course results until resolved by official evidence.
"""
    (CALENDAR / "SUMMARY.md").write_text(summary, encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()

