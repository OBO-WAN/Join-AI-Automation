const { test: base, expect } = require('@playwright/test');

const databaseHost = 'join-ai-automation-default-rtdb.europe-west1.firebasedatabase.app';
const metricSelectors = '.summarynmb, .urgentnmb, .summary-email-count, .tasknmb';
const tasks = {
  '-todo-email': { status: 'toDo', priority: 'Urgent', dueDate: '09-11-2026', source: { type: 'email' } },
  '7': { status: 'toDo', priority: 'medium', dueDate: '10-11-2026' },
  '-done-email': { status: 'done', priority: 'low', source: { type: 'email' } },
  '-progress': { status: 'inProgress', priority: 'urgent', dueDate: '12-11-2026' },
  '-feedback-email': { status: 'awaitFeedback', priority: 'URGENT', dueDate: '14-11-2026', source: { type: 'email' } },
  '-feedback': { status: 'awaitFeedback', priority: 'low' },
  '-triage': { status: 'triage', priority: 'medium', source: { type: 'manual' } },
};

const test = base.extend({
  summaryApi: [async ({ context, page, baseURL }, use) => {
    const blocked = [], errors = [];
    const api = {
      tasks: structuredClone(tasks), taskStatus: 200, taskReads: 0, profileReads: 0,
      profile: { firstname: 'Francisco', lastname: 'Naranjo', initials: 'FN' },
      profileStatus: 200,
    };
    await page.clock.setFixedTime(new Date('2026-11-02T13:00:00Z'));
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === new URL(baseURL).origin && request.method() === 'GET') return route.continue();
      if (url.hostname === databaseHost && request.method() === 'GET') {
        const path = url.pathname.replace(/\/{2,}/g, '/');
        const headers = { 'access-control-allow-origin': new URL(baseURL).origin };
        if (path === '/tasks.json') {
          api.taskReads++;
          return route.fulfill({ status: api.taskStatus, headers,
            json: api.taskStatus === 200 ? api.tasks : { error: 'Unavailable' } });
        }
        if (path === '/user/summary-test-user.json' && url.searchParams.get('auth') === 'fake-summary-token') {
          api.profileReads++;
          return route.fulfill({ status: api.profileStatus, headers,
            json: api.profileStatus === 200 ? api.profile : { error: 'Unavailable' } });
        }
      }
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort();
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', async (dialog) => {
      errors.push(`Unexpected native ${dialog.type()} dialog`);
      await dialog.dismiss();
    });
    await use(api);
    expect(blocked, 'Unexpected external requests were blocked').toEqual([]);
    expect(errors, 'Page errors or native dialogs').toEqual([]);
  }, { auto: true }],
});

test.use({ locale: 'en-US', timezoneId: 'America/Santiago' });

async function openSummary(page, { member = false, intro = false } = {}) {
  await page.addInitScript(({ member, intro }) => {
    if (!intro) sessionStorage.setItem('animationShownSummary', 'true');
    if (member) localStorage.setItem('joinFirebaseAuth', JSON.stringify({
      localId: 'summary-test-user', email: 'member@example.test', idToken: 'fake-summary-token',
      refreshToken: 'fake-summary-refresh', expiresAt: Date.now() + 3600_000,
    }));
    else localStorage.setItem('isGuest', 'true');
  }, { member, intro });
  await page.goto('/summary.html');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.titeljoin h1')).toBeVisible();
}

async function expectStats(page, values = ['2', '1', '3', '3', '7', '1', '2']) {
  await expect(page.locator(metricSelectors)).toHaveText(values);
}

async function screenshot(page, testInfo, name) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

const memberSizes = [[1440, 1024], [1429, 813], [1024, 768], [768, 1024],
  [428, 926], [390, 844], [375, 667], [320, 568]];
const layouts = [
  ...memberSizes.map(([width, height]) => ({ width, height, member: true })),
  { width: 1440, height: 1024, member: false },
  { width: 428, height: 926, member: false },
];

for (const { width, height, member } of layouts) {
  test(`${member ? 'member' : 'Guest'} heading and metrics at ${width} x ${height}`, async ({ page, summaryApi }, testInfo) => {
    await page.setViewportSize({ width, height });
    await openSummary(page, { member });
    await expectStats(page);
    await expect(page.locator('.name').last()).toHaveText(member ? 'Francisco Naranjo' : 'guest');
    await expect(page.locator('.good').last()).toHaveText('Good Morning,');
    const geometry = await page.evaluate(() => {
      const bounds = (element) => {
        const { left, right, top, bottom } = element.getBoundingClientRect();
        return { left, right, top, bottom };
      };
      const visible = (element) => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
      const selectors = '.titeljoin, .titeljoin h1, .titeljoin p, .titeljoin .vector, .content-details, .pencil, .urgent, .summary-email-requests, .undertask, .goodmorning';
      const text = '.titeljoin h1, .titeljoin p, .date, .underdate, .summary-email-label, .summarymission, .tasktext, .goodmorning .name';
      const main = document.querySelector('.main-summary');
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOverflow: main.scrollWidth - main.clientWidth,
        elements: Array.from(document.querySelectorAll(selectors)).filter(visible)
          .map((element) => ({ name: element.className || element.tagName, ...bounds(element) })),
        cards: Array.from(document.querySelectorAll('.pencil, .urgent, .summary-email-requests, .undertask'), bounds),
        clippedText: Array.from(document.querySelectorAll(text)).filter(visible)
          .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
          .map((element) => element.className),
        imagesLoaded: Array.from(document.querySelectorAll('.details img'))
          .every((image) => image.complete && image.naturalWidth > 0),
        greeting: getComputedStyle(document.querySelector('.goodmorning')).display,
      };
    });
    await screenshot(page, testInfo, 'summary-layout');
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
    expect(geometry.mainOverflow, 'Summary must not have a horizontal scrollbar').toBeLessThanOrEqual(1);
    expect(geometry.clippedText, 'Heading, date, metric labels and member name must fit').toEqual([]);
    for (const element of geometry.elements) {
      expect(element.left, `${element.name} starts outside the viewport`).toBeGreaterThanOrEqual(-1);
      expect(element.right, `${element.name} ends outside the viewport`).toBeLessThanOrEqual(width + 1);
    }
    for (let first = 0; first < geometry.cards.length; first++) {
      for (const second of geometry.cards.slice(first + 1)) {
        const card = geometry.cards[first];
        const overlaps = card.left < second.right - 1 && card.right > second.left + 1 &&
          card.top < second.bottom - 1 && card.bottom > second.top + 1;
        expect(overlaps, 'Metric cards must not overlap').toBe(false);
      }
    }
    expect(geometry.imagesLoaded).toBe(true);
    expect(geometry.greeting === 'none').toBe(width <= 768);
    expect(summaryApi.profileReads).toBe(member ? 1 : 0);
  });
}

