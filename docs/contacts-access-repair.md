# Contacts access repair

## Confirmed cause

The Contacts page reads and rewrites contacts in the old `joinstorage-ef266`
Firebase project without authentication. Board and Add Task read contacts in
`join-ai-automation`. They attempt this even for guests, although the current
database requires authentication.

The user's signed-in production check on 2026-10-26 returned HTTP 200 and an
array of 23 contacts from the current project. This confirms that the current
database already contains contacts and that the user's authenticated read works.
The old project's anonymous shallow read also returned 23 keys. Equal counts
do not establish identical content; this repair does not migrate or delete data
from either project.

## Change

- The Contacts page uses the existing Firebase Authentication session and the
  current project's `/contacts` path, matching Board and Add Task.
- Rendering can sort contacts without changing their Firebase keys. Record keys
  stay in a Symbol property, which JSON serialization excludes.
- Existing records are updated with PATCH at their original key, new records use
  POST to obtain a new Firebase key, and deletion addresses only that record.
  Existing IDs and additional fields survive editing; no whole-list PUT remains.
- A successful creation can make Firebase return a keyed object rather than an
  array. The assignee loader accepts both forms and skips null entries.
- Writes complete before the visible list changes or a form closes. Failures
  remain visible, and overlapping writes are ignored while one is pending.
- Guest Board startup skips private contacts. The Contacts page displays a login
  message without sending an anonymous request. Responses from a previous session
  are rejected.

No Firebase Rules, accounts, membership, n8n configuration, existing task
assignments, AGENTS.md or page styles are changed. Concurrent edits to the same
contact still use Firebase's normal last-write-wins behavior; this is not a
transaction or multi-user merge system.

## Verification and release

Run `node --test tests/*.test.mjs n8n/tests/*.test.mjs` from the repository root.
The 16 new mocked checks exercise authenticated requests, preserved keys and
fields after sorting, record-specific create/edit/delete, denied writes,
guest access, session changes, duplicate submissions and both collection shapes.
The prior 140 checks remain in the full suite.

No live contact was created, edited or deleted during implementation. Browser
interaction against the deployed repair is not yet verified. No layout or CSS
change is included, and no new visual pass is claimed.

Deploy the changed frontend files together, including `script/contacts_data.js`
and the versioned script references in Contacts, Board and Add Task. Preserve the
working Firebase Rules and n8n workflows. Avoid restoring the old Contacts page
for editing after rollout: it writes to the old project.
