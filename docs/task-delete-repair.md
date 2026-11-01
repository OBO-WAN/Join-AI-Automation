# Task deletion and Guest mode

## Behavior

The original Board handler sent an anonymous DELETE, ignored rejected HTTP
responses and closed the detail even when the card remained. PR #28 repaired
authenticated deletion. Guest mode must support deletion and drag-and-drop for
existing shared tasks, including old numeric keys and push keys.

Guest mode uses the existing `isGuest` flag set by Guest Log in. It does not create
an anonymous Firebase Auth account or require a new provider or credential.
Signed-in users retain the existing authentication helper and token refresh.
A missing/expired login is not silently treated as a selected Guest session.

Keep the existing styled confirmation dialog. Check Firebase's acknowledgement
before removing a card, reject duplicate clicks and changed sessions, and stop
older reads from restoring deleted cards. Errors appear inline in the matching
task detail. A failed refresh after successful deletion uses the Board's inline
status message instead. There are no native alert, prompt or confirm calls in
this deletion flow. The inline message uses the existing red and font tokens.

## Firebase permission change

The requested Guest behavior makes deletion public: any visitor or unauthenticated
REST client can permanently delete existing shared tasks. Confirmation in the
frontend is a user interaction, not an authorization boundary. Visitors can delete
multiple tasks individually or through permitted multi-location updates.

Add this child rule **inside the existing `tasks` rule**, preserving its current
`.read`, parent `.write`, other child rules, and all unrelated paths:

```json
"$taskId": {
  ".write": "data.exists() && !newData.exists()",
  "status": {
    ".write": "data.parent().exists() && newData.isString() && newData.val().matches(/^(triage|toDo|inProgress|awaitFeedback|done)$/)"
  },
  "statusChangedAt": {
    ".write": "data.parent().exists() && newData.isString()"
  }
}
```

If `$taskId` already exists, review its current write condition before merging
these grants. Guests can remove an existing whole task or PATCH only its status
and status-change timestamp. Valid statuses match the five Board columns.
Creating or replacing tasks, editing their other fields, deleting subtasks, and
accessing contacts, profiles, usage, colors or membership remain ungranted.
Existing parent rules still control creation and editing for signed-in users.

The repository Rules include this small grant. **Do not replace the live Rules
wholesale with that file:** the previously observed live permissions differ from
the repository's editor-role baseline. Apply only the reviewed child grant to
the current published `tasks` block. No expiration condition is introduced.
Frontend changes alone cannot enable Guest deletion under the old live Rules.
The drag-permission correction changes only Rules and tests: no drag JavaScript,
new frontend dependency, ZIP rebuild or frontend deployment is needed for it.

Publish the reviewed task child rule, then deploy Board HTML, `board_actions.js`,
`board_templates.js` and `style/board_actions.css` together. The normal frontend
ZIP command includes them. Validate with a disposable task; no live task or live
Rules were changed during implementation. Removing the public child grant revokes
this extra permission; reverting frontend files alone does not revoke it.

## Verification

`node --test tests/*.test.mjs n8n/tests/*.test.mjs` passes 202 checks, including
Guest legacy-key deletion, cancellation, session changes, denied writes and inline
feedback. Tests fail if the deletion handler calls a native browser alert.
JavaScript syntax and diff whitespace checks pass. New code files are below
400 lines. No new browser visual pass is claimed for the inline error state.

An additional 64 actual RTDB emulator checks pass using emulator 4.11.2 and a
disposable `demo-join-guest-delete` namespace. They verify deletion and denial of
other guest operations under both an editor-role parent rule and an
`auth != null` task-write parent rule. Mocked signed-in editor/member requests
verify that the existing parent policies retain their behavior. The suite also
executes the actual `moveTo()` handler against the emulator: the earlier
deletion-only policy rejects its PATCH and restores the old column; the corrected
policy persists the move, retains other fields, and still permits deletion.

Run the emulator on loopback port 9001, then run:

```sh
node --test firebase/tests/guest-task-delete.emulator.test.mjs
```

That suite is fixed to `http://127.0.0.1:9001` and the demo namespace. It installs
test Rules and resets only demo fixtures. It never addresses production Firebase.
