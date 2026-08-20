"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { minorOptions, programs } from "./program-data";
import type { AtlasItem } from "./program-data";

type CourseRecord = {
  code: string;
  name: string;
  description: string;
  sections: string[];
  prerequisites: string[];
  corequisites: string[];
  antirequisites: string[];
  restrictions: string[];
  source: string;
  core_elective_group?: string;
};

type ConnectionLine = { x1: number; y1: number; x2: number; y2: number };

const dataUrls = ["electives.json", "data/electives.json"];

export default function Home() {
  const [programId, setProgramId] = useState("cs");
  const [path, setPath] = useState("regular");
  const [minorId, setMinorId] = useState("none");
  const [dark, setDark] = useState(false);
  const [selected, setSelected] = useState<AtlasItem | null>(null);
  const [eligibility, setEligibility] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [connectionLines, setConnectionLines] = useState<ConnectionLine[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      for (const path of dataUrls) {
        const response = await fetch(new URL(path, document.baseURI));
        if (response.ok) {
          const result = await response.json();
          setCourses(result.courses ?? []);
          break;
        }
      }
    })().catch(() => setCourses([]));
  }, []);

  const program = programs[programId];
  const minor = minorOptions.find((item) => item.id === minorId) ?? minorOptions[0];
  const allItems = useMemo(() => program.semesters.flat(), [program]);
  const courseRecord = selected?.type === "course" ? courses.find((course) => course.code === selected.code) : undefined;

  const directBefore = useMemo(() => selected?.prerequisites ?? [], [selected]);
  const directAfter = useMemo(() => selected?.type === "course"
    ? allItems.filter((item) => item.prerequisites?.includes(selected.code)).map((item) => item.code)
    : [], [allItems, selected]);

  const slotResults = useMemo(() => {
    if (selected?.type !== "slot" || !selected.slotSection) return [];
    const normalized = query.trim().toLowerCase();
    return courses
      .filter((course) => selected.allowedCodes?.length ? selected.allowedCodes.includes(course.code) : course.sections.includes(selected.slotSection!))
      .filter((course) => !normalized || `${course.code} ${course.name}`.toLowerCase().includes(normalized))
      .slice(0, 12);
  }, [courses, query, selected]);

  useLayoutEffect(() => {
    const container = mapRef.current;
    if (!container || selected?.type !== "course") {
      setConnectionLines([]);
      return;
    }

    const draw = () => {
      const bounds = container.getBoundingClientRect();
      const selectedNode = container.querySelector<HTMLElement>(".course-node.selected");
      if (!selectedNode) return setConnectionLines([]);
      const selectedBounds = selectedNode.getBoundingClientRect();
      const origin = {
        x: selectedBounds.left - bounds.left + selectedBounds.width / 2,
        y: selectedBounds.top - bounds.top + selectedBounds.height / 2,
      };
      const next = Array.from(container.querySelectorAll<HTMLElement>(".course-node.related")).map((node) => {
        const target = node.getBoundingClientRect();
        return {
          x1: origin.x,
          y1: origin.y,
          x2: target.left - bounds.left + target.width / 2,
          y2: target.top - bounds.top + target.height / 2,
        };
      });
      setConnectionLines(next);
    };

    const frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    window.addEventListener("resize", draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [selected, directBefore, directAfter, programId, path]);

  const chooseProgram = (id: string) => {
    setProgramId(id);
    setSelected(null);
    setCompleted(new Set());
    setQuery("");
  };

  const chooseItem = (item: AtlasItem) => {
    if (eligibility && item.type === "course") {
      setCompleted((previous) => {
        const next = new Set(previous);
        if (next.has(item.code)) next.delete(item.code); else next.add(item.code);
        return next;
      });
    }
    setSelected(item);
    setQuery("");
  };

  const isMinorMatch = (item: AtlasItem) => {
    if (item.type !== "course") return false;
    return (minor.overlapByProgram[programId as keyof typeof minor.overlapByProgram] ?? []).includes(item.code);
  };

  const eligibilityClass = (item: AtlasItem) => {
    if (!eligibility || item.type !== "course") return "";
    if (completed.has(item.code)) return " completed";
    const ready = (item.prerequisites ?? []).every((code) => completed.has(code));
    return ready ? " available" : " locked";
  };

  return (
    <main className={dark ? "atlas-site dark" : "atlas-site"}>
      <header className="atlas-header">
        <a className="atlas-brand" href="#top"><span>CA</span><div><strong>Course Atlas</strong><small>Toronto Metropolitan University</small></div></a>
        <nav>
          <a href="#program-map">Programs</a>
          <a href="#guide">Guide</a>
          <a href="./about.html">About</a>
          <span className="calendar-label">2026-2027 calendar</span>
          <button type="button" onClick={() => setDark((value) => !value)}>{dark ? "Light mode" : "Dark mode"}</button>
        </nav>
      </header>

      <section className="atlas-intro" id="top">
        <p className="atlas-kicker">Undergraduate degree planning</p>
        <h1>See the whole program.<br />Understand every choice.</h1>
        <p>Browse a TMU program semester by semester, inspect direct course relationships, explore compatible minors and search only the courses permitted in each requirement slot.</p>
      </section>

      <section className="atlas-toolbar" id="program-map">
        <label>Program<select value={programId} onChange={(event) => chooseProgram(event.target.value)}>{Object.entries(programs).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>
        <label>Path<select value={path} onChange={(event) => setPath(event.target.value)}><option value="regular">Regular</option><option value="coop">Co-op</option></select></label>
        <label>Minor overlay<select value={minorId} onChange={(event) => setMinorId(event.target.value)}>{minorOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button className={eligibility ? "eligibility active" : "eligibility"} type="button" onClick={() => setEligibility((value) => !value)}>{eligibility ? "Eligibility mode: On" : "Eligibility mode"}</button>
      </section>

      <section className="program-heading">
        <div><p>{program.faculty}</p><h2>{program.name}</h2></div>
        <div className="map-legend"><span><i className="required-swatch" />Required</span><span><i className="choice-swatch" />Choice</span><span><i className="minor-swatch" />Minor overlap</span></div>
      </section>

      <div className="atlas-workspace">
        <div className="semester-map" ref={mapRef}>
          <svg className="connection-layer" aria-hidden="true">
            {connectionLines.map((line, index) => <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />)}
          </svg>
          {program.semesters.map((semester, index) => (
            <div key={index}>
              <section className="semester-row">
                <div className="semester-title"><strong>Semester {index + 1}</strong><span>Year {Math.floor(index / 2) + 1}</span></div>
                <div className="semester-courses">
                  {semester.map((item, itemIndex) => {
                    const related = selected?.type === "course" && (directBefore.includes(item.code) || directAfter.includes(item.code));
                    const selectedItem = selected === item;
                    return <button key={`${item.code}-${itemIndex}`} data-code={item.code} type="button" className={`course-node ${item.type}${isMinorMatch(item) ? " minor-match" : ""}${related ? " related" : ""}${selectedItem ? " selected" : ""}${eligibilityClass(item)}`} onClick={() => chooseItem(item)}><strong>{item.code}</strong><span>{item.name}</span>{eligibility && item.type === "course" && <small>{completed.has(item.code) ? "Completed" : (item.prerequisites ?? []).every((code) => completed.has(code)) ? "Available" : "Prerequisite needed"}</small>}</button>;
                  })}
                </div>
              </section>
              {path === "coop" && program.coopSequence.filter((term) => term.after === index + 1).map((term) => <section className="work-row" key={term.code}><div>Co-op</div><button type="button" onClick={() => setSelected({ code: term.code, name: term.name, type: "work" })}><strong>{term.code}</strong><span>{term.name}</span></button></section>)}
            </div>
          ))}
        </div>

        <aside className="detail-panel" aria-live="polite">
          {!selected && <>
            <p className="panel-label">Program overview</p><h3>{program.name}</h3>
            <p className="panel-copy">Select a course to inspect its information and immediate connections. Select a yellow requirement slot to search its permitted choices.</p>
            <dl><div><dt>Calendar</dt><dd>2026-2027 undergraduate calendar</dd></div><div><dt>Displayed</dt><dd>All eight academic semesters</dd></div><div><dt>Selected minor</dt><dd>{minor.name}</dd></div></dl>
            <a className="official-link" href={program.source} target="_blank" rel="noreferrer">Official TMU program source</a>
          </>}

          {selected && <>
            <button className="panel-close" type="button" onClick={() => setSelected(null)}>Close</button>
            <p className="panel-label">{selected.type === "slot" ? "Requirement search" : selected.type === "work" ? "Co-op work term" : "Course details"}</p>
            <h3>{selected.code}</h3><p className="panel-course-name">{selected.name}</p>
            {selected.type === "course" && <>
              <p className="panel-copy">{courseRecord?.description || "This curriculum course is verified against the official program page. Its complete catalogue description will appear when available in the course dataset."}</p>
              <dl>
                <div><dt>Prerequisites</dt><dd>{courseRecord?.prerequisites.join("; ") || selected.prerequisites?.join("; ") || "None listed"}</dd></div>
                <div><dt>Corequisites</dt><dd>{courseRecord?.corequisites.join("; ") || "None listed"}</dd></div>
                <div><dt>Antirequisites</dt><dd>{courseRecord?.antirequisites.join("; ") || "None listed"}</dd></div>
                <div><dt>Restrictions and notes</dt><dd>{courseRecord?.restrictions.join(" ") || "No program-specific restriction displayed."}</dd></div>
                <div><dt>Directly unlocks</dt><dd>{directAfter.join(", ") || "No immediate dependent course shown"}</dd></div>
              </dl>
              <a className="official-link" href={courseRecord?.source || program.source} target="_blank" rel="noreferrer">Official TMU source</a>
            </>}
            {selected.type === "slot" && <>
              <p className="panel-copy">Results are restricted to courses recorded for this exact requirement category.</p>
              <label className="slot-search">Search allowed courses<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Course code or title" /></label>
              <div className="slot-results">{slotResults.map((course) => <button type="button" key={course.code} onClick={() => setSelected({ code: course.code, name: course.name, type: "course", prerequisites: course.prerequisites })}><strong>{course.code}</strong><span>{course.name}</span>{selected.slotSection === "Core Elective" && course.core_elective_group && <small>{course.core_elective_group}</small>}</button>)}{courses.length > 0 && slotResults.length === 0 && <p>No allowed course matches this search.</p>}{courses.length === 0 && <p>Loading verified options...</p>}</div>
            </>}
            {selected.type === "work" && <><p className="panel-copy">This work term is inserted only in the co-op sequence. Academic semesters remain visible around it.</p><a className="official-link" href={program.source} target="_blank" rel="noreferrer">Official co-op sequence</a></>}
          </>}

          <div className="minor-summary"><strong>{minor.name}</strong>{minor.id === "none" ? <p>Select a minor to reveal possible curriculum overlap.</p> : <><p>Officially eligible under TMU&apos;s general minor policy for this prototype program set.</p><p>Highlighted courses are possible overlap candidates, not automatic double-counting.</p></>}</div>
        </aside>
      </div>

      <section className="atlas-guide" id="guide"><p className="atlas-kicker">How to use Course Atlas</p><div><article><strong>1</strong><h3>Choose a program</h3><p>See all semesters together instead of opening one year at a time.</p></article><article><strong>2</strong><h3>Inspect courses and choices</h3><p>Course details stay beside the map. Elective searches stay inside the selected requirement.</p></article><article><strong>3</strong><h3>Try planning modes</h3><p>Overlay a minor, switch to co-op or mark completed courses in Eligibility Mode.</p></article></div><p className="site-disclaimer">Course Atlas is an independent planning aid for TMU students using the 2026-2027 Undergraduate Calendar. It does not replace your Academic Advisement Report, current course availability or advice from your program department.</p></section>
      <footer><div><strong>Course Atlas</strong><span>Made to make TMU program requirements easier to understand.</span></div><a href="https://www.torontomu.ca/calendar/2026-2027/" target="_blank" rel="noreferrer">Official TMU Calendar</a></footer>
    </main>
  );
}
