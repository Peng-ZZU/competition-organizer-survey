## Context

The project uses static HTML entry points and a shared CSS file. Both the respondent survey and admin analytics UI are rendered into their entry-point `<main>` elements. Existing media queries cover several desktop-to-mobile transitions, but the shared components still need a consistent narrow viewport contract.

## Approach

Keep one DOM structure and progressively adapt the existing CSS. Use fluid widths (`min()`, `clamp()`, and `minmax(0, 1fr)`) for the normal layout, then use targeted media queries for structural changes that cannot be fluid: collapse sidebars and survey navigation, stack action rows, allow labels and buttons to wrap, and constrain dialogs to the viewport. Preserve the current desktop appearance and interaction model.

## Responsive rules

- At widths below 800px, survey navigation becomes a full-width scrollable row and admin navigation becomes a stacked content section.
- At widths below 640px, page gutters, card padding, headings, action rows, review columns, dialog content, and respondent rows reduce or stack so no component forces document-level horizontal scrolling.
- At widths below 400px, controls retain comfortable touch targets, long labels and values can wrap, and buttons use full available width where a side-by-side row would overflow.
- Charts and data panels remain contained within their parent width; only intentionally scrollable navigation may scroll horizontally.

## Verification

Add Playwright checks at 320x568, 390x844, and 768x1024. Assert document width does not exceed the viewport, the main survey/admin landmarks are visible, and representative navigation, form, dialog, and action controls remain reachable.
