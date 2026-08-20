"""Build traceable normalized research records and completeness checks."""

from __future__ import annotations

import json
import re
from pathlib import Path


RESEARCH = Path(__file__).resolve().parents[1]
COLLECTED = RESEARCH / "calendar-2026-2027" / "collected"
NORMALIZED = RESEARCH / "calendar-2026-2027" / "normalized"
SITE_DATA = RESEARCH.parent / "public" / "data" / "electives.json"
COURSE_CODE = re.compile(r"\b[A-Z]{3}\s+(?:\d{3}|[0-9][A-Z][A-Z](?:/[A-Z])?)\b")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def codes(text: str) -> list[str]:
    return sorted(set(COURSE_CODE.findall(text)))


def evidence(page: dict) -> dict:
    return {
        "source_url": page["source_url"],
        "calendar_year": page["calendar_year"],
        "source_sha256": page["source_sha256"],
        "verified_on": "2026-08-20",
        "evidence_type": "official",
        "status": "collected"
    }


def metadata_value(blocks: list[dict], label: str) -> str | None:
    for block in blocks:
        text = block["text"]
        if text.lower().startswith(label.lower()):
            return text.split(":", 1)[-1].strip()
    return None


def sectionize(blocks: list[dict]) -> list[dict]:
    sections: list[dict] = []
    current: dict | None = None
    for block in blocks:
        if block["kind"] == "heading":
            current = {
                "heading": block["text"],
                "level": block.get("level"),
                "content": [],
                "course_codes": []
            }
            sections.append(current)
        elif current is not None:
            current["content"].append(block["text"])
    for section in sections:
        section["course_codes"] = codes("\n".join(section["content"]))
    return sections


PERIOD = re.compile(r"^(?:\d+(?:st|nd|rd|th)\s+Semester|\d+(?:st|nd|rd|th)\s*&\s*\d+(?:st|nd|rd|th)\s+Semester|Year\s+[IV0-9]+|Level\s+[IV0-9]+(?:\s+Certificate)?)(?:\b|\s*-)", re.I)
REQUIREMENT = re.compile(
    r"^(REQUIRED(?:\s+GROUP\s+\d+)?|LIBERAL STUDIES|OPEN ELECTIVES?|CORE ELECTIVES?|PROFESSIONAL(?:LY)?[- ]RELATED(?:\s+ELECTIVES?)?|TECHNICAL ELECTIVES?|OPTION|WORK TERM|NON[- ]COURSE REQUIREMENT)\s*:",
    re.I,
)


def structure_requirements(page: dict) -> list[dict]:
    heading_stack: list[tuple[int, str]] = []
    periods: list[dict] = []
    current_period: dict | None = None
    current_requirement: dict | None = None
    for block in page["blocks"]:
        if block["kind"] == "heading":
            level = block.get("level", 6)
            heading_stack = [(l, h) for l, h in heading_stack if l < level]
            heading_stack.append((level, block["text"]))
            if PERIOD.search(block["text"]):
                current_period = {
                    "period": block["text"],
                    "heading_path": [h for _, h in heading_stack],
                    "requirements": [],
                    "published_notes": [],
                }
                periods.append(current_period)
                current_requirement = None
            continue
        if current_period is None:
            continue
        text = block["text"]
        match = REQUIREMENT.match(text)
        if match:
            current_requirement = {
                "type": re.sub(r"\s+", "_", match.group(1).lower().replace("-", " ")),
                "published_text": [text],
                "options": [],
                "course_codes": codes(text),
            }
            current_period["requirements"].append(current_requirement)
        elif block["kind"] == "list_item" and current_requirement is not None:
            current_requirement["options"].append({"text": text, "course_codes": codes(text)})
            current_requirement["course_codes"] = sorted(set(current_requirement["course_codes"] + codes(text)))
        elif current_requirement is not None and re.search(r"^(one|two|three|four|five|six|seven|eight|nine|ten|a total|students must|choose|select|plus)", text, re.I):
            current_requirement["published_text"].append(text)
            current_requirement["course_codes"] = sorted(set(current_requirement["course_codes"] + codes(text)))
        elif re.search(r"admitted Fall|first offered|last offered|note:|must|minimum|maximum|not available", text, re.I):
            current_period["published_notes"].append(text)
    return periods


