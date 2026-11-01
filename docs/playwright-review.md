# Page-by-page Playwright review

Start with `forgot_password.html`. Review its screenshots and behavior before
adding another page to the browser suite.

From the project root, with Node.js, Python 3 and the locally installed
`@playwright/test` package available:

```sh
npx playwright install chromium
npx playwright test tests/browser/forgot-password.spec.cjs
npx playwright show-report
```

The configuration starts a temporary local server on `127.0.0.1:4173` and stops
it after the tests. Live Server does not need to be running. If port 4173 is
already occupied, stop that server before starting the tests.

The recovery tests mock every reset response and block other external requests.
They send no real emails and use no real account credentials. They check eight
viewport sizes, loaded images, horizontal containment, arrow/title overlap,
keyboard navigation, validation, confirmation, duplicate submission and retry.

Open the HTML report and inspect each layout screenshot, plus confirmation and
error screenshots. A green run confirms the browser assertions; it does not
approve the visual design. Compare desktop and mobile screenshots with the
approved Figma recovery frames (`656:3794` and `664:3733`) before recording a
visual pass. Actual reset-email delivery remains a separate manual check.

Keep existing Node checks separate:

```sh
node --test tests/*.test.mjs n8n/tests/*.test.mjs
```

Local dependency manifests created during setup are not overwritten by this
change. The application and deployment ZIP do not need the browser-test files,
`node_modules`, screenshots or test reports.
