# Annual calendar update procedure

This file is the handoff for a future Course Atlas update task.

## Requested task format

Example: `Update Course Atlas to the 2027-2028 TMU Undergraduate Calendar using only official TMU sources.`

## Safe update workflow

1. Create a new calendar directory. Never overwrite the previous year's research.
2. Re-inventory all official program, minor, concentration, specialization, liberal studies, open elective, course, and addenda pages.
3. Collect the new official records and keep their source URLs and verification dates.
4. Compare stable identifiers and normalized academic rules against the previous calendar.
5. Classify every change as added, removed, renamed, moved, or academically changed.
6. Recalculate relationships affected by changed courses, requirements, exclusions, or requisite logic.
7. Run completeness and contradiction checks for the entire new calendar, including apparently unchanged records.
8. Produce a human-readable change report.
9. Update the website's active calendar only after validation passes.

## Required checks

- Every official program entry is accounted for.
- Every official minor is accounted for.
- Program semester totals and selection counts reconcile.
- Every referenced course and table resolves.
- Prerequisite expressions preserve AND, OR, grade, standing, and permission conditions.
- Antirequisites and corequisites are not mistaken for prerequisites.
- Open Elective and Liberal Studies exclusions are program-aware.
- Minor and concentration double-counting restrictions are enforced.
- Addenda and errata have been checked before release.
- Removed or redirected official links are reported.

The update is incomplete if any record silently falls back to a previous calendar year's rule.

## Reproducible research commands

The repository includes three research stages:

1. `research/scripts/collect_calendar.py` collects official program, minor, program-subpage, concentration, specialization, Liberal Studies, Open Elective, and addenda evidence.
2. `research/scripts/normalize_calendar.py` creates structured curriculum periods, requirement groups, minor curricula, and major-minor assessments.
3. `research/scripts/validate_research.py` checks completeness and writes the release report.

The year constants and output directory must be changed together for a new calendar. A future update should preserve the previous calendar directory and compare normalized records by their stable program, plan, minor, course, and source identifiers.
