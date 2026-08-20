# Course Atlas data model

The stored data is calendar-versioned and independent from the interface. Stable identifiers allow a later calendar to be compared without overwriting historical evidence.

## Core records

### Calendar

Identifies the academic year, official publication date, source set, collection status, and validation report.

### Program

Stores the official program entry, faculty, credential, duration, delivery variations, co-op availability, source URL, and one or more curriculum plans.

### Curriculum plan

Represents a specific published path. It can be scoped by admission cohort, stream, major, concentration, direct-entry status, or another official condition. A plan contains ordered periods and requirement slots.

### Requirement slot

A slot may be:

- one required course;
- a choice between explicitly listed courses;
- a number of selections from a program table;
- a Lower or Upper Level Liberal Studies requirement;
- an Open Elective requirement;
- a non-course requirement such as a work term.

Every slot records its count, allowed choices, exclusions, notes, and evidence.

### Course

Stores the official code, title, description, requisites, restrictions, grading status, source, and calendar status. Requisites retain both the official text and a normalized Boolean expression.

### Minor

Stores required and optional course groups, selection counts, explicit program exclusions, other restrictions, and evidence.

### Major-minor assessment

This is derived only after the program and minor are verified. It records:

- whether the minor is officially excluded;
- which minor courses already appear in the program;
- where eligible courses could fit;
- courses likely required in addition to the degree;
- conflicts with concentrations or double-counting rules;
- unresolved enrolment or prerequisite barriers.

It must never promise that a student can complete a minor within the normal degree length.

## Evidence object

Each academic fact uses the following shape:

```json
{
  "source_url": "https://www.torontomu.ca/calendar/2026-2027/.../",
  "calendar_year": "2026-2027",
  "verified_on": "YYYY-MM-DD",
  "evidence_type": "official",
  "source_text": "short relevant fact or locator",
  "status": "verified"
}
```

Allowed statuses are `uncollected`, `collected`, `verified`, `manual_review`, and `superseded`.

## Eligibility output

Eligibility Mode calculates only one of these states:

- `completed`
- `available_by_published_requisites`
- `locked_by_published_requisites`
- `manual_confirmation_required`
- `requirement_choice`

It does not claim that a course is scheduled, has seats, avoids timetable conflicts, or is open to a particular student. Those checks remain in TMU systems.

