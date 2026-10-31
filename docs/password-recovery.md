# Forgotten password

## User flow

Both the welcome page (`index.html`, below Member log in) and the login form
link to `forgot_password.html` with “Forgot your password?”. The form accepts
an email address and requests a password-reset email from the existing
`join-ai-automation` Firebase Authentication project. No login is required.

The email's link opens Firebase's existing password-reset handler. The user
chooses their new password there, then returns to JOIN's login page. This change
does not implement or store passwords, recovery codes, or a custom action-code
handler. It needs no new credential, SMTP configuration, SDK, or backend service.

The REST request follows the [Firebase Auth REST reference](https://firebase.google.com/docs/reference/rest/auth#section-send-password-reset-email):
POST `accounts:sendOobCode`, JSON `requestType: PASSWORD_RESET` and `email`, using
the current public Firebase web API key. Firebase's existing email template and
action handler settings remain unchanged. No continue URL/domain change is used.

## Behavior

- Trim and validate the email before sending. Show invalid-input feedback and
  focus the field. Submission works from the keyboard.
- Keep confirmation identical for existing, unknown and disabled accounts;
  Firebase can also return an empty successful response when enumeration
  protection is enabled. The UI does not disclose account existence.
- Reject duplicate submissions while pending and after the current request is
  confirmed. Editing the email enables a new explicit request.
- Show rate-limit, network and service errors without claiming delivery. An
  ambiguous response asks the user to check their inbox before retrying.
- Reset requests do not create users, sign in, read private profiles or change
  the stored session. Actual passwords are changed only through the email link.

## Design and verification

Reference file: `EMBwAKhDSmvSo2yK01icHh`.
Desktop email-request screen: `656:3794`; mobile: `664:3733`.
High-fidelity contexts supply the card, header, text, controls, logo, mail icon,
back arrow and accent. Their original SVGs are downloaded into project assets.
The supplied Figma frames are hidden, and exports returned blank thumbnails;
the implementation uses their available layout/context, not a screenshot asset.

The recovery entry points are the requested extension to the existing welcome
and login flow. The new page follows the desktop/mobile email-request layouts,
with narrower-screen typography and scrolling for short login viewports.

Run `node --test tests/*.test.mjs n8n/tests/*.test.mjs`: 174 checks pass, including
18 new recovery checks. These execute the actual reset page's script order and
mock every request; no real email is sent. JavaScript syntax, local references,
downloaded SVG metadata, file sizes and diff whitespace are checked separately.

Browser visual verification remains pending. Playwright's browser download
returned a truncated archive. The cloud browser could not reach the development
server and explicitly blocked local-file navigation. No workaround was attempted
after that policy rejection. Do not interpret automated checks as a visual pass.

## Release

Deploy the frontend together, including `forgot_password.html`,
`script/password_reset.js`, `style/password_reset.css`, and the new assets.
The existing frontend ZIP command includes these paths. AGENTS.md, Firebase
rules, database records, n8n workflows and the existing auth helpers are unchanged.

Before release, inspect welcome, login and recovery at desktop, 428 px and
320 px, including invalid-input and confirmation states. After deployment, use
an email address you control to verify receipt and complete the password change
yourself. Actual email delivery and the new-password step are not yet verified
for this new frontend flow. No automatic merge or production deployment is done.
