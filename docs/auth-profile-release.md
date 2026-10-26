# JOIN login and profile release

## Result

New signup creates a Firebase Authentication account and its JOIN profile under
the same UID. Success is shown only after the profile write is acknowledged.
Normal login loads the authenticated user's name and initials. A confirmed
missing profile asks for name and privacy consent using the existing account;
it does not create another Authentication account. Read failures offer retry.

Logout clears stored credentials and identity. Older asynchronous responses
cannot restore a logged-out session or replace a newer account.

The profile completion heading is `Profile`, retaining the signup header layout
and avoiding the longer `Complete profile` copy that overlapped its back arrow.
The revised copy still needs rendered mobile inspection; no new visual pass is
claimed. Existing browser verification of the previous combined stack and the
user's successful local login/initials check remain recorded in PR #24 and the
conversation respectively. No repeat login check is required from the user.

## Release source and scope

- Main baseline: `c99aa92212c8abdb4c038efd6c9bee1c97e6f1ea`.
- Combined auth stack: `0a2aa98f1c75faaf16730ccaa80a3c13723ffd65`.
- Prepared local branch: `release/auth-profile-repair`.
- Follow-up changes: shorter profile heading and test harness extraction/split
  so each new code file stays below 400 lines. Test bodies are preserved.
- No old-user migration or deletion. No Firebase Rules, n8n, Contacts migration,
  credentials, or hosting configuration changes belong in this release.

## Validation

Run from the repository root:

```sh
node --test tests/*.test.mjs n8n/tests/*.test.mjs
git diff --check
```

The combined stack contains 140 Node checks: signup, profile recovery, session
lifecycle, and the existing six intake concurrency checks. Firebase requests in
the frontend tests are mocked. These are not live signup or email tests.

The repaired production n8n workflows were verified separately. Do not import
the older workflow JSON in this frontend branch over those working workflows.

## Integration and deployment

Prepare one PR from this release branch into `main`, containing the final combined
tree. Supersede drafts #22, #23 and #24 after the combined release is integrated;
do not merge their intermediate states into main individually.

Commit, push, merge and production deployment require explicit authorization per
AGENTS.md. Merging main can publish GitHub Pages. The separately hosted
`join.naranjo.io` frontend requires its own deployment; a main merge alone is not
evidence that this production domain has been updated.

Deploy the complete frontend together, including the new `firebase_profile.js`
and `auth_status.css` dependencies and the changed HTML script references.
Keep a copy of the deployed frontend before replacing files. Preserve the live
Firebase data, current non-expiring Rules and repaired n8n configuration.

After deployment, inspect the delivered script versions and the normal Summary
greeting. Record deployment evidence separately from local verification.

## Rollback

Restore the previous frontend files together. Preserve Authentication accounts
and database profiles created while the new frontend was active. Rollback does
not require deleting users, changing Rules or restoring old n8n workflows.
