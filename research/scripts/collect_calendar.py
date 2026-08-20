"""Collect and normalize official TMU Undergraduate Calendar evidence.

The output intentionally preserves official text blocks before academic rules are
normalized. This prevents the UI or eligibility engine from becoming the only
copy of a rule and gives future calendar updates a stable comparison layer.
"""

from __future__ import annotations

import concurrent.futures
import csv
import hashlib
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path


CALENDAR_YEAR = "2026-2027"
BASE = f"https://www.torontomu.ca/calendar/{CALENDAR_YEAR}/"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "calendar-2026-2027" / "collected"
PROGRAM_CSV = ROOT / "calendar-2026-2027" / "programs.csv"
USER_AGENT = "CourseAtlasResearch/1.0 (+evidence-based student project)"
COURSE_CODE = re.compile(r"\b[A-Z]{3}\s*(?:\d{3}|[0-9][A-Z][A-Z](?:/[A-Z])?)\b")


def clean(value: str) -> str:
    value = html.unescape(value).replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def canonical_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    path = re.sub(r"/content/ryerson/calendar/", "/calendar/", parsed.path)
    path = re.sub(r"\.html$", "/", path)
    if not path.endswith("/") and "/calendar/" in path:
        path += "/"
    return urllib.parse.urlunsplit(("https", "www.torontomu.ca", path, "", ""))


def fetch(url: str, attempts: int = 3) -> tuple[str, str]:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=35) as response:
                body = response.read().decode("utf-8", errors="replace")
                return canonical_url(response.geturl()), body
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Unable to fetch {url}: {last_error}")


@dataclass
class Block:
    kind: str
    text: str
    level: int | None = None
    links: list[dict[str, str]] = field(default_factory=list)


class MainContentParser(HTMLParser):
    BLOCK_TAGS = {"p", "li", "dt", "dd", "caption", "th", "td"}

    def __init__(self, base_url: str):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.main_depth = 0
        self.active_tag: str | None = None
        self.active_level: int | None = None
        self.text_parts: list[str] = []
        self.block_links: list[dict[str, str]] = []
        self.blocks: list[Block] = []
        self.all_links: list[dict[str, str]] = []
        self.anchor_url: str | None = None
        self.anchor_text: list[str] = []
        self.accordion_anchor = False
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        attrs_dict = dict(attrs)
        if tag == "main":
            self.main_depth = 1
            return
        if self.main_depth:
            self.main_depth += 1
        else:
            return
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1
        if self.skip_depth:
            return
        if tag == "a" and attrs_dict.get("href"):
            is_accordion = "#accordion-" in (attrs_dict.get("data-clipboard-text") or "") or "accordion" in (attrs_dict.get("class") or "")
            if is_accordion:
                self._flush()
                self.active_tag = "heading"
                # Accordion labels are parents of the h2 curriculum periods
                # rendered inside their panels. Treat them as top-level section
                # headings so normalization retains the option or program path.
                self.active_level = 1
                self.accordion_anchor = True
            self.anchor_url = urllib.parse.urljoin(self.base_url, attrs_dict["href"])
            self.anchor_text = []
        if re.fullmatch(r"h[1-6]", tag):
            self._flush()
            self.active_tag = "heading"
            self.active_level = int(tag[1])
        elif tag in self.BLOCK_TAGS:
            self._flush()
            self.active_tag = "list_item" if tag == "li" else "text"
            self.active_level = None

    def handle_endtag(self, tag: str):
        if not self.main_depth:
            return
        if tag in {"script", "style", "noscript", "svg"} and self.skip_depth:
            self.skip_depth -= 1
        if not self.skip_depth and tag == "a" and self.anchor_url:
            label = clean(" ".join(self.anchor_text))
            link = {"text": label, "url": canonical_url(self.anchor_url)}
            self.all_links.append(link)
            self.block_links.append(link)
            self.anchor_url = None
            self.anchor_text = []
            if self.accordion_anchor:
                self._flush()
                self.accordion_anchor = False
        if not self.skip_depth and (re.fullmatch(r"h[1-6]", tag) or tag in self.BLOCK_TAGS):
            self._flush()
        self.main_depth -= 1

    def handle_data(self, data: str):
        if self.main_depth and not self.skip_depth:
            self.text_parts.append(data)
            if self.anchor_url:
                self.anchor_text.append(data)

    def _flush(self):
        text = clean(" ".join(self.text_parts))
        if text and self.active_tag:
            block = Block(self.active_tag, text, self.active_level, self.block_links.copy())
            if not self.blocks or (self.blocks[-1].kind, self.blocks[-1].text) != (block.kind, block.text):
                self.blocks.append(block)
        self.active_tag = None
        self.active_level = None
        self.text_parts = []
        self.block_links = []


