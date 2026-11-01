# JOIN Project Working Instructions

## Project and source of truth

- Repository: `OBO-WAN/Join-AI-Automation`.
- Stack: vanilla HTML, CSS and JavaScript; Firebase Realtime Database and Authentication; existing n8n workflows.
- Production frontend: `https://join.naranjo.io/`.
- Owner's local repository: `/mnt/PROJECTS/join-aI-automation`.
- Use the actual Live Server URL shown by the owner; do not assume a port or a `~/` repository path.

Inspect the current branch, working tree and requested component before editing.
Preserve local-only changes. Do not assume `main`, an old audit branch, or a merged PR
matches the owner's local files or deployed website. Verify the relevant source.

## Scope and simplicity

Repair the existing application, one clearly defined issue at a time. The latest
user request defines the scope; this document is not a backlog or authorization
for additional work. There is no permanent restriction to one old audit target.

- Make the smallest change that fixes the demonstrated cause and preserves working behavior.
- Prefer existing functions, styles, assets, services and credentials.
- Avoid speculative features, new dependencies, services, accounts and abstractions.
- Add a helper or file only when it has a clear responsibility necessary for the fix.
- Keep new code files at or below 400 lines, including tests. Avoid growing oversized files.
- Do not minify, compress, or split code arbitrarily to meet the line limit.
- Keep code readable, plainly named and easy for a person to maintain.
- Do not run broad formatters, reformat unrelated code, or clean accumulated diffs.
- Do not fix unrelated visual differences while repairing a functional issue.
- Do not introduce Google Cloud setup, billing changes or replacement credentials when existing services suffice.

When the user corrects the scope or expected behavior, incorporate that correction.
Do not defend an implementation by treating its previous tests as the product requirement.

## Functional behavior to preserve

### Board and Guest mode

Guest mode must support reading the Board, moving existing cards between columns,
and deleting existing cards after the application's confirmation. This includes
old numeric Firebase keys and newer push keys. Do not silently require member
login for these agreed Guest operations when repairing another action.

Test Guest moving and deletion together whenever either flow or task permissions
change. Verify persistence after refresh and preservation of unrelated task data.
Other Guest permissions must not be expanded without a user request.

Use Firebase keys as record identities. Do not renumber or replace records because
their displayed order changes. A failed write must not appear successful or remove
a record from the UI. Preserve the user's work and show a useful failure message.

### Login and profiles

Use the existing Firebase Authentication setup. A database-only legacy profile is
not automatically an Authentication account. Do not migrate or delete old users
unless requested. Load signed-in profiles by the authenticated UID, preserve
existing profiles, and distinguish a missing profile from a failed read.

Do not label a signed-in user as Guest because profile loading failed. Preserve
working signup, profile completion, logout, refresh and password-recovery behavior.
Never store passwords in database profiles or ask the owner to share passwords,
private keys or tokens in chat.

### Contacts and automation

Contacts and task assignees use the current `join-ai-automation` database and the
existing authenticated access helper. Preserve record keys, IDs and extra fields.
Do not switch to the old `joinstorage-ef266` project or migrate data without review.

Keep working intake and task-status notification workflows intact. Change n8n only
when the current user request requires it. Inspect a current server export before
modifying a workflow; repository exports may be older than the repaired server.
Reuse its tested credentials. Do not reimport stale workflow JSON over live repairs.

## No native browser prompts

Do not introduce or reintroduce `window.alert()`, `window.prompt()` or
`window.confirm()`, including their unqualified equivalents. Use existing styled
application dialogs for confirmation and inline feedback for errors and status.
Replace a legacy native prompt when its flow is part of the requested repair;
do not sweep unrelated files. Keep errors visible, accessible and actionable.

## Firebase Rules and deployment

The frontend and published Firebase Rules must support the same requested flow.
Mocked frontend success alone does not establish that the live Rules permit it.

- Inspect the current published Rules before giving an exact production edit.
- Preserve unrelated paths and existing permissions. Do not replace live Rules wholesale with a different repository baseline.
- Scope Guest grants to the agreed operations; do not solve access errors with a blanket public write grant.
- Do not add expiry-based production access or Firebase test-mode deadlines.
- Explain the concrete effect of a permission change without inventing unrelated approval steps.
- Validate complete JSON, braces, commas and rule expressions before instructing publication.
- Name the exact editor block to replace and the button to click; avoid ambiguous paste instructions.

