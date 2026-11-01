const { test: base, expect } = require('@playwright/test');

const confirmation = 'If an account exists for this email, you will receive a password-reset link. Check your inbox and spam folder.';

const test = base.extend({
  resetApi: [async ({ context, page, baseURL }, use) => {
    const unexpected = [], errors = [];
    const api = {
      calls: [],
      fulfill: (route, response = { json: {} }) => route.fulfill({
        headers: { 'access-control-allow-origin': new URL(baseURL).origin },
        ...response,
      }),
    };
    api.respond = (route) => api.fulfill(route);
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === new URL(baseURL).origin && request.method() === 'GET') {
        return route.continue();
      }
      if (url.origin === 'https://identitytoolkit.googleapis.com' &&
          url.pathname === '/v1/accounts:sendOobCode') {
        if (request.method() === 'OPTIONS') return route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': new URL(baseURL).origin,
            'access-control-allow-methods': 'POST',
            'access-control-allow-headers': 'content-type',
          },
        });
        if (request.method() === 'POST') {
          api.calls.push(request.postDataJSON());
          return api.respond(route);
        }
      }
      unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort();
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', async (dialog) => {
      errors.push(`Unexpected native ${dialog.type()} dialog`);
      await dialog.dismiss();
    });
    await use(api);
    expect(unexpected, 'Unexpected external traffic was blocked').toEqual([]);
    expect(errors, 'Page errors or native dialogs').toEqual([]);
  }, { auto: true }],
});

async function openRecovery(page) {
  await page.goto('/forgot_password.html');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'I forgot my password' })).toBeVisible();
}

async function attachScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

const sizes = [
  [1440, 1024], [1024, 600], [768, 1024], [428, 926],
  [390, 844], [376, 667], [375, 667], [320, 568],
];