def extract_page(requested_url: str) -> dict:
    final_url, source = fetch(requested_url)
    parser = MainContentParser(final_url)
    parser.feed(source)
    parser._flush()
    headings = [b.text for b in parser.blocks if b.kind == "heading"]
    text = "\n".join(b.text for b in parser.blocks)
    courses = sorted({re.sub(r"(?<=[A-Z])(?=\d)", " ", m.group(0)).replace("  ", " ") for m in COURSE_CODE.finditer(text)})
    links: dict[str, dict[str, str]] = {}
    for link in parser.all_links:
        if link["url"].startswith(BASE):
            links[link["url"]] = link
    return {
        "source_url": final_url,
        "calendar_year": CALENDAR_YEAR,
        "source_sha256": hashlib.sha256(source.encode("utf-8")).hexdigest(),
        "source_bytes": len(source.encode("utf-8")),
        "title": headings[0] if headings else "",
        "headings": headings,
        "course_codes_referenced": courses,
        "official_links": list(links.values()),
        "blocks": [
            {k: v for k, v in {"kind": b.kind, "level": b.level, "text": b.text, "links": b.links}.items() if v not in (None, [], "")}
            for b in parser.blocks
        ],
    }


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def collect_many(items: list[tuple[str, str]], folder: str, unique_filenames: bool = False) -> tuple[list[dict], list[dict]]:
    records: list[dict] = []
    errors: list[dict] = []

    def task(item: tuple[str, str]):
        name, url = item
        return name, extract_page(url)

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        future_map = {executor.submit(task, item): item for item in items}
        for future in concurrent.futures.as_completed(future_map):
            name, url = future_map[future]
            try:
                _, record = future.result()
                record["inventory_name"] = name
                suffix = f"-{hashlib.sha256(record['source_url'].encode()).hexdigest()[:10]}" if unique_filenames else ""
                write_json(OUT / folder / f"{slug(name)}{suffix}.json", record)
                records.append(record)
            except Exception as exc:  # retained in completeness report
                errors.append({"name": name, "url": url, "error": str(exc)})
    records.sort(key=lambda x: x["inventory_name"])
    errors.sort(key=lambda x: x["name"])
    return records, errors


def index_entries(index_url: str, path_marker: str) -> list[tuple[str, str]]:
    page = extract_page(index_url)
    entries: dict[str, str] = {}
    for link in page["official_links"]:
        url = link["url"]
        label = re.sub(r"\s+Minor$", "", link["text"]).strip()
        if path_marker in url and url.rstrip("/") != index_url.rstrip("/") and label:
            entries[label] = url
    return sorted(entries.items())


