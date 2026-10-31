# Task deletion repair

## Confirmed defect

The deployed `board.js` matches main at
`8efbd11c3f00286cb142c82832abb3071b982915`. Its Delete handler sends a raw
unauthenticated fetch and never checks `response.ok`. After a denied response it
reloads the unchanged tasks and closes the detail, leaving the task undeleted.

A reproduction executing that exact old function with a mocked HTTP 401 confirms
all three behaviors: anonymous DELETE, reload despite denial, and overlay closure
despite denial. No live delete request was sent.

## Repair

Use the existing authenticated Firebase helper and require a current login.
Preserve the existing confirmation dialog. Guard the complete operation against
duplicate clicks and reject a changed session before sending a confirmed delete.
Validate and encode the Firebase key so the request can address only one task.

Reject failed HTTP responses. A failure keeps the card and detail available and
shows an alert; the old toast path could silently do nothing when the Board has
no toast container. A successful acknowledgement removes only that task locally,
invalidates older reads and refreshes the Board. Closing the deleted detail is
limited to the matching task, so a different newly opened detail stays open.
If the refresh fails after the delete succeeded, report that distinction and
keep the deleted card removed.

The handler and existing Escape action move to `script/board_actions.js` (65
lines), keeping `board.js` at 397 lines without reformatting its unrelated code.
Board HTML loads the new helper and versions both changed scripts. No template,
CSS, confirmation design, Firebase Rules, n8n workflow or account change is made.

## Verification and release

`node --test tests/*.test.mjs n8n/tests/*.test.mjs` passes 175 checks: the previous
156 plus 19 deletion cases. Tests load the real Board script order and exercise
the actual confirmation handlers with mocked DOM events and network requests.
They cover cancel, guest access, authenticated success, 401/403/500/offline errors,
duplicate clicks, session changes, token refresh, failed follow-up reads, another
open task, stale reads and invalid keys. Syntax and diff whitespace checks pass.
An isolated combined-source check with the password-recovery PR also passes all
193 checks. Neither PR has to include the other's changes.

No live task was deleted or modified during implementation. Browser interaction
with the deployed repair remains to be verified after rollout. Use only the
user-created `JOIN Repair Test` task for that check, then refresh to verify its
removal. Existing task creation, assignment and drag-and-drop were confirmed by
the user before reporting this deletion defect.

This PR is independent of password recovery (#27) and contains none of its files.
Deploy the changed Board files together, including `board_actions.js`. Reverting
the frontend cannot restore an intentionally deleted task; task data restoration
would require an existing backup.