def normalize_program(page: dict) -> dict:
    sections = sectionize(page["blocks"])
    curriculum_sections = [
        s for s in sections
        if re.search(r"semester|program|option|level|curriculum|concentration|co-op|co-operative|internship|liberal studies|minors", s["heading"], re.I)
    ]
    condition_texts = [
        block["text"] for block in page["blocks"]
        if re.search(r"admitted Fall|first offered|last offered|not available|must|minimum|maximum|clear academic standing|CGPA|permission|consent", block["text"], re.I)
    ]
    return {
        "name": page["inventory_name"],
        "official_title": page["title"],
        "degree_awarded": metadata_value(page["blocks"], "Degree Awarded"),
        "administered_by": metadata_value(page["blocks"], "Administered by"),
        "program_format": metadata_value(page["blocks"], "Program Format"),
        "course_codes_referenced": page["course_codes_referenced"],
        "published_conditions": condition_texts,
        "curriculum_periods": structure_requirements(page),
        "curriculum_sections": curriculum_sections,
        "evidence": evidence(page)
    }


def normalize_minor(page: dict) -> dict:
    blocks = page["blocks"]
    total = 6
    for block in blocks:
        match = re.search(r"complete\s+(?:a total of\s+)?(?:\w+\s+)?\(?([0-9]+)\)?\s+courses", block["text"], re.I)
        if match:
            total = int(match.group(1))
            break

    exclusions: list[str] = []
    collecting_exclusions = False
    for block in blocks:
        text = block["text"]
        if text.lower().startswith("exclusions:"):
            collecting_exclusions = True
            continue
        if collecting_exclusions and re.search(r"to receive this minor|curriculum|required courses|complete six", text, re.I):
            collecting_exclusions = False
        if collecting_exclusions and block["kind"] == "list_item":
            exclusions.append(text)

    groups: list[dict] = []
    current: dict | None = None
    curriculum_started = False
    for block in blocks:
        text = block["text"]
        if re.search(r"to receive this minor|to obtain the minor|minor.*complete.*courses|required courses?\s*\(", text, re.I):
            curriculum_started = True
            continue
        if not curriculum_started:
            continue
        if text.startswith("Please see Senate Policy"):
            break
        if block["kind"] == "text" and re.search(r"required|plus|following|group|focus|choose|select|option|level", text, re.I):
            current = {"label": text, "options": []}
            groups.append(current)
        elif block["kind"] == "list_item":
            if current is None:
                current = {"label": "Published curriculum", "options": []}
                groups.append(current)
            current["options"].append({"text": text, "course_codes": codes(text)})

    notes = [
        block["text"] for block in blocks
        if re.search(r"maximum|minimum|must|may not|not available|prerequisite|permission|only|cannot|additional", block["text"], re.I)
        and block["text"] not in exclusions
    ]
    return {
        "name": page["inventory_name"],
        "official_title": page["title"],
        "administered_by": metadata_value(blocks, "Administered by"),
        "required_course_count": total,
        "excluded_programs_or_plans": exclusions,
        "curriculum_groups": groups,
        "published_notes": notes,
        "course_codes_referenced": page["course_codes_referenced"],
        "evidence": evidence(page)
    }


def all_pages(folder: str) -> list[dict]:
    return [load(path) for path in sorted((COLLECTED / folder).glob("*.json"))]


def classify_unresolved(code: str, pages: list[dict]) -> dict:
    occurrences = []
    category = "manual_review"
    for page in pages:
        active_heading = ""
        for block in page["blocks"]:
            if block["kind"] == "heading":
                active_heading = block["text"]
            if code in block["text"]:
                text = block["text"]
                lower = text.lower()
                if re.search(r"conversion|equivalen|former", page["inventory_name"], re.I) or re.search(r"conversion|equivalen|former", active_heading, re.I):
                    category = "historical_or_equivalent_reference"
                elif re.search(r"former|previously|equivalen|substitut", lower):
                    category = "historical_or_equivalent_reference"
                elif re.search(r"numbered between|level|\d{3}\s*[-–]\s*\d{3}|i\.e\.", lower):
                    if category == "manual_review":
                        category = "range_boundary_or_level_example"
                elif re.search(r"not intended to be offered|not offered|last offered|removed", lower):
                    if category == "manual_review":
                        category = "inactive_or_removed_reference"
                elif re.search(r"not available for credit|may not take|cannot take|may not include", lower):
                    if category == "manual_review":
                        category = "restriction_reference_missing_from_catalog"
                occurrences.append({
                    "page": page["inventory_name"],
                    "source_url": page["source_url"],
                    "text": text
                })
    if category == "manual_review":
        category = "published_reference_missing_from_course_catalog"
    return {"code": code, "classification": category, "occurrences": occurrences}


