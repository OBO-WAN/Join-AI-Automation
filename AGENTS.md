# Join Kanban UI Audit Instructions

The CURRENT implementation state on the active audit branch is the source of truth for code review and cloud-side work. Do not assume `main` reflects the implementation being audited.

For local verification, the developer's CURRENT LOCAL WORKING TREE remains authoritative. Preserve local-only changes and never reset or clean broadly to match GitHub.

## Project

- Repository: `OBO-WAN/Join-AI-Automation`
- Audit branch: `join-ui-audit-wip`
- Stack: Vanilla HTML / CSS / JavaScript
- Local repo used by the developer: `~/join-aI-automation`

## Figma source of truth

File key:
`5SSnHSwyhXfyyJFlrNGCpH`

Relevant task-detail nodes:
- Main desktop task-detail: `75609:16287`
- Main mobile task-detail: `75918:13940`
- Mobile Creator: `350531:10318`
- Mobile header/category + AI-generated indicator: `350526:9770`
- Assigned To full-name mobile rows: `75918:13955`

### Product exception: Assigned To

Do NOT implement the Assigned To full-name row layout from `75918:13955` or its desktop equivalent.

Assigned To intentionally uses compact avatar circles with the existing initials/color/+N behavior on BOTH desktop and mobile.

This product decision overrides Figma only for Assigned To. For everything else, Figma remains the visual source of truth.

## Component-by-component workflow

For EVERY audited UI component:

1. Inspect the exact Figma node first.
2. Inspect the current implementation before editing.
3. Explain the exact mismatch before making changes.
4. Make the smallest possible change.
5. Prefer CSS-only when appropriate.
6. Preserve mobile/desktop behavior outside the targeted breakpoint/component.
7. Run Playwright after the change when working locally.
8. Capture rendered screenshot(s).
9. Treat rendered screenshots as deciding evidence; computed CSS alone is not sufficient.
10. Report exact measurements and exact files changed.
11. STOP for review before moving to another component.

Do not automatically continue to the next component.

Do not declare PASS unless the rendered screenshot actually matches the intended design.

## Current audit target

ONLY audit/fix:

**Mobile task-detail header/category + AI-generated indicator below 768px**

Figma node:
`350526:9770`

This component contains:

`[Technical Task] [wand icon] Ai-generated ticket`

Target details:
- category badge
- 8px gap to AI-generated note
- wand icon 22x22
- 8px wand-to-text gap
- AI-generated text Inter 16px
- AI-generated gradient `#9327FF` -> `#2EA1DC`
- category label Inter 16px
- category padding `4px 16px`
- category radius `8px`

Do NOT touch another component in the same step.

Do NOT move on to title, description, Creator, dates, Assigned To, Subtasks, or actions until this component is reviewed.

## Approved / intentional behavior to preserve

### Desktop overlay
- width 525px
- padding 48px 40px
- radius 30px
- white background
- shadow `0 0 4px rgba(0,0,0,.16)`

### Desktop description
- 24px title -> description
- 24px description -> Creator
- Inter 20px / 24px

### Desktop Creator
- compact horizontal row
- `Creator:`
- badge
- identity
- action right aligned

### Mobile Creator
Reference node: `350531:10318`

At widths >390px:
- Figma-style 2-row Creator grid
- badge above Creator label
- identity and E-mail on lower row

At widths <=390px, preserve the intentional responsive exception:
- badge row
- Creator + identity row
- E-mail action moves to its own third row
- action begins at the START of row 3
- this prevents real email addresses colliding with the E-mail action

Do NOT revert this responsive exception.

### Assigned To
- compact avatars on desktop AND mobile
- preserve existing initials/color/+N logic

### Short mobile viewport containment
The mobile task sheet uses viewport containment/internal scrolling when content exceeds available height.

Do NOT revert this.

## Current test data

Primary task:
- title: `Wiring test`
- external / AI-generated
- `source.aiGenerated === true`
- description: `Perform a wiring test as requested in the subject line.`
- Creator: external email

Secondary task:
- title: `Manual creator test 2`
- internal/manual
- `source.aiGenerated === false`

Use both when needed to verify that AI-generated UI is conditional.

## Local Playwright verification

Temporary local Playwright environment:
`/tmp/join-pw-verify/`

Verification script:
`/tmp/join-pw-verify/verify-creator.mjs`

System Chromium:
`/snap/bin/chromium`

Local board URL:
`http://127.0.0.1:5501/board.html`

The local Playwright setup is temporary and must NOT be added to Git.

Rendered screenshots are the final confirmation evidence.

## Git and cleanliness rules

Do NOT unless explicitly requested:
- commit further changes
- push further changes
- merge to `main`
- reset
- clean the working tree
- broadly revert accumulated work

Do NOT:
- run Prettier
- reformat unrelated code
- clean accumulated diff
- touch unrelated files
- touch n8n
- publish/export n8n

Known implementation files may include:
- `script/add_task_data.js`
- `script/board.js`
- `script/board_templates.js`
- `style/board_taskoverlay.css`
- task-overlay assets under `assets/icons/`

`script/board.js` contains unrelated formatting churn from earlier edits. Do NOT reformat it.

When a component can be fixed without touching `board.js`, prefer not to touch it.

## Collaboration rule

When cloud-side and local-side work happen concurrently, avoid editing the same file at the same time. Reading, reviewing, and running Playwright in parallel is fine.

Before editing a shared file, inspect the latest branch state first and coordinate ownership of that component/file.