def sitemap_entries(path_marker: str) -> list[tuple[str, str]]:
    page = extract_page(BASE + "sitemap/")
    entries: dict[str, str] = {}
    for link in page["official_links"]:
        if path_marker in link["url"] and link["text"]:
            entries[link["url"]] = link["text"]
    return sorted(((name, url) for url, name in entries.items()), key=lambda item: item[1])


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    source_map = json.loads((ROOT / "calendar-2026-2027" / "program-source-map.json").read_text(encoding="utf-8"))
    program_items = [(r["program"], r["url"]) for r in source_map["records"]]
    root_program_urls = {url.rstrip("/") for _, url in program_items}
    minor_items = index_entries(BASE + "minors/", f"/calendar/{CALENDAR_YEAR}/minors/")
    specialization_items = index_entries(BASE + "sitemap/", f"/calendar/{CALENDAR_YEAR}/optional-specializations/")
    specialization_items = [
        item for item in specialization_items
        if item[1].rstrip("/") != (BASE + "optional-specializations/").rstrip("/")
    ]

    program_pages, program_errors = collect_many(program_items, "programs")
    minor_pages, minor_errors = collect_many(minor_items, "minors")
    specialization_pages, specialization_errors = collect_many(specialization_items, "optional-specializations")

    program_table_items: dict[str, str] = {}
    for program in program_pages:
        program_url = program["source_url"]
        for link in program["official_links"]:
            url = link["url"]
            if url.startswith(program_url) and url.rstrip("/") != program_url.rstrip("/"):
                name = f"{program['inventory_name']} - {link['text'] or url.rstrip('/').split('/')[-1]}"
                program_table_items[url] = name
    table_pages, table_errors = collect_many(
        [(name, url) for url, name in program_table_items.items()],
        "program-tables-all",
        unique_filenames=True,
    )
    all_program_sitemap_items = sitemap_entries(f"/calendar/{CALENDAR_YEAR}/programs/")
    program_subpage_items = [
        (name, url) for name, url in all_program_sitemap_items
        if url.rstrip("/") not in root_program_urls
        and url.rstrip("/") != (BASE + "programs/").rstrip("/")
        and "/program_template/" not in url
    ]
    subpage_pages, subpage_errors = collect_many(
        program_subpage_items,
        "program-subpages-all",
        unique_filenames=True,
    )

    shared_items = [
        ("Lower Level Liberal Studies Table A", BASE + "liberal-studies/table_a/"),
        ("Upper Level Liberal Studies Table B", BASE + "liberal-studies/table_b/"),
        ("Open Electives", BASE + "open-electives/"),
        ("Concentrations", BASE + "concentrations/"),
        ("Optional Specializations", BASE + "optional-specializations/"),
        ("Addenda and Errata", BASE + "addenda-and-errata/"),
    ]
    shared_pages, shared_errors = collect_many(shared_items, "shared")

    expected_programs = sum(1 for _ in csv.DictReader(PROGRAM_CSV.open(encoding="utf-8")))
    report = {
        "calendar_year": CALENDAR_YEAR,
        "collection_status": "complete" if not (program_errors or minor_errors or specialization_errors or table_errors or subpage_errors or shared_errors) else "errors",
        "counts": {
            "programs_expected": expected_programs,
            "programs_collected": len(program_pages),
            "minors_expected": 69,
            "minors_discovered": len(minor_items),
            "minors_collected": len(minor_pages),
            "optional_specializations_discovered": len(specialization_items),
            "optional_specializations_collected": len(specialization_pages),
            "program_tables_collected": len(table_pages),
            "program_subpages_from_sitemap_collected": len(subpage_pages),
            "shared_pages_collected": len(shared_pages),
            "unique_program_course_references": len({c for p in program_pages for c in p["course_codes_referenced"]}),
            "unique_minor_course_references": len({c for p in minor_pages for c in p["course_codes_referenced"]}),
        },
        "errors": program_errors + minor_errors + specialization_errors + table_errors + subpage_errors + shared_errors,
    }
    write_json(OUT / "collection-report.json", report)
    write_json(OUT / "minor-source-map.json", [{"minor": n, "url": u} for n, u in minor_items])
    write_json(OUT / "optional-specialization-source-map.json", [{"name": n, "url": u} for n, u in specialization_items])
    write_json(OUT / "program-table-source-map.json", [{"name": n, "url": u} for u, n in sorted(program_table_items.items())])
    write_json(OUT / "program-subpage-source-map.json", [{"name": n, "url": u} for n, u in program_subpage_items])
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
