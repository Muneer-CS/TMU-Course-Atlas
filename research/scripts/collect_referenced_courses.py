"""Collect official course pages referenced by requirements but absent from the base catalogue."""

from __future__ import annotations

import json
import re
from pathlib import Path

from collect_calendar import OUT, extract_page, write_json


RESEARCH = Path(__file__).resolve().parents[1]
CATALOG_PATH = RESEARCH.parent / "public" / "data" / "electives.json"
COURSE_LINK = re.compile(r"/calendar/2026-2027/courses/", re.I)
EXACT_CODE = re.compile(r"^[A-Z]{3}\s+(?:\d{3}|[0-9][A-Z][A-Z](?:/[A-Z])?)$")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    known = {course["code"] for course in load(CATALOG_PATH)["courses"]}
    links: dict[str, str] = {}
    folders = ["programs", "minors", "program-subpages-all", "optional-specializations", "shared"]
    for folder in folders:
        for path in (OUT / folder).glob("*.json"):
            page = load(path)
            for link in page["official_links"]:
                code = link["text"].strip()
                if EXACT_CODE.fullmatch(code) and COURSE_LINK.search(link["url"]) and code not in known:
                    links.setdefault(code, link["url"])

    records = []
    errors = []
    for code, url in sorted(links.items()):
        try:
            page = extract_page(url)
            page["inventory_name"] = code
            write_json(OUT / "course-supplement" / f"{code.lower().replace(' ', '-')}.json", page)
            records.append({"code": code, "url": page["source_url"], "title": page["title"]})
        except Exception as exc:
            errors.append({"code": code, "url": url, "error": str(exc)})
    report = {
        "linked_missing_courses_discovered": len(links),
        "course_pages_collected": len(records),
        "errors": errors,
        "records": records
    }
    write_json(OUT / "course-supplement-report.json", report)
    print(json.dumps({k: v for k, v in report.items() if k != "records"}, indent=2))


if __name__ == "__main__":
    main()
