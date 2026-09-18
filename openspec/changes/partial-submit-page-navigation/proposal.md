## Why

The current survey groups all non-text questions together, which makes multi-select pages heavier and keeps section-oriented navigation from showing the respondent's exact position. Respondents also need a way to submit the answers they have completed without finishing every page.

## What Changes

- Group at most two single-choice questions on one page.
- Give every multi-select question its own page; text questions remain one per page.
- Replace section navigation with a horizontally scrollable page-number navigation bar that jumps to exact pages.
- Add a `Submit now` action beside `Next page` that saves a valid partial response without requiring all current required questions.
- Keep format, option, and `Other` consistency checks for partial submissions, and let later visits load and complete the saved response.

## Capabilities

### New Capabilities

- `competition-organizer-survey`: change page construction, navigation, and partial submission behavior.
- `private-survey-analytics`: preserve existing reporting and export behavior for partially completed saved responses.

### Modified Capabilities

- None.

## Impact

- Update the shared question paging and survey rendering modules, navigation styles, and browser/unit tests.
- Change server-side answer validation so partial saves may omit required current questions while still rejecting malformed or inconsistent answers.
- Update the survey specifications and deployment migration if the database function contract requires a new partial-save mode.
