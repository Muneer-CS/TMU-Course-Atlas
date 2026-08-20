import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const root = new URL("../../", import.meta.url);
const calendarRoot = new URL("../calendar-2026-2027/", import.meta.url);
const collectedPrograms = new URL("collected/programs/", calendarRoot);
const normalizedRoot = new URL("normalized/", calendarRoot);
const output = new URL("public/data/course-atlas.json", root);

const readJson = async (url) => JSON.parse(await readFile(url, "utf8"));
const semesterMarker = /^(\d+)(?:st|nd|rd|th) Semester$/i;
const periodHeading = /^(?:\d+(?:st|nd|rd|th) & \d+(?:st|nd|rd|th) Semester|Level \d\b.*)$/i;
const courseCode = /\b[A-Z]{2,4} \d{3}\b|\b[A-Z]{3} \d{2}A\/B\b/g;

function compactBlock(block) {
  const links = (block.links ?? []).filter((link) => link.url?.includes("torontomu.ca"));
  return {
    kind: block.kind,
    text: block.text,
    course_codes: [...new Set(block.text.match(courseCode) ?? [])],
    ...(links.length ? { links } : {}),
  };
}

function compactText(text) {
  return { kind: "text", text, course_codes: [...new Set(text.match(courseCode) ?? [])] };
}

function audienceFromQualifiers(qualifiers, context = []) {
  if (!qualifiers.length && !context.length) return { audience_key: "shared", audience_label: "" };
  const label = [...context, ...qualifiers].join(" - ");
  const contextKey = context.join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";
  const qualifierKey = qualifiers.join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const lastOffered = qualifiers.join(" ").match(/last offered[\s\S]*?(?:s|t)udents? admitted Fall (\d{4})/i);
  const admitted = qualifiers.join(" ").match(/students? admitted Fall (\d{4})(?: and after| and before)?/i);
  const year = lastOffered?.[1] ?? admitted?.[1];
  const direction = lastOffered ? "before" : /and after|revised curriculum begins/i.test(qualifiers.join(" ")) ? "after" : /and before/i.test(qualifiers.join(" ")) ? "before" : "specific";
  return {
    audience_key: year ? `${contextKey}--fall-${year}-${direction}` : `qualified-${contextKey}${qualifierKey ? `--${qualifierKey}` : ""}`,
    audience_label: label,
    path_key: year ? `${contextKey}--fall-${year}-${direction}` : contextKey,
    path_label: year ? `${context.join(" - ") || "Program curriculum"} - Fall ${year} ${direction}` : context.join(" - ") || "Program curriculum",
  };
}

function extractNormalizedSequences(program) {
  const sequences = [];
  const periodRecords = [...(program.curriculum_periods ?? [])];
  let periodRecordIndex = 0;
  let trackContext = "";
  for (const section of program.curriculum_sections ?? []) {
    if (!periodHeading.test(section.heading)) {
      if (/\b(?:Major|Option|Stream|Degree Completion|Entry Program)\b/i.test(section.heading)) trackContext = section.heading;
      else if (!/Full-Time|Part-Time|Co-Op|Co-operative/i.test(section.heading)) trackContext = "";
      continue;
    }
    const periodRecord = periodRecords[periodRecordIndex++];
    const context = periodRecord?.heading_path?.slice(0, -1) ?? [];
    if (trackContext && !context.includes(trackContext)) context.unshift(trackContext);
    const allowed = [...section.heading.matchAll(/\d+/g)].map((match) => Number(match[0]));
    const stopPattern = /^(?:The following (?:table )?shows|The following shows the alternative|Sequence of Academic|A Concentration is|Concentrations$|Addenda and Errata$)/i;
    const sectionStop = section.content.findIndex((text) => stopPattern.test(text));
    const academicContent = sectionStop >= 0 ? section.content.slice(0, sectionStop) : section.content;
    const markerIndexes = academicContent
      .map((text, index) => ({ index, match: text.match(semesterMarker) }))
      .filter((item) => item.match && allowed.includes(Number(item.match[1])));
    const qualifiers = academicContent
      .slice(0, markerIndexes[0]?.index ?? academicContent.length)
      .filter((text) => /admitted|offered|revised|program|option|co-op|full-time|part-time|stream|curriculum/i.test(text));
    const semesters = markerIndexes.map((marker, markerIndex) => {
      const end = markerIndexes[markerIndex + 1]?.index ?? academicContent.length;
      return { number: Number(marker.match[1]), blocks: academicContent.slice(marker.index + 1, end).map(compactText) };
    });
    const periodBlocks = academicContent.map(compactText);
    sequences.push({
      id: `${program.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${sequences.length + 1}`,
      context,
      qualifiers,
      period: section.heading,
      semesters,
      period_blocks: periodBlocks,
      display_mode: semesters.length > 0 ? "semester" : "published_period",
      ...audienceFromQualifiers(qualifiers, context),
    });
  }
  return sequences;
}