test('numeric-key arrays and empty slots produce the same totals as keyed tasks', async ({ page, summaryApi }) => {
  summaryApi.tasks = [null, ...Object.values(tasks), null];
  await openSummary(page);
  await expectStats(page);
});

test('an empty Board displays seven zero counts', async ({ page, summaryApi }) => {
  summaryApi.tasks = null;
  await openSummary(page);
  await expectStats(page, ['0', '0', '0', '0', '0', '0', '0']);
});

test('Upcoming Deadline comes from the urgent task, not the current day', async ({ page, summaryApi }, testInfo) => {
  summaryApi.tasks = { onlyTask: { status: 'toDo', priority: 'urgent', dueDate: '09-11-2026' } };
  await openSummary(page);
  await expectStats(page, ['1', '0', '1', '0', '1', '0', '0']);
  await screenshot(page, testInfo, 'deadline-audit');
  await expect(page.locator('.date')).toHaveText('November 9, 2026');
});

test('an initial failed task read does not leave sample counts looking like live data', async ({ page, summaryApi }, testInfo) => {
  summaryApi.taskStatus = 500;
  await openSummary(page);
  await expect.poll(() => summaryApi.taskReads).toBeGreaterThan(0);
  await screenshot(page, testInfo, 'task-read-error');
  await expect.poll(() => page.locator(metricSelectors).evaluateAll((elements) => elements
    .filter((element) => element.getClientRects().length && /^\d+$/.test(element.textContent.trim()))
    .map((element) => element.textContent.trim())), 'Unavailable task data must not look like valid totals').toEqual([]);
});

for (const [time, greeting] of [
  ['2026-11-02T18:00:00Z', 'Good Afternoon,'], ['2026-11-03T00:00:00Z', 'Good Evening,'],
]) {
  test(`local time selects ${greeting}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(time));
    await openSummary(page, { member: true });
    await expect(page.locator('.good').last()).toHaveText(greeting);
    await expect(page.locator('.name').last()).toHaveText('Francisco Naranjo');
  });
}

for (const state of ['missing', 'unavailable']) {
  test(`${state} member profile keeps statistics and displays its actual state`, async ({ page, summaryApi }, testInfo) => {
    summaryApi.profile = null;
    if (state === 'unavailable') summaryApi.profileStatus = 500;
    await openSummary(page, { member: true });
    await expectStats(page);
    await expect(page.locator('.name').last()).toHaveText(state === 'missing' ? 'Profile incomplete' : 'Profile unavailable');
    await expect(page.locator('#summary_profile_status')).toBeVisible();
    await screenshot(page, testInfo, 'profile-state');
  });
}

for (const selector of ['.pencil:first-child', '.pencil:nth-child(2)', '.urgent', '.tasks', '.summary-email-requests']) {
  test(`${selector} opens Board without modifying a record`, async ({ page }) => {
    await page.route('**/board.html', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Board destination</title>' }));
    await openSummary(page);
    await expectStats(page);
    await expect(page.locator('.goodmorning .good')).toHaveText('Good Morning,');
    await page.locator(selector).click();
    await expect(page).toHaveURL(/\/board\.html$/);
  });
}

test('interactive metric groups are reachable by keyboard', async ({ page }) => {
  await openSummary(page);
  await expectStats(page);
  const unreachable = await page.locator('.pencil, .urgent, .tasks, .summary-email-requests')
    .evaluateAll((elements) => elements.filter((element) => element.tabIndex < 0).map((element) => element.className));
  expect(unreachable, 'Clickable metrics must also be keyboard reachable').toEqual([]);
});

test('the first mobile greeting disappears and leaves the metrics accessible', async ({ page }) => {
  await page.setViewportSize({ width: 428, height: 926 });
  await openSummary(page, { member: true, intro: true });
  const overlay = page.locator('#mobile_view_greetin_overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.name')).toHaveText('Francisco Naranjo');
  await expect(overlay).toBeHidden();
  await expectStats(page);
  await page.reload();
  await expect(overlay).toBeHidden();
});