Rules publication, a Git merge and the webhost's frontend upload are separate
operations. Merging `main` can deploy GitHub Pages, but does not prove that
`join.naranjo.io` has been updated. Check the served files and their dependencies.
Deploy dependent HTML, scripts, styles and assets together.

Live Server runs the frontend locally but normally still uses the real Firebase
database and n8n webhook. It is not an isolated test database. Do not widen CORS
or change the working notification workflow merely to silence a localhost error.
Do not delete or alter existing live records as tests without explicit authorization.
Prefer disposable fixtures or an isolated emulator.

## Figma and visual changes

Use Figma for layout changes. The accessible working copy is:
`EMBwAKhDSmvSo2yK01icHh`.
The earlier reference file is `5SSnHSwyhXfyyJFlrNGCpH`.

Inspect the exact node and existing implementation first. If the required design
cannot be retrieved, ask for a specific node rather than inventing a redesign.
Reuse existing assets and tokens. Do not overwrite a shared icon to fix one screen.

Existing task-detail references:
- Desktop task detail: `75609:16287`.
- Mobile task detail: `75918:13940`.
- Mobile Creator: `350531:10318`.
- Mobile header/category/AI indicator: `350526:9770`.
- Assigned To full-name reference: `75918:13955` (exception below).

Preserve these explicit product decisions and responsive exceptions:
- Assigned To uses compact avatar circles with initials, colors and overflow on desktop and mobile; do not implement the full-name row layout.
- Desktop task overlay: width 525px, padding 48px 40px, radius 30px, white background, shadow `0 0 4px rgba(0,0,0,.16)`.
- Desktop description: 24px after title, 24px before Creator, Inter 20px/24px.
- Desktop Creator remains a compact row with label, badge, identity and action.
- Mobile Creator above 390px uses the approved two-row grid.
- At 390px and below, preserve the three-row exception: badge, Creator/identity, then the E-mail action aligned to the start of its own row.
- Preserve viewport containment and internal scrolling on short mobile task sheets.
- For the mobile AI header below 768px, preserve the approved badge padding `4px 16px`, radius 8px, 8px gaps, 22px wand, Inter 16px text and `#9327FF` to `#2EA1DC` gradient.

For a visual audit, inspect one agreed component, make a focused change and review
its rendered result before moving to another component. Run Playwright and capture
screenshots when available. Rendered screenshots decide a visual pass; computed
CSS or passing functional tests alone do not. If rendering is blocked, state what
remains unverified. Do not claim visual approval or bypass browser security policy.

## Verification

Choose checks that exercise the actual failure and requested behavior. Test
rejected requests as well as success, both Guest and signed-in paths when relevant,
and the interaction between related actions. Do not add tests that merely mirror
implementation or require unrelated infrastructure for a minor edit.

Application checks:
```sh
node --test tests/*.test.mjs n8n/tests/*.test.mjs
```

Permission checks, with the isolated RTDB emulator running on loopback port 9001:
```sh
node --test firebase/tests/guest-task-delete.emulator.test.mjs
```

Keep emulator requests in their disposable `demo-` namespace. Never fall back to
production when the emulator is unavailable. Reproduce a Rules failure with the
actual request or handler when practical, then verify the correction.

Report separately: automated checks, emulator results, rendered evidence, deployed
file verification, and user-confirmed live behavior. Do not claim a live test or
email receipt that did not occur. Do not ask the owner to repeat an already
confirmed check unless a new change or specific unresolved failure requires it.

## Git and communication

Respect authorization already given in the session for branches, commits, pushes
and PRs; do not repeatedly request the same permission. Without authorization,
prepare reviewable changes first. Never merge or publish production changes without
the required user authorization. Do not reset, clean, force-push or broadly revert
the owner's working tree.

Coordinate ownership before editing files also being changed locally. Prefer an
isolated branch/worktree, preserve unrelated changes and keep PRs focused.

Give short, precise instructions naming the page, node, field, button or file.
Lead with the cause and concrete next action. Explain what changed, why, what was
tested and what remains uncertain. Acknowledge mistakes plainly and correct them;
do not add another layer of code in place of checking the actual cause.
