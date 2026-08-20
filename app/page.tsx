"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type CourseRecord = { code: string; name: string; description: string; sections: string[]; prerequisites: string[]; corequisites: string[]; antirequisites: string[]; restrictions: string[]; source: string; core_elective_group?: string };
type EvidenceBlock = { text: string; course_codes: string[] };
type AtlasSemester = { number: number; blocks: EvidenceBlock[] };
type AtlasSequence = { period: string; context: string[]; semesters: AtlasSemester[]; period_blocks: EvidenceBlock[]; display_mode: "semester" | "published_period"; path_key: string; path_label: string };
type AtlasProgram = { id: string; name: string; title: string; source: string; sequences: AtlasSequence[] };
type AtlasMinor = { name: string; groups: unknown; source: string };
type AtlasTable = { name: string; title: string; course_codes: string[]; source: string };
type Compatibility = { program: string; minor: string; status: string };
type AtlasDataset = { programs: AtlasProgram[]; minors: AtlasMinor[]; program_tables: AtlasTable[]; compatibility: Compatibility[] };
type MapItem = { code: string; name: string; type: "course" | "slot"; allowedCodes?: string[]; section?: string; source?: string };
type MapRow = { key: string; title: string; subtitle: string; items: MapItem[] };
type ConnectionLine = { x1: number; y1: number; x2: number; y2: number };

const courseUrls = ["data/electives.json", "electives.json"];
const atlasUrls = ["data/course-atlas.json", "course-atlas.json"];
const requirementPattern = /^(?:REQUIRED GROUP|CORE ELECTIVE|OPEN ELECTIVE|OPEN ELECTIVES|LIBERAL STUDIES|ONE ELECTIVE|ELECTIVE|PROFESSIONAL|STREAM ELECTIVE)/i;

function extractCodes(value: unknown): string[] {
  const codes = new Set<string>();
  const visit = (item: unknown) => {
    if (typeof item === "string") for (const match of item.matchAll(/\b[A-Z]{2,4} \d{3}\b/g)) codes.add(match[0]);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === "object") Object.values(item).forEach(visit);
  };
  visit(value);
  return [...codes];
}

function sectionFor(text: string) {
  if (/Table A|Lower Level Liberal/i.test(text)) return "Lower Liberal Studies";
  if (/Table B|Upper Level Liberal/i.test(text)) return "Upper Liberal Studies";
  if (/OPEN ELECTIVE/i.test(text)) return "Open Elective";
  if (/CORE ELECTIVE|PROFESSIONAL|STREAM ELECTIVE/i.test(text)) return "Core Elective";
  return undefined;
}

function tableCodes(program: AtlasProgram, text: string, tables: AtlasTable[]) {
  const roman = text.match(/Table\s+([IVX]+)/i)?.[1]?.toUpperCase();
  const words = program.name.toLowerCase().split(/\s+/).filter((word) => word.length > 3).slice(0, 2);
  return [...new Set(tables.filter((table) => {
    const label = `${table.name} ${table.title}`.toLowerCase();
    return words.every((word) => label.includes(word)) && (!roman || new RegExp(`table\\s+${roman}\\b`, "i").test(label));
  }).flatMap((table) => table.course_codes))];
}

function blocksToItems(blocks: EvidenceBlock[], program: AtlasProgram, tables: AtlasTable[], courseMap: Map<string, CourseRecord>): MapItem[] {
  const items: MapItem[] = [];
  let pending: { text: string; codes: string[] } | null = null;
  const flush = () => {
    if (!pending) return;
    const section = sectionFor(pending.text);
    const tableAllowed = section === "Core Elective" ? tableCodes(program, pending.text, tables) : [];
    items.push({ code: pending.text.replace(/:.*/, "").trim(), name: "Search allowed courses", type: "slot", allowedCodes: pending.codes.length ? pending.codes : tableAllowed, section });
    pending = null;
  };
  for (const block of blocks) {
    const text = block.text.trim();
    if (!text || /^\*|^Note:|^Students must|^Course selection/i.test(text)) continue;
    if (/^REQUIRED\s*:/i.test(text)) { flush(); continue; }
    if (requirementPattern.test(text)) {
      flush();
      const section = sectionFor(text);
      if (section && !/^REQUIRED GROUP/i.test(text)) items.push({ code: text.replace(/:.*/, "").trim(), name: "Search allowed courses", type: "slot", allowedCodes: section === "Core Elective" ? tableCodes(program, text, tables) : [], section });
      else pending = { text, codes: [] };
      continue;
    }
    const codes = block.course_codes ?? [];
    if (!codes.length) continue;
    if (pending) { pending.codes.push(...codes); continue; }
    if (codes.length > 1 || /\bOR\b/.test(text)) { items.push({ code: "Course choice", name: text, type: "slot", allowedCodes: codes }); continue; }
    const code = codes[0];
    if (!text.startsWith(code)) continue;
    const record = courseMap.get(code);
    items.push({ code, name: record?.name ?? text.slice(code.length).replace(/^[*†‡\s-]+/, ""), type: "course", source: record?.source });
  }
  flush();
  return items.filter((item, index, all) => all.findIndex((candidate) => candidate.code === item.code && candidate.name === item.name) === index);
}