for (const [width, height] of sizes) {
  test(`layout and assets at ${width} x ${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await openRecovery(page);
    const layout = await page.evaluate(() => {
      const edges = ({ left, right, top, bottom }) => ({ left, right, top, bottom });
      const rect = (element) => edges(element.getBoundingClientRect());
      const heading = document.querySelector('h1');
      const range = document.createRange();
      range.selectNodeContents(heading);
      return {
        viewport: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        card: rect(document.querySelector('.password-reset-card')),
        arrow: rect(document.querySelector('.password-reset-back')),
        textLines: Array.from(range.getClientRects(), edges),
        controls: ['.password-reset-help', '#password_reset_email', '#password_reset_button']
          .map((selector) => rect(document.querySelector(selector))),
        assets: Array.from(document.images, (image) => ({
          loaded: image.complete && image.naturalWidth > 0,
          url: image.currentSrc,
        })),
      };
    });
    await attachScreenshot(page, testInfo, 'initial-layout');
    expect(layout.pageWidth).toBeLessThanOrEqual(width);
    expect(layout.card.left).toBeGreaterThanOrEqual(0);
    expect(layout.card.right).toBeLessThanOrEqual(width + 1);
    for (const control of layout.controls) {
      expect(control.left).toBeGreaterThanOrEqual(layout.card.left);
      expect(control.right).toBeLessThanOrEqual(layout.card.right + 1);
    }
    for (const line of layout.textLines) {
      expect(line.left).toBeGreaterThanOrEqual(layout.card.left - 1);
      expect(line.right).toBeLessThanOrEqual(layout.card.right + 1);
      const overlaps = line.left < layout.arrow.right && line.right > layout.arrow.left &&
        line.top < layout.arrow.bottom && line.bottom > layout.arrow.top;
      expect(overlaps, 'Back arrow must not overlap heading text').toBe(false);
    }
    expect(layout.assets).toHaveLength(4);
    expect(layout.assets.every((asset) => asset.loaded)).toBe(true);
    expect(layout.assets.some((asset) => asset.url.endsWith(
      width <= 720 ? 'logo-mobile.svg' : 'logo-desktop.svg',
    ))).toBe(true);
    await page.getByRole('button', { name: 'Send me the email' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Send me the email' })).toBeInViewport();
  });
}

test('keyboard navigation reaches the links, labelled email field and submit button', async ({ page }) => {
  await openRecovery(page);
  for (const target of [
    page.getByRole('link', { name: 'JOIN home' }),
    page.getByRole('link', { name: 'Back to log in' }),
    page.getByRole('textbox', { name: 'Email address' }),
    page.getByRole('button', { name: 'Send me the email' }),
  ]) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
  }
  await expect(page.getByRole('link', { name: 'Back to log in' })).toHaveAttribute('href', 'login.html');
});

for (const email of ['', 'not-an-email', 'user@']) {
  test(`invalid email ${JSON.stringify(email)} stays local and focuses the field`, async ({ page, resetApi }, testInfo) => {
    await openRecovery(page);
    const input = page.getByRole('textbox', { name: 'Email address' });
    await input.fill(email);
    await page.getByRole('button', { name: 'Send me the email' }).click();
    await expect(page.getByRole('status')).toHaveText('Please enter a valid email address.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeFocused();
    expect(resetApi.calls).toEqual([]);
    await attachScreenshot(page, testInfo, 'validation-error');
  });
}

for (const code of [null, 'EMAIL_NOT_FOUND', 'USER_DISABLED']) {
  test(`account result ${code || 'success'} shows the same private confirmation`, async ({ page, resetApi }, testInfo) => {
    resetApi.respond = (route) => resetApi.fulfill(route, {
      status: code ? 400 : 200,
      json: code ? { error: { message: code } } : {},
    });
    await openRecovery(page);
    await page.getByRole('textbox', { name: 'Email address' }).fill(' user@example.test ');
    await page.getByRole('button', { name: 'Send me the email' }).click();
    await expect(page.getByRole('status')).toHaveText(confirmation);
    expect(resetApi.calls).toEqual([{ requestType: 'PASSWORD_RESET', email: 'user@example.test' }]);
    await expect(page.getByRole('button', { name: 'Send me the email' })).toBeDisabled();
    await attachScreenshot(page, testInfo, 'confirmation');
  });
}

test('pending and completed requests cannot be submitted twice; editing allows a new request', async ({ page, resetApi }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  resetApi.respond = async (route) => { await gate; await resetApi.fulfill(route); };
  await openRecovery(page);
  const input = page.getByRole('textbox', { name: 'Email address' });
  await input.fill('user@example.test');
  await page.getByRole('button', { name: 'Send me the email' }).click();
  try {
    await expect(page.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    await expect(input).not.toBeEditable();
    await expect.poll(() => resetApi.calls.length).toBe(1);
    await page.locator('form').evaluate((form) => form.requestSubmit());
    expect(resetApi.calls).toHaveLength(1);
  } finally {
    release();
  }
  await expect(page.getByRole('status')).toHaveText(confirmation);
  await page.locator('form').evaluate((form) => form.requestSubmit());
  expect(resetApi.calls).toHaveLength(1);
  await input.fill('another@example.test');
  await expect(page.getByRole('status')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Send me the email' })).toBeEnabled();
});

for (const failure of ['offline', 'rate-limit', 'server']) {
  test(`${failure} is visible and permits retry`, async ({ page, resetApi }, testInfo) => {
    resetApi.respond = (route) => failure === 'offline' ? route.abort('failed') : resetApi.fulfill(route, {
      status: failure === 'rate-limit' ? 429 : 500,
      json: { error: { message: failure === 'rate-limit' ? 'TOO_MANY_ATTEMPTS_TRY_LATER' : 'UNAVAILABLE' } },
    });
    await openRecovery(page);
    await page.getByRole('textbox', { name: 'Email address' }).fill('user@example.test');
    await page.getByRole('button', { name: 'Send me the email' }).click();
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('status')).not.toHaveText(confirmation);
    await expect(page.getByRole('button', { name: 'Send me the email' })).toBeEnabled();
    await expect(page.getByRole('textbox', { name: 'Email address' })).toBeEditable();
    await attachScreenshot(page, testInfo, 'request-error');
    resetApi.respond = (route) => resetApi.fulfill(route);
    await page.getByRole('button', { name: 'Send me the email' }).click();
    await expect(page.getByRole('status')).toHaveText(confirmation);
    expect(resetApi.calls).toHaveLength(2);
  });
}
