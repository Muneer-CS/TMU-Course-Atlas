# Course Atlas

Course Atlas is an evidence-based undergraduate curriculum explorer for Toronto Metropolitan University students. It is designed to show complete program structures, permitted elective choices, prerequisite relationships, co-op sequencing and compatible minors using the official 2026-2027 TMU Undergraduate Calendar.

## Current data coverage

- 72 official undergraduate program entries
- 69 official minors
- 130 official program tables and subpages
- 3,971 official course catalogue records
- 4,968 program-to-minor compatibility assessments

Every academic record retains its official TMU source. Unresolved historical or table-only references are flagged rather than presented as ordinary current courses.

## Development

```bash
pnpm install
pnpm data:site
pnpm test
pnpm dev
```

The yearly update process is documented in `research/update-guide.md`. Curriculum normalization and publication safeguards are documented in `research/rule-normalization.md`.

## Status

The research and curriculum-variant foundation is complete. The full all-program interface is under active development.

## Copyright

Copyright (c) 2026 Muneer Mahmoud. All rights reserved. See [LICENSE](LICENSE) for details.