export default function Home() {
  const [atlas, setAtlas] = useState<AtlasDataset | null>(null);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [programId, setProgramId] = useState("computer-science");
  const [pathKey, setPathKey] = useState("");
  const [minorName, setMinorName] = useState("");
  const [dark, setDark] = useState(false);
  const [eligibility, setEligibility] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<MapItem | null>(null);
  const [query, setQuery] = useState("");
  const [connectionLines, setConnectionLines] = useState<ConnectionLine[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async <T,>(urls: string[]) => {
      for (const url of urls) { const response = await fetch(new URL(url, document.baseURI)); if (response.ok) return response.json() as Promise<T>; }
      throw new Error("Dataset unavailable");
    };
    Promise.all([load<AtlasDataset>(atlasUrls), load<{ courses: CourseRecord[] }>(courseUrls)])
      .then(([atlasData, courseData]) => { setAtlas(atlasData); setCourses(courseData.courses); })
      .catch(() => { setAtlas(null); setCourses([]); });
  }, []);

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.code, course])), [courses]);
  const program = atlas?.programs.find((item) => item.id === programId) ?? atlas?.programs.find((item) => item.name === "Computer Science") ?? atlas?.programs[0];
  const pathOptions = useMemo(() => {
    if (!program) return [];
    const options = new Map<string, string>();
    for (const sequence of program.sequences) if (!/common/i.test(sequence.path_label)) options.set(sequence.path_key, sequence.path_label);
    if (!options.size) options.set("all", program.name);
    return [...options].map(([key, label]) => ({ key, label }));
  }, [program]);
  const activePathKey = pathOptions.some((option) => option.key === pathKey) ? pathKey : pathOptions[0]?.key ?? "all";

  const sequences = useMemo(() => {
    if (!program) return [];
    const exact = program.sequences.filter((sequence) => sequence.path_key === activePathKey);
    const common = program.sequences.filter((sequence) => /common/i.test(sequence.path_label));
    return ([...common, ...exact].length ? [...common, ...exact] : program.sequences).filter((sequence, index, all) => all.findIndex((candidate) => candidate.period === sequence.period && candidate.path_key === sequence.path_key) === index);
  }, [activePathKey, program]);

  const rows = useMemo<MapRow[]>(() => {
    if (!program || !atlas) return [];
    return sequences.flatMap((sequence) => sequence.semesters.length ? sequence.semesters.map((semester) => ({ key: `${sequence.path_key}-${sequence.period}-${semester.number}`, title: `Semester ${semester.number}`, subtitle: `Year ${Math.ceil(semester.number / 2)}`, items: blocksToItems(semester.blocks, program, atlas.program_tables, courseMap) })) : [{ key: `${sequence.path_key}-${sequence.period}`, title: sequence.period, subtitle: "Published together by TMU", items: blocksToItems(sequence.period_blocks, program, atlas.program_tables, courseMap) }])
      .filter((row, index, all) => all.findIndex((candidate) => candidate.title === row.title && JSON.stringify(candidate.items) === JSON.stringify(row.items)) === index);
  }, [atlas, courseMap, program, sequences]);

  const compatibleMinors = useMemo(() => {
    if (!atlas || !program) return [];
    const statuses = new Map(atlas.compatibility.filter((item) => item.program === program.name).map((item) => [item.minor, item.status]));
    return atlas.minors.filter((minor) => statuses.get(minor.name) !== "officially_excluded");
  }, [atlas, program]);
  const activeMinorName = compatibleMinors.some((minor) => minor.name === minorName) ? minorName : "";
  const minor = compatibleMinors.find((item) => item.name === activeMinorName);
  const minorCodes = useMemo(() => new Set(extractCodes(minor?.groups)), [minor]);
  const displayedCourses = useMemo(() => rows.flatMap((row) => row.items).filter((item) => item.type === "course"), [rows]);
  const selectedRecord = selected?.type === "course" ? courseMap.get(selected.code) : undefined;
  const directBefore = useMemo(() => selectedRecord?.prerequisites ?? [], [selectedRecord]);
  const directAfter = useMemo(() => selected?.type === "course" ? displayedCourses.filter((item) => courseMap.get(item.code)?.prerequisites.includes(selected.code)).map((item) => item.code) : [], [courseMap, displayedCourses, selected]);
  const slotResults = useMemo(() => {
    if (selected?.type !== "slot") return [];
    const allowed = selected.allowedCodes?.length ? new Set(selected.allowedCodes) : null;
    const normalized = query.trim().toLowerCase();
    return courses.filter((course) => allowed ? allowed.has(course.code) : selected.section ? course.sections.includes(selected.section) : false).filter((course) => !normalized || `${course.code} ${course.name}`.toLowerCase().includes(normalized)).slice(0, 18);
  }, [courses, query, selected]);

  useLayoutEffect(() => {
    const container = mapRef.current;
    if (!container || selected?.type !== "course") { setConnectionLines([]); return; }
    const draw = () => {
      const bounds = container.getBoundingClientRect();
      const originNode = container.querySelector<HTMLElement>(`.course-node[data-code="${CSS.escape(selected.code)}"]`);
      if (!originNode) { setConnectionLines([]); return; }
      const origin = originNode.getBoundingClientRect();
      const originPoint = { x: origin.left - bounds.left + origin.width / 2, y: origin.top - bounds.top + origin.height / 2 };
      const related = new Set([...directBefore, ...directAfter]);
      setConnectionLines([...container.querySelectorAll<HTMLElement>(".course-node")].filter((node) => related.has(node.dataset.code ?? "")).map((node) => { const target = node.getBoundingClientRect(); return { x1: originPoint.x, y1: originPoint.y, x2: target.left - bounds.left + target.width / 2, y2: target.top - bounds.top + target.height / 2 }; }));
    };
    const frame = requestAnimationFrame(draw); const observer = new ResizeObserver(draw); observer.observe(container); window.addEventListener("resize", draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", draw); };
  }, [directAfter, directBefore, rows, selected]);

  const chooseProgram = (id: string) => { setProgramId(id); setSelected(null); setCompleted(new Set()); setMinorName(""); setQuery(""); };
  const chooseItem = (item: MapItem) => { if (eligibility && item.type === "course") setCompleted((previous) => { const next = new Set(previous); if (next.has(item.code)) next.delete(item.code); else next.add(item.code); return next; }); setSelected(item); setQuery(""); };
  const eligibilityClass = (item: MapItem) => { if (!eligibility || item.type !== "course") return ""; if (completed.has(item.code)) return " completed"; return (courseMap.get(item.code)?.prerequisites ?? []).every((code) => completed.has(code)) ? " available" : " locked"; };

  return <main className={dark ? "atlas-site dark" : "atlas-site"}>
    <header className="atlas-header"><a className="atlas-brand" href="#top"><span>CA</span><div><strong>Course Atlas</strong><small>Toronto Metropolitan University</small></div></a><nav><a href="#program-map">Programs</a><a href="#guide">Guide</a><a href="./about.html">About</a><span className="calendar-label">2026-2027 calendar</span><button type="button" onClick={() => setDark((value) => !value)}>{dark ? "Light mode" : "Dark mode"}</button></nav></header>
    <section className="atlas-intro" id="top"><p className="atlas-kicker">Undergraduate degree planning</p><h1>See the whole program.<br />Understand every choice.</h1><p>Course Atlas helps Toronto Metropolitan University undergraduate students understand their programs in one place. Choose your program to view its full course sequence, explore requirement options, check course details and see how prerequisites connect.</p></section>
    <section className="atlas-toolbar" id="program-map"><label>Program<select value={program?.id ?? ""} onChange={(event) => chooseProgram(event.target.value)}>{atlas?.programs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Path<select value={activePathKey} onChange={(event) => { setPathKey(event.target.value); setSelected(null); setCompleted(new Set()); }}>{pathOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label>Minor overlay<select value={activeMinorName} onChange={(event) => setMinorName(event.target.value)}><option value="">No minor selected</option>{compatibleMinors.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><button className={eligibility ? "eligibility active" : "eligibility"} type="button" onClick={() => setEligibility((value) => !value)}>{eligibility ? "Eligibility mode: On" : "Eligibility mode"}</button></section>
    <section className="program-heading"><div><p>{program?.title}</p><h2>{program?.name ?? "Loading programs"}</h2></div><div className="map-legend"><span><i className="required-swatch" />Required</span><span><i className="choice-swatch" />Choice</span><span><i className="minor-swatch" />Minor overlap</span></div></section>
    <div className="atlas-workspace"><div className="semester-map" ref={mapRef}><svg className="connection-layer" aria-hidden="true">{connectionLines.map((line, index) => <line key={index} {...line} />)}</svg>{rows.map((row) => <section className="semester-row" key={row.key}><div className="semester-title"><strong>{row.title}</strong><span>{row.subtitle}</span></div><div className="semester-courses">{row.items.map((item, index) => { const record = courseMap.get(item.code); const related = selected?.type === "course" && [...directBefore, ...directAfter].includes(item.code); return <button key={`${item.code}-${index}`} data-code={item.code} type="button" className={`course-node ${item.type}${minorCodes.has(item.code) ? " minor-match" : ""}${related ? " related" : ""}${selected === item ? " selected" : ""}${eligibilityClass(item)}`} onClick={() => chooseItem(item)}><strong>{item.code}</strong><span>{item.name}</span>{eligibility && item.type === "course" && <small>{completed.has(item.code) ? "Completed" : (record?.prerequisites ?? []).every((code) => completed.has(code)) ? "Available" : "Prerequisite needed"}</small>}</button>; })}</div></section>)}</div>
      <aside className="detail-panel" aria-live="polite">{!selected && <><p className="panel-label">Program overview</p><h3>{program?.name}</h3><p className="panel-copy">Select a course to inspect its information and immediate connections. Select a yellow requirement slot to search its permitted choices.</p><dl><div><dt>Calendar</dt><dd>2026-2027 undergraduate calendar</dd></div><div><dt>Displayed</dt><dd>{rows.length} academic periods</dd></div><div><dt>Selected minor</dt><dd>{minorName || "None"}</dd></div></dl>{program && <a className="official-link" href={program.source} target="_blank" rel="noreferrer">Official TMU program source</a>}</>}
        {selected && <><button className="panel-close" type="button" onClick={() => setSelected(null)}>Close</button><p className="panel-label">{selected.type === "slot" ? "Requirement search" : "Course details"}</p><h3>{selected.code}</h3><p className="panel-course-name">{selected.name}</p>{selected.type === "course" ? <><p className="panel-copy">{selectedRecord?.description || "Official course information is not available in the current catalogue record."}</p><dl><div><dt>Prerequisites</dt><dd>{selectedRecord?.prerequisites.join("; ") || "None listed"}</dd></div><div><dt>Corequisites</dt><dd>{selectedRecord?.corequisites.join("; ") || "None listed"}</dd></div><div><dt>Antirequisites</dt><dd>{selectedRecord?.antirequisites.join("; ") || "None listed"}</dd></div><div><dt>Restrictions and notes</dt><dd>{selectedRecord?.restrictions.join(" ") || "No restriction listed"}</dd></div><div><dt>Directly unlocks</dt><dd>{directAfter.join(", ") || "No immediate dependent course shown"}</dd></div></dl><a className="official-link" href={selectedRecord?.source || program?.source} target="_blank" rel="noreferrer">Official TMU source</a></> : <><p className="panel-copy">Results are restricted to courses recorded for this exact requirement.</p><label className="slot-search">Search allowed courses<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Course code or title" /></label><div className="slot-results">{slotResults.map((course) => <button key={course.code} type="button" onClick={() => setSelected({ code: course.code, name: course.name, type: "course", source: course.source })}><strong>{course.code}</strong><span>{course.name}</span>{course.core_elective_group && <small>{course.core_elective_group}</small>}</button>)}{courses.length > 0 && slotResults.length === 0 && <p>No allowed course matches this search.</p>}</div></>}</>}
        <div className="minor-summary"><strong>{minorName || "No minor selected"}</strong>{minor ? <><p>Highlighted courses appear in the official minor curriculum and may overlap with this program.</p><a className="official-link" href={minor.source} target="_blank" rel="noreferrer">Official TMU minor source</a></> : <p>Select a compatible minor to reveal possible curriculum overlap.</p>}</div></aside></div>
    <section className="atlas-guide" id="guide"><p className="atlas-kicker">How to use Course Atlas</p><div><article><strong>1</strong><h3>Choose a program</h3><p>Select your program and curriculum path to view all officially published academic periods together.</p></article><article><strong>2</strong><h3>Inspect courses and choices</h3><p>Click a course to view its details and official TMU source. Click a requirement to search only the courses officially permitted for that slot.</p></article><article><strong>3</strong><h3>Try planning modes</h3><p>Overlay a compatible minor or mark completed courses in Eligibility Mode to explore what may be available next.</p></article></div><p className="site-disclaimer">Course Atlas is an independent planning tool and is not affiliated with or endorsed by Toronto Metropolitan University. Information is linked to official TMU sources, but requirements and course availability may change. Always confirm important academic decisions using your Academic Advisement Report, the current Undergraduate Calendar and your program department.</p></section>
    <footer><div><strong>Course Atlas</strong><span>Built to make TMU program planning easier to understand.</span></div><a href="https://www.torontomu.ca/calendar/2026-2027/" target="_blank" rel="noreferrer">Official TMU Calendar</a></footer>
  </main>;
}