function applyVerifiedVariantOverrides(programName, sequences) {
  if (programName !== "Accounting and Finance") return sequences;
  let upperPeriodTrack = 0;
  let major = "";
  return sequences.map((sequence) => {
    if (sequence.period === "5th & 6th Semester") {
      upperPeriodTrack += 1;
      major = upperPeriodTrack <= 2 ? "Accounting Major" : "Finance Major";
    }
    if (!major || !["5th & 6th Semester", "7th & 8th Semester"].includes(sequence.period)) return sequence;
    return {
      ...sequence,
      context: [major, ...sequence.context],
      audience_key: `${major.toLowerCase().replace(/[^a-z0-9]+/g, "-")}--${sequence.audience_key}`,
      audience_label: `${major} - ${sequence.audience_label || sequence.context.join(" - ")}`,
      path_key: `${major.toLowerCase().replace(/[^a-z0-9]+/g, "-")}--${sequence.path_key}`,
      path_label: `${major} - ${sequence.path_label}`,
    };
  });
}

function extractSemesterSequences(program) {
  const sequences = [];
  const headingStack = new Map();
  const recentTexts = [];
  let sequence;
  let semester;

  for (const block of program.blocks ?? []) {
    if (block.kind === "heading") {
      const level = block.level ?? 9;
      for (const key of [...headingStack.keys()]) {
        if (key >= level) headingStack.delete(key);
      }
      if (periodHeading.test(block.text)) {
        const context = [...headingStack.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, text]) => text)
          .filter((text) => text !== program.title);
        const qualifiers = recentTexts
          .slice(-5)
          .filter((text) => /admitted|offered|program|option|co-op|full-time|part-time|stream|curriculum/i.test(text));
        sequence = {
          id: `${basename(program.source_url).replaceAll("/", "") || "program"}-${sequences.length + 1}`,
          context,
          qualifiers,
          period: block.text,
          semesters: [],
          period_blocks: [],
          allowed_semesters: [...block.text.matchAll(/\d+/g)].map((match) => Number(match[0])),
        };
        sequences.push(sequence);
        semester = undefined;
      } else {
        headingStack.set(level, block.text);
      }
      continue;
    }

    if (block.kind === "text" && block.text) {
      recentTexts.push(block.text);
      if (recentTexts.length > 12) recentTexts.shift();
    }

    const marker = block.kind === "text" ? block.text.match(semesterMarker) : null;
    if (marker && sequence) {
      const number = Number(marker[1]);
      if (!sequence.allowed_semesters.includes(number)) continue;
      if (number === sequence.allowed_semesters[0] && sequence.semesters.some((item) => item.number === number)) {
        sequence = {
          ...sequence,
          id: `${basename(program.source_url).replaceAll("/", "") || "program"}-${sequences.length + 1}`,
          semesters: [],
          period_blocks: [],
        };
        sequences.push(sequence);
      }
      semester = { number, blocks: [] };
      sequence.semesters.push(semester);
      continue;
    }

    if (sequence && ["text", "list_item"].includes(block.kind) && block.text) {
      const compact = compactBlock(block);
      sequence.period_blocks.push(compact);
      if (semester) semester.blocks.push(compact);
    }
  }

  const normalized = sequences
    .filter((item) => item.semesters.length > 0 || item.period_blocks.length > 0)
    .map((item) => ({
      id: item.id,
      context: item.context,
      qualifiers: item.qualifiers,
      period: item.period,
      semesters: item.semesters,
      period_blocks: item.period_blocks,
      display_mode: item.semesters.length > 0 ? "semester" : "published_period",
    }));
  const unique = new Map();
  for (const item of normalized) {
    const signature = JSON.stringify([item.period, item.semesters, item.period_blocks]);
    if (!unique.has(signature)) unique.set(signature, item);
  }
  return [...unique.values()];
}

