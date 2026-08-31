/**
 * Updates the greeting text (Good Morning/Afternoon/Evening) 
 * based on the current time of day.
 */
function updateGreeting() {
  const greetingElements = document.querySelectorAll('.good');
  if (!greetingElements) return;
  const hours = new Date().getHours();
  const greetingText = hours < 12 ? 'Good Morning,' : hours < 18 ? 'Good Afternoon,' : 'Good Evening,';
  greetingElements.forEach(el => el.textContent = greetingText);
}

/**
 * Updates the displayed user name in the greeting section.
 *
 * @param {Object} user - The user object
 * @param {string} [user.firstname] - The user's first name
 * @param {string} [user.lastname] - The user's last name
 */
function greetingName(user) {
  const nameElements = document.querySelectorAll('.name');
  if (nameElements && user) {
    const nameText = user.firstname && user.lastname ? `${user.firstname} ${user.lastname}` : 'guest';
    nameElements.forEach(el => el.innerHTML = nameText);
  }
}

/**
 * Updates the current date in the summary view.
 * Uses a localized long format (e.g., "September 13, 2025").
 */
function updateDate() {
  const dateElement = document.querySelector('.date');
  if (dateElement) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = new Date().toLocaleDateString(undefined, options);
  }
}

/**
 * Fetches all tasks from the backend database.
 *
 * @async
 * @returns {Promise<Object>} A promise that resolves to the task data object
 * @throws {Error} If the request fails
 */
async function fetchTaskData() {
  const response = await fetch(`${BASE_URL}/tasks.json`);
  if (!response.ok) throw new Error(`Error fetching data: ${response.status}`);
  return (await response.json()) || {};
}

/**
 * Initializes the statistics object with default counters.
 *
 * @returns {Object} An object with counters for different task categories
 */
function initializeStats() {
  return { todo: 0, done: 0, urgent: 0, tasksInBoard: 0, tasksInProgress: 0, awaitingFeedback: 0 };
}

/**
 * Updates the statistics object based on a single task's status and priority.
 *
 * @param {Object} task - The task object
 * @param {Object} stats - The statistics object to update
 */
function updateStatsFromTask(task, stats) {
  stats.tasksInBoard++;
  switch (task.status) {
    case 'toDo': stats.todo++; break;
    case 'done': stats.done++; break;
    case 'inProgress': stats.tasksInProgress++; break;
    case 'awaitFeedback': stats.awaitingFeedback++; break;
  }
  if (task.priority?.toLowerCase() === 'urgent') stats.urgent++;
}

/**
 * Computes aggregated task statistics from a task dataset.
 *
 * @param {Object} tasks - The tasks object retrieved from the database
 * @returns {Object} The aggregated statistics object
 */
function computeTaskStats(tasks) {
  const stats = initializeStats();
  Object.values(tasks).forEach(task => {
    if (task && typeof task === 'object') {
      updateStatsFromTask(task, stats);
    }
  });
  return stats;
}

/**
 * Updates the summary section in the UI with task statistics.
 *
 * @param {Object} stats - The statistics object
 */
function updateTaskSummaryDisplay(stats) {
  document.querySelector('.summarynmb.todo').textContent = stats.todo;
  document.querySelector('.summarynmb.done').textContent = stats.done;
  document.querySelector('.urgentnmb').textContent = stats.urgent;
  const taskNumbers = document.querySelectorAll('.tasknmb');
  if (taskNumbers[0]) taskNumbers[0].textContent = stats.tasksInBoard;
  if (taskNumbers[1]) taskNumbers[1].textContent = stats.tasksInProgress;
  if (taskNumbers[2]) taskNumbers[2].textContent = stats.awaitingFeedback;
}

/**
 * Loads task data, computes statistics, and updates the UI.
 *
 * @async
 */
async function updateTaskData() {
  try {
    const tasks = await fetchTaskData();
    const stats = computeTaskStats(tasks);
    updateTaskSummaryDisplay(stats);
  } catch (error) {
    console.error('Error loading task data:', error);
  }
}

/**
 * Adds click events to summary elements for redirection to the board page.
 */
function addClickEvents() {
  const redirectToBoard = () => window.location.href = 'board.html';
  const tasksElement = document.querySelector('.tasks');
  if (tasksElement) tasksElement.onclick = redirectToBoard;
  const urgentElement = document.querySelector('.urgent');
  if (urgentElement) urgentElement.onclick = redirectToBoard;
  document.querySelectorAll('.pencil').forEach(el => el.onclick = redirectToBoard);
}

/**
 * Adds a hover effect to an icon by swapping its source.
 *
 * @param {HTMLElement} container - The container element that triggers the hover
 * @param {HTMLImageElement} imgElement - The image element to change
 * @param {string} defaultSrc - The default image source
 * @param {string} hoverSrc - The hover image source
 */
function addHoverEffect(container, imgElement, defaultSrc, hoverSrc) {
  if (!container || !imgElement) return;
  container.onmouseover = () => imgElement.src = hoverSrc;
  container.onmouseout = () => imgElement.src = defaultSrc;
}

/**
 * Initializes summary-related data, including greeting the user
 * and updating task data.
 *
 * @async
 */
async function initializeSummaryData() {
  const user = await loadUserData();
  greetingName(user);
  updateTaskData();
}

/**
 * Sets up the summary page UI elements, including greeting, date,
 * task updates, and event bindings.
 */
function setupSummaryUI() {
  updateGreeting();
  updateDate();
  checkAndShowAnimationSummary();
  setInterval(updateTaskData, 5000);
  addClickEvents();
}

/**
 * Sets up hover effects for summary page icons (e.g., pencil and done icons).
 */
function setupHoverIcons() {
  const pencilContainer = document.querySelector('.pencil:first-child');
  const pencilImg = pencilContainer?.querySelector('img');
  const doneContainer = document.querySelector('.pencil:nth-child(2)');
  const doneImg = doneContainer?.querySelector('img');
  addHoverEffect(pencilContainer, pencilImg, 'assets/icons/Pencil.svg', 'assets/icons/pencilhover.svg');
  addHoverEffect(doneContainer, doneImg, 'assets/icons/done.svg', 'assets/icons/donehover.svg');
}

/**
 * Initializes the entire summary page, including data, UI setup,
 * and hover effects.
 *
 * @async
 */
async function initializeSummaryPage() {
  try {
    await initializeSummaryData();
    setupSummaryUI();
    setupHoverIcons();
  } catch (error) {
    console.error('Error initializing the summary page', error);
  }
}

/**
 * Checks if the mobile greeting animation should be shown.
 * Displays it once per session on mobile devices, then hides it.
 */
function checkAndShowAnimationSummary() {
  const overlay = document.getElementById('mobile_view_greetin_overlay');
  const animationShown = sessionStorage.getItem('animationShownSummary');
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (animationShown || !isMobile) return overlay.style.display = 'none';
  overlay.style.display = 'flex';
  sessionStorage.setItem('animationShownSummary', 'true');
  setTimeout(() => overlay.style.display = 'none', 2500);
}