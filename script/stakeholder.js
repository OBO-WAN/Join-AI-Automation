const STAKEHOLDER_FIREBASE_BASE_URL = 'https://join-ai-automation-default-rtdb.europe-west1.firebasedatabase.app/';
const STAKEHOLDER_DAILY_LIMIT = 10;

/**
 * Formats a date as a local YYYY-MM-DD string for the Firebase automationUsage path.
 *
 * @param {Date} [date=new Date()] - Date to format.
 * @returns {string} Local date in YYYY-MM-DD format.
 */
function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Converts Firebase's count response into a sensible non-negative display value.
 *
 * @param {*} value - Raw count returned by Firebase.
 * @returns {number} Non-negative integer count for display.
 */
function normalizeRequestCount(value) {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return Math.floor(count);
}

/**
 * Fetches today's stakeholder request count from Firebase Realtime Database.
 *
 * @param {string} dateKey - Local YYYY-MM-DD date key.
 * @returns {Promise<number>} Today's normalized stakeholder request count.
 */
async function fetchDailyRequestCount(dateKey) {
  const response = await fetch(`${STAKEHOLDER_FIREBASE_BASE_URL}automationUsage/${dateKey}/count.json`);

  if (!response.ok) {
    throw new Error(`Firebase request failed with status ${response.status}`);
  }

  const count = await response.json();
  return normalizeRequestCount(count);
}

/**
 * Updates every stakeholder counter value rendered for responsive layouts.
 *
 * @param {number} count - Count to display.
 * @returns {void}
 */
function renderRequestCount(count) {
  document.querySelectorAll('.stakeholder-request-count').forEach((counter) => {
    counter.textContent = String(count);
  });
}

/**
 * Loads and renders today's stakeholder request usage while keeping the page usable on failure.
 *
 * @returns {Promise<void>}
 */
async function initializeStakeholderCounter() {
  try {
    const dateKey = getLocalDateKey();
    const count = await fetchDailyRequestCount(dateKey);
    renderRequestCount(Math.min(count, STAKEHOLDER_DAILY_LIMIT));
  } catch (error) {
    console.warn('Stakeholder request count unavailable; showing 0.', error);
    renderRequestCount(0);
  } finally {
    document.body.dataset.stakeholderCounterLoaded = 'true';
  }
}

initializeStakeholderCounter();
