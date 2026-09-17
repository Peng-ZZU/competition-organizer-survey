## Why

The survey and analytics pages are usable on desktop but some narrow screens can still produce clipped controls, cramped action rows, or horizontal overflow. Mobile respondents need every question, navigation control, and submission action to remain visible and usable without zooming or sideways page scrolling.

## What Changes

- Add a responsive layout contract for public survey and private analytics pages across phone, tablet, and desktop widths.
- Tighten narrow-screen spacing, typography, control sizing, wrapping, and dialog behavior in the shared stylesheet.
- Add browser coverage at representative 320px, 390px, and 768px viewports for page fit and key interactions.

## Capabilities

### New Capabilities

- `responsive-mobile-layout`: Responsive presentation and interaction behavior for survey and analytics interfaces.

### Modified Capabilities

None.

## Impact

- `assets/css/app.css` shared page layout and component styles.
- Existing Playwright browser tests, with focused viewport assertions added.
- No API, database, or dependency changes.