def normalized_label(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def minor_program_status(program_name: str, exclusions: list[str]) -> tuple[str, list[str]]:
    program = normalized_label(program_name)
    matches = [e for e in exclusions if normalized_label(e).startswith(program)]
    if not matches:
        return "eligible_under_general_minor_policy", []
    broad_markers = ("all majors", "all options", "regular and co op", "regular co op", "all programs")
    for match in matches:
        label = normalized_label(match)
        remainder = label[len(program):].strip()
        if not remainder or any(marker in remainder for marker in broad_markers):
            return "officially_excluded", matches
    return "plan_specific_exclusion_review", matches


def main() -> None:
    catalog = load(SITE_DATA)["courses"]
    catalog_codes = {course["code"] for course in catalog}
    raw_programs = all_pages("programs")
    raw_minors = all_pages("minors")
    programs = [normalize_program(page) for page in raw_programs]
    minors = [normalize_minor(page) for page in raw_minors]
    tables = all_pages("program-subpages-all")
    shared = all_pages("shared")
    specializations = all_pages("optional-specializations")

    all_collected = raw_programs + raw_minors + tables + shared + specializations
    referenced = {code for page in all_collected for code in page["course_codes_referenced"]}
    unresolved = sorted(referenced - catalog_codes)
    unused_catalog = sorted(catalog_codes - referenced)

    minor_count_issues = [
        {"minor": m["name"], "parsed_required_count": m["required_course_count"], "source": m["evidence"]["source_url"]}
        for m in minors if m["required_course_count"] != 6
    ]
    empty_program_curricula = [p["name"] for p in programs if not p["curriculum_sections"]]
    empty_minor_curricula = [m["name"] for m in minors if not m["curriculum_groups"]]
    empty_pages = [p["source_url"] for p in all_collected if not p["blocks"]]

    write(NORMALIZED / "programs.json", {
        "calendar_year": "2026-2027",
        "record_count": len(programs),
        "records": programs
    })
    write(NORMALIZED / "minors.json", {
        "calendar_year": "2026-2027",
        "record_count": len(minors),
        "records": minors
    })
    normalized_tables = [{
        "name": p["inventory_name"],
        "title": p["title"],
        "course_codes_referenced": p["course_codes_referenced"],
        "curriculum_periods": structure_requirements(p),
        "sections": sectionize(p["blocks"]),
        "evidence": evidence(p)
    } for p in tables]
    write(NORMALIZED / "program-tables.json", {
        "calendar_year": "2026-2027",
        "record_count": len(tables),
        "records": normalized_tables
    })
    program_sources = sorted(
        ((p["name"], p["evidence"]["source_url"]) for p in programs),
        key=lambda item: len(item[1]),
        reverse=True,
    )
    plans = []
    for table in normalized_tables:
        if not table["curriculum_periods"]:
            continue
        parent = next((name for name, url in program_sources if table["evidence"]["source_url"].startswith(url)), None)
        if parent is None:
            continue
        plans.append({
            "parent_program": parent,
            "name": table["title"] or table["name"],
            "inventory_name": table["name"],
            "curriculum_periods": table["curriculum_periods"],
            "course_codes_referenced": table["course_codes_referenced"],
            "evidence": table["evidence"]
        })
    write(NORMALIZED / "program-plans.json", {
        "calendar_year": "2026-2027",
        "record_count": len(plans),
        "records": plans
    })
    write(NORMALIZED / "shared-rules.json", {
        "calendar_year": "2026-2027",
        "record_count": len(shared),
        "records": [{
            "name": p["inventory_name"],
            "title": p["title"],
            "sections": sectionize(p["blocks"]),
            "evidence": evidence(p)
        } for p in shared]
    })
    write(NORMALIZED / "optional-specializations.json", {
        "calendar_year": "2026-2027",
        "record_count": len(specializations),
        "records": [{
            "name": p["inventory_name"],
            "title": p["title"],
            "course_codes_referenced": p["course_codes_referenced"],
            "sections": sectionize(p["blocks"]),
            "evidence": evidence(p)
        } for p in specializations]
    })
    concentration_records = []
    for page in raw_programs + tables:
        selected = [s for s in sectionize(page["blocks"]) if "concentration" in s["heading"].lower()]
        if selected:
            concentration_records.append({
                "source_record": page["inventory_name"],
                "sections": selected,
                "evidence": evidence(page)
            })
    write(NORMALIZED / "concentrations.json", {
        "calendar_year": "2026-2027",
        "record_count": len(concentration_records),
        "records": concentration_records
    })
    unresolved_records = [classify_unresolved(code, all_collected) for code in unresolved]
    write(NORMALIZED / "unresolved-course-references.json", {
        "calendar_year": "2026-2027",
        "record_count": len(unresolved_records),
        "records": unresolved_records
    })

    compatibility = []
    for program in programs:
        program_courses = set(program["course_codes_referenced"])
        for minor in minors:
            status, matched_exclusions = minor_program_status(program["name"], minor["excluded_programs_or_plans"])
            overlap = sorted(program_courses.intersection(minor["course_codes_referenced"]))
            compatibility.append({
                "program": program["name"],
                "minor": minor["name"],
                "status": status,
                "matched_exclusions": matched_exclusions,
                "published_course_overlap": overlap,
                "notes": [
                    "Eligibility status is derived from TMU's general Minor policy and the minor's published exclusions.",
                    "Course overlap does not mean a course may be double-counted or that the minor fits within the normal degree requirements."
                ],
                "program_source": program["evidence"]["source_url"],
                "minor_source": minor["evidence"]["source_url"]
            })
    write(NORMALIZED / "major-minor-compatibility.json", {
        "calendar_year": "2026-2027",
        "record_count": len(compatibility),
        "records": compatibility
    })
    plan_compatibility = []
    for plan in plans:
        plan_courses = set(plan["course_codes_referenced"])
        for minor in minors:
            status, matched_exclusions = minor_program_status(plan["name"], minor["excluded_programs_or_plans"])
            if status == "eligible_under_general_minor_policy" and plan["parent_program"]:
                parent_status, parent_matches = minor_program_status(plan["parent_program"], minor["excluded_programs_or_plans"])
                if parent_status != "eligible_under_general_minor_policy":
                    status, matched_exclusions = parent_status, parent_matches
            plan_compatibility.append({
                "parent_program": plan["parent_program"],
                "plan": plan["name"],
                "minor": minor["name"],
                "status": status,
                "matched_exclusions": matched_exclusions,
                "published_course_overlap": sorted(plan_courses.intersection(minor["course_codes_referenced"])),
                "plan_source": plan["evidence"]["source_url"],
                "minor_source": minor["evidence"]["source_url"]
            })
    write(NORMALIZED / "program-plan-minor-compatibility.json", {
        "calendar_year": "2026-2027",
        "record_count": len(plan_compatibility),
        "records": plan_compatibility
    })
    report = {
        "calendar_year": "2026-2027",
        "status": "review_required" if unresolved or minor_count_issues or empty_program_curricula or empty_minor_curricula or empty_pages else "passed",
        "counts": {
            "programs": len(programs),
            "minors": len(minors),
            "program_tables": len(tables),
            "program_plan_pages": len(plans),
            "shared_rule_pages": len(shared),
            "optional_specialization_pages": len(specializations),
            "concentration_source_records": len(concentration_records),
            "course_catalog_records": len(catalog),
            "unique_course_codes_referenced": len(referenced),
            "unresolved_course_references": len(unresolved),
            "catalog_courses_not_referenced_by_collected_requirement_pages": len(unused_catalog)
            ,"major_minor_assessments": len(compatibility)
            ,"program_plan_minor_assessments": len(plan_compatibility)
        },
        "checks": {
            "unresolved_course_codes": unresolved,
            "unresolved_reference_classification": {
                category: sum(1 for item in unresolved_records if item["classification"] == category)
                for category in sorted({item["classification"] for item in unresolved_records})
            },
            "minor_required_count_review": minor_count_issues,
            "programs_without_detected_curriculum_sections": empty_program_curricula,
            "minors_without_detected_curriculum_groups": empty_minor_curricula,
            "empty_source_pages": empty_pages
        },
        "interpretation": [
            "A catalog course need not appear in a program or minor requirement page to remain a valid course.",
            "An unresolved course reference may be a former code, a course range, a formatting artifact, or a true catalog mismatch and requires classification.",
            "Collected rules are official evidence. Eligibility results remain derived guidance and require rule-level verification before publication."
        ]
    }
    write(NORMALIZED / "completeness-report.json", report)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
