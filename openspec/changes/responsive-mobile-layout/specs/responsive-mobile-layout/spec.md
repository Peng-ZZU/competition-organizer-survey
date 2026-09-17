## ADDED Requirements

### Requirement: Responsive public survey layout

The public survey MUST fit viewport widths from 320 CSS pixels upward without document-level horizontal scrolling. Survey cards, question controls, section navigation, progress, validation messages, and form actions MUST remain visible and usable within the viewport.

#### Scenario: Phone viewport loads the survey

- **WHEN** a respondent opens the survey at 320px or 390px wide
- **THEN** the document scroll width is no greater than the viewport width
- **AND** the survey title, active section, current question controls, and navigation actions are reachable

#### Scenario: Narrow viewport advances through the form

- **WHEN** the respondent uses the next, previous, or submit actions on a narrow viewport
- **THEN** action controls wrap or stack as needed without clipping or horizontal page overflow

### Requirement: Responsive analytics layout

The private analytics page MUST fit viewport widths from 320 CSS pixels upward without document-level horizontal scrolling. Sidebar navigation, metrics, charts, filters, response rows, dialogs, and destructive-action controls MUST adapt to the available width.

#### Scenario: Phone viewport loads analytics

- **WHEN** an authorized administrator opens analytics at 320px or 390px wide
- **THEN** navigation, page heading, metrics, and the active view are visible within the viewport
- **AND** charts and response content remain contained by their panels

#### Scenario: Response dialog opens on a phone

- **WHEN** an administrator opens a response detail or confirmation dialog on a narrow viewport
- **THEN** the dialog fits within the viewport, its content can wrap or scroll internally, and its actions remain reachable

### Requirement: Responsive regression coverage

The project MUST include browser tests covering public and private pages at representative phone and tablet viewport sizes.

#### Scenario: Responsive checks run in CI

- **WHEN** the browser test suite runs
- **THEN** it checks page-fit invariants at 320px, 390px, and 768px widths for the relevant survey and analytics states