const programFiles = (await readdir(collectedPrograms)).filter((name) => name.endsWith(".json")).sort();
const normalizedProgramsSource = await readJson(new URL("programs.json", normalizedRoot));
const normalizedProgramsByName = new Map(normalizedProgramsSource.records.map((program) => [program.name, program]));
const programs = [];
for (const file of programFiles) {
  const record = await readJson(new URL(file, collectedPrograms));
  const normalized = normalizedProgramsByName.get(record.inventory_name || record.title);
  const extractedSequences = normalized ? extractNormalizedSequences(normalized) : extractSemesterSequences(record);
  const sequences = applyVerifiedVariantOverrides(record.inventory_name || record.title, extractedSequences);
  const periodGroups = Map.groupBy(sequences, (item) => item.period);
  const variantGroups = [...periodGroups.values()].filter((items) => new Set(items.map((item) => JSON.stringify(item.semesters))).size > 1);
  const variantsSeparated = variantGroups.length > 0 && variantGroups.every((items) => {
    const keys = items.map((item) => item.audience_key);
    return keys.every((key) => key && key !== "shared") && new Set(keys).size === keys.length;
  });
  const variantsNeedReview = variantGroups.length > 0 && !variantsSeparated;
  programs.push({
    id: file.replace(/\.json$/, ""),
    name: record.inventory_name || record.title,
    title: record.title,
    source: record.source_url,
    source_sha256: record.source_sha256,
    sequences,
    review_flags: [
      ...(sequences.some((item) => item.display_mode === "published_period") ? ["official_source_does_not_split_every_period_by_semester"] : []),
      ...(variantsSeparated ? ["curriculum_variants_separated"] : []),
      ...(variantsNeedReview ? ["multiple_curriculum_variants_detected"] : []),
    ],
  });
}

const minorsSource = await readJson(new URL("minors.json", normalizedRoot));
const programTablesSource = await readJson(new URL("program-tables.json", normalizedRoot));
const compatibilitySource = await readJson(new URL("major-minor-compatibility.json", normalizedRoot));
const unresolvedSource = await readJson(new URL("unresolved-course-references.json", normalizedRoot));

for (const program of programs) {
  program.unresolved_references = unresolvedSource.records
    .filter((record) => record.occurrences.some((occurrence) => occurrence.source_url.startsWith(program.source)))
    .map((record) => ({ code: record.code, classification: record.classification }));
  program.publication_status = program.review_flags.includes("multiple_curriculum_variants_detected")
    ? "manual_variant_review"
    : program.review_flags.includes("official_source_does_not_split_every_period_by_semester")
      ? "published_period_only"
      : "semester_ready";
}

const minors = minorsSource.records.map((minor) => ({
  name: minor.name,
  title: minor.official_title,
  required_course_count: minor.required_course_count,
  exclusions: minor.excluded_programs_or_plans,
  groups: minor.curriculum_groups,
  notes: minor.published_notes,
  source: minor.evidence.source_url,
}));

const programTables = programTablesSource.records.map((table) => ({
  name: table.name,
  title: table.title,
  course_codes: table.course_codes_referenced,
  source: table.evidence.source_url,
}));

const dataset = {
  metadata: {
    calendar_year: "2026-2027",
    authority: "Toronto Metropolitan University Undergraduate Calendar",
    generated_at: new Date().toISOString(),
    publication_status: "review_required",
  },
  counts: {
    programs: programs.length,
    minors: minors.length,
    compatibility_assessments: compatibilitySource.records.length,
    program_tables: programTables.length,
    unresolved_references: unresolvedSource.records.length,
    programs_with_individual_semesters: programs.filter((program) => program.sequences.some((item) => item.display_mode === "semester")).length,
    programs_with_grouped_periods: programs.filter((program) => program.sequences.some((item) => item.display_mode === "published_period")).length,
    programs_with_multiple_variants: programs.filter((program) => program.review_flags.includes("multiple_curriculum_variants_detected")).length,
    programs_with_separated_variants: programs.filter((program) => program.review_flags.includes("curriculum_variants_separated")).length,
  },
  programs,
  minors,
  program_tables: programTables,
  compatibility: compatibilitySource.records,
  unresolved_references: unresolvedSource.records,
};

await mkdir(new URL("public/data/", root), { recursive: true });
await writeFile(output, `${JSON.stringify(dataset)}\n`);
const publicationReport = {
  calendar_year: "2026-2027",
  generated_at: dataset.metadata.generated_at,
  counts: Object.fromEntries(["semester_ready", "published_period_only", "manual_variant_review"].map((status) => [status, programs.filter((program) => program.publication_status === status).length])),
  programs: programs.map((program) => ({
    id: program.id,
    name: program.name,
    source: program.source,
    publication_status: program.publication_status,
    review_flags: program.review_flags,
    unresolved_references: program.unresolved_references,
  })),
};
await writeFile(new URL("research/calendar-2026-2027/normalized/site-publication-report.json", root), `${JSON.stringify(publicationReport, null, 2)}\n`);
console.log(`Wrote ${programs.length} programs and ${minors.length} minors to ${output.pathname}`);
