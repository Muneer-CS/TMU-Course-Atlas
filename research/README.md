# Course Atlas research

This directory is the evidence layer for Course Atlas. Website code must not invent, infer, or silently repair academic rules.

## Current scope

- Calendar: 2026-2027
- Institution: Toronto Metropolitan University
- Academic level: undergraduate
- Program inventory: 72 official calendar entries, all collected
- Minor inventory: 69 official minors, all collected
- Official program subpages and tables: 130
- Optional specializations: 4
- Program-to-minor assessments: 4,968
- Separately published plan-to-minor assessments: 552
- Existing reusable course catalogue: `public/data/electives.json`

The official Undergraduate Calendar is the primary authority. MyServiceHub remains the final authority for an individual student's academic record and graduation requirements.

## Evidence rules

Every published academic claim must include:

1. An official TMU source URL.
2. The calendar year.
3. A verification status and verification date.
4. The exact program, plan, admission cohort, stream, or other scope to which it applies.
5. A manual-review flag when the source cannot be represented without ambiguity.

Course Atlas distinguishes three kinds of information:

- `official`: stated directly by an official TMU source.
- `derived`: mechanically calculated from official facts, such as whether completed prerequisites satisfy a Boolean prerequisite expression.
- `editorial`: non-academic labels such as topic tags.

Derived and editorial information must never be presented as an official TMU classification.

## Research sequence

1. Complete the program, minor, concentration, specialization, liberal studies, open elective, and course inventories.
2. Capture every program's curriculum versions, semesters, requirement slots, tables, streams, and exceptions.
3. Capture every minor's required groups, exclusions, and notes.
4. Normalize prerequisites, corequisites, antirequisites, grade thresholds, and enrolment restrictions.
5. Calculate major-to-minor compatibility only after both sides are verified.
6. Run completeness, link, relationship, and contradiction checks.
7. Produce a review report before any research dataset is released to the website.

## Release gate

A program is not publishable until all required semesters and requirement slots reconcile with its official curriculum, every referenced table exists, every course reference resolves, and unresolved rules are visibly flagged.

The collection report for this calendar is in `calendar-2026-2027/SUMMARY.md`. Raw official evidence is stored separately from normalized website-ready research so parsing can always be audited against TMU's published text.
