## Context

The survey currently builds pages from a mixed choice/text stream and renders section buttons. The database save function currently enforces the complete current catalog, while analytics already treats missing answers as absent from question-specific denominators.

## Goals / Non-Goals

**Goals:**

- Make page boundaries reflect answer effort: single-choice pairs, one multi-select, or one text question.
- Make the navigation communicate exact page position without taking vertical space on mobile.
- Add an explicit partial-save path that remains type-safe and versioned.

**Non-Goals:**

- No change to question wording, the 23-question catalog, or identity privacy model.
- No separate draft table or new respondent status field.
- No change to deleted-response filtering.

## Decisions

- **Represent pages from question types.** The page builder will pair adjacent single-choice questions, keep multi-select and text questions alone, and keep rating questions eligible for a choice page. This preserves deterministic ordering and avoids section-specific exceptions.
- **Use page-number navigation.** The navigation will render one button per page inside an overflow-x container; the active button remains visually distinct. Section metadata remains available for headings and final-review links but is not the navigation unit.
- **Use an explicit partial-save mode.** The client sends a distinct save intent or validation mode. The database function validates all supplied keys and active relationships, then makes completeness conditional on that mode. A full final submission continues to require all current required questions.
- **Keep one response record.** Partial saves update the same identity/version row, so later loads, conflicts, statistics, CSV export, and recycle-bin behavior need no second data model.

## Risks / Trade-offs

- [Partial records may lower the meaning of “completed”] → Label the dashboard metric as persisted responses where needed and calculate question distributions using per-question valid denominators.
- [A partial-save mode could weaken validation] → Keep strict key, type, option, conditional, and `Other` checks in both modes; only requiredness changes.
- [Many page buttons may be hard to scan] → Use a compact horizontal scroll container and keep the active page visible after navigation.

## Migration Plan

1. Add tests for page construction, page navigation, partial validation, and persistence behavior.
2. Update the client and database function contract with backward-compatible defaults for full saves.
3. Apply a new Supabase migration and run local integration tests.
4. Run browser tests at mobile and desktop widths, then run staging smoke tests including partial save, statistics, CSV, and later reload.

## Open Questions

None; partial submission is explicitly an accepted persisted response and is included in existing analytics/export datasets.
