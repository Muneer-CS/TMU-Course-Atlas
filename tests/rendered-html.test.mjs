import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { courseSubject, matchesCourseSearch } from "../app/course-search.mjs";

const root = new URL("../", import.meta.url);

test("GitHub Pages build contains the complete deployable site", async () => {
  await Promise.all([
    access(new URL("pages-dist/about.html", root)),
    access(new URL("pages-dist/favicon.png", root)),
    access(new URL("pages-dist/electives.json.gz", root)),
    access(new URL("pages-dist/electives.json", root)),
  ]);

  const html = await readFile(new URL("pages-dist/index.html", root), "utf8");
  const scriptPath = html.match(/src="\.\/([^"]+\.js)"/)?.[1];
  const stylePath = html.match(/href="\.\/([^"]+\.css)"/)?.[1];
  assert.ok(scriptPath && stylePath);
  await Promise.all([
    access(new URL(`pages-dist/${scriptPath}`, root)),
    access(new URL(`pages-dist/${stylePath}`, root)),
  ]);
  assert.match(html, /<title>Course Atlas - TMU Programs<\/title>/);
  assert.match(html, /<link rel="icon" type="image\/png" href="\.\/favicon\.png"/);
  assert.doesNotMatch(html, /tmu-elective-atlas\.goatcounter\.com/);
  assert.match(scriptPath, /^app-[A-Za-z0-9_-]+\.js$/);
  assert.match(stylePath, /^[A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.css$/);
  assert.doesNotMatch(html, /Muneer-CS Elective Atlas/);
  assert.doesNotMatch(html, /—/);
});

test("course-code searches do not match unrelated descriptions", async () => {
  const dataset = JSON.parse(await readFile(new URL("public/data/electives.json", root), "utf8"));
  const openCourses = dataset.courses.filter((course) => course.sections.includes("Open Elective"));
  const subjects = new Set(openCourses.map((course) => courseSubject(course.code)));
  const crmResults = openCourses.filter((course) => matchesCourseSearch(course, "CRM", subjects));

  assert.ok(crmResults.length > 0);
  assert.ok(crmResults.every((course) => course.code.startsWith("CRM ")));
  assert.ok(!crmResults.some((course) => course.code === "BLG 888"));
});

test("full course-code searches are exact", async () => {
  const dataset = JSON.parse(await readFile(new URL("public/data/electives.json", root), "utf8"));
  const subjects = new Set(dataset.courses.map((course) => courseSubject(course.code)));
  const results = dataset.courses.filter((course) => matchesCourseSearch(course, "CPS 633", subjects));
  assert.deepEqual(results.map((course) => course.code), ["CPS 633"]);
});

test("program and minor controls use the complete verified planning dataset", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const atlas = JSON.parse(await readFile(new URL("public/data/course-atlas.json", root), "utf8"));
  assert.match(page, /atlas\?\.programs\.map/);
  assert.match(page, /compatibleMinors\.map/);
  assert.equal(atlas.programs.length, 72);
  assert.equal(atlas.minors.length, 69);
  assert.ok(atlas.programs.some((program) => program.name === "Computer Science"));
});

test("About page includes the biography and social profiles", async () => {
  const html = await readFile(new URL("pages-dist/about.html", root), "utf8");
  assert.match(html, /<title>About - Course Atlas<\/title>/);
  assert.match(html, /github\.com\/Muneer-CS/);
  assert.match(html, /linkedin\.com\/in\/muneer-mahmoud/);
  assert.doesNotMatch(html, /tmu-elective-atlas\.goatcounter\.com/);
  assert.doesNotMatch(html, /—/);
});

test("course dataset is complete, unique, and uses official TMU sources", async () => {
  const dataset = JSON.parse(await readFile(new URL("public/data/electives.json", root), "utf8"));
  assert.equal(dataset.courses.length, 3971);
  assert.equal(new Set(dataset.courses.map((course) => course.code)).size, 3971);

  const expected = {
    "Lower Liberal Studies": 130,
    "Upper Liberal Studies": 237,
    "Open Elective": 3550,
    "Core Elective": 105,
  };
  for (const [section, count] of Object.entries(expected)) {
    assert.equal(dataset.courses.filter((course) => course.sections.includes(section)).length, count);
  }

  for (const course of dataset.courses) {
    assert.ok(course.code && course.name && course.source);
    assert.match(course.source, /^https:\/\/www\.torontomu\.ca\//);
  }
});

test("detail UI keeps antirequisites separate from prerequisites", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /<dt>Prerequisites<\/dt><dd>\{selectedRecord\?\.prerequisites\.join/);
  assert.match(page, /<dt>Antirequisites<\/dt><dd>\{selectedRecord\?\.antirequisites\.join/);
  assert.doesNotMatch(page, /const requisite = course\.requisite_text/);
});

test("program-specific requirement slots resolve official allowlists", async () => {
  const source = await readFile(new URL("app/page.tsx", root), "utf8");
  const atlas = JSON.parse(await readFile(new URL("public/data/course-atlas.json", root), "utf8"));
  assert.match(source, /function tableCodes/);
  assert.match(source, /allowedCodes: pending\.codes\.length \? pending\.codes : tableAllowed/);
  assert.ok(atlas.program_tables.length > 0);
  assert.ok(atlas.program_tables.every((table) => table.source.startsWith("https://www.torontomu.ca/")));
});

test("every selectable program-table code exists in the catalogue dataset", async () => {
  const atlas = JSON.parse(await readFile(new URL("public/data/course-atlas.json", root), "utf8"));
  const data = JSON.parse(await readFile(new URL("public/data/electives.json", root), "utf8"));
  const catalogueCodes = new Set(data.courses.map((course) => course.code));
  const referencedCodes = new Set(atlas.program_tables.flatMap((table) => table.course_codes));
  const missing = [...referencedCodes].filter((code) => !catalogueCodes.has(code));
  const unresolved = new Set(atlas.unresolved_references.map((item) => item.code));
  assert.ok(missing.every((code) => unresolved.has(code)));
});

test("site-ready atlas data covers every collected program and minor", async () => {
  const atlas = JSON.parse(await readFile(new URL("public/data/course-atlas.json", root), "utf8"));
  assert.equal(atlas.programs.length, 72);
  assert.equal(atlas.minors.length, 69);
  assert.equal(atlas.compatibility.length, 4968);
  assert.equal(atlas.unresolved_references.length, 182);
  assert.ok(atlas.programs.every((program) => program.source?.startsWith("https://www.torontomu.ca/") && program.sequences.length > 0));
  assert.ok(atlas.minors.every((minor) => minor.source?.startsWith("https://www.torontomu.ca/")));
});

test("every program has a conservative publication state", async () => {
  const report = JSON.parse(await readFile(new URL("research/calendar-2026-2027/normalized/site-publication-report.json", root), "utf8"));
  const allowed = new Set(["semester_ready", "published_period_only", "manual_variant_review"]);
  assert.equal(report.programs.length, 72);
  assert.equal(Object.values(report.counts).reduce((sum, count) => sum + count, 0), 72);
  assert.ok(report.programs.every((program) => allowed.has(program.publication_status)));
});

test("curriculum variants are separated before site publication", async () => {
  const atlas = JSON.parse(await readFile(new URL("public/data/course-atlas.json", root), "utf8"));
  assert.equal(atlas.counts.programs_with_multiple_variants, 0);
  assert.equal(atlas.counts.programs_with_separated_variants, 38);
  assert.ok(atlas.programs.every((program) => !program.review_flags.includes("multiple_curriculum_variants_detected")));
});
