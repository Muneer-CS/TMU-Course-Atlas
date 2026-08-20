# Curriculum rule normalization

Course Atlas keeps collected evidence separate from rules that are safe to publish as interactive planning guidance.

## Publication states

- `semester_ready`: The official page assigns requirements to individual semesters and no competing curriculum sequence was detected.
- `published_period_only`: TMU publishes the requirements as a semester pair or academic level. The site must preserve that grouping and must not invent a semester assignment.
- `manual_variant_review`: The page contains multiple curricula, admission cohorts, streams, options or duplicated sequences that cannot be combined safely. A specific variant must be selected and verified before it is connected to the interactive map.

## Course reference handling

- A course with a current catalogue record can be displayed with its official description and requisites.
- A published requirement reference missing from the current catalogue remains attached to its source context but is not offered as an ordinary selectable course.
- Historical codes, range boundaries and restriction examples are never converted into selectable courses.

## Update workflow

1. Collect the official calendar pages and record their fingerprints.
2. Normalize programs, tables, minors and course references.
3. Run `pnpm data:site` to rebuild the site-ready dataset and publication report.
4. Review every `manual_variant_review` record and all newly unresolved references.
5. Run the automated test suite before publishing.

