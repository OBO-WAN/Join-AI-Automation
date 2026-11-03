# Summary: heading, metrics and greeting audit

This review covers `.titeljoin` and `.details` in `summary.html`. The application
is unchanged. The current `Join 456` heading is preserved; no copy or layout is
silently replaced with a different Figma version.

Run from the project root after pulling the tests:

```sh
npx playwright test --config=playwright.config.cjs tests/browser/summary.spec.cjs
npx playwright show-report
```

Use the existing locally installed Playwright/Chromium and Python 3 setup. The
configuration starts a temporary local server on port 4173. All task/profile reads
are mocked and other external requests are blocked. No real account or database
write is involved. Test auth tokens are fake and work only with these mocks.

The fixed dataset has seven tasks: two To-Do, one Done, three Urgent, one In
Progress, two Awaiting Feedback, and three email-origin tasks. Triage counts in
the Board total; the email count includes Done email requests. The clock and
locale are fixed, so numbers and greetings do not change with the live database.

Inspect `summary-layout` attachments at 1440 × 1024, 1429 × 813 and 428 × 926
first. Desktop member screenshots use the long name from the scrollbar report.
Smaller sizes, Guest, empty data, profile failures and the mobile introduction
are also checked. Use the existing Figma desktop Summary node `45:2195` and
mobile node `332:1588` for the visual comparison.

The current suite has 33 checks, including actual Tab traversal and Enter/Space
activation of the four existing metric groups. A `keyboard-focus` screenshot
records the reused focus outline.

## Findings from the initial audit

These describe the original baseline. Subsequent focused repairs address them;
use the current full browser run to verify the combined result.

- `updateDate()` shows today under “Upcoming Deadline”; the isolated test task
  is due November 9 while the fixed current day is November 2.
- A failed initial task read logs an error and leaves hardcoded sample totals
  visible. The error check requires unavailable data not to look like live totals.
- The To-Do/Done, urgency and task metric groups have mouse click handlers but
  are not keyboard reachable. The email metric is already a real link.

These checks are not marked as expected failures or skipped. A red result for
them identifies an application issue to repair after reviewing the evidence.
Layout failures may reveal additional problems. Do not interpret a green count
or a screenshot attachment alone as Figma approval. Keep the existing recovery
suite separate; it has already passed its 19 checks and desktop/mobile review.
