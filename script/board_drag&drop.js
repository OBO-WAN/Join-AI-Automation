/**
 * Drag & Drop controller for the Kanban board (desktop + mobile/touch).
 * - Desktop uses native HTML5 DnD.
 * - Mobile uses a ghost element and edge auto-scrolling.
 * - Placeholders stay hidden during touch drag to avoid flicker.
 */

/** Currently dragged task id as a string; `null` if none. */
let currentDraggedElement = null;
/** Ghost element used during touch drag; `null` when idle. */
let mobileGhost = null, activeDropSection = null;
/**
 * Touch state:
 * - `touchStartX`, `touchStartY`: starting coordinates
 * - `isTouchDragging`: becomes true after movement threshold
 * - `pointerY`: last Y position for edge auto-scroll
 */
let touchStartX = 0, touchStartY = 0, isTouchDragging = false, pointerY = 0;
/** requestAnimationFrame id for the auto-scroll loop (0 when not running). */
let autoScrollRAF = 0;
/** Minimum movement in pixels to treat a touch as a drag start. */
const TOUCH_ACTIVATION_THRESHOLD = 8;
/** Distance from viewport edges (px) where auto-scroll starts. */
const SCROLL_EDGE_MARGIN = 200; 
/** Maximum scroll speed (px per frame) once at the edge. */
const SCROLL_MAX_SPEED = 400;   

/**
 * Clears all drag-related UI state and timers.
 * - Removes visual classes, placeholders, and body scroll lock
 * - Removes the mobile ghost
 * - Resets inline styles on the original card
 * - Stops the auto-scroll loop
 */
function cleanupDrag() {
  document.querySelectorAll(".dragging-swing,.invisible-during-drag")
    .forEach(el => el.classList.remove("dragging-swing","invisible-during-drag"));
  document.querySelectorAll(".kanban_section").forEach(s => s.classList.remove("drag-over"));
  document.querySelectorAll(".drop-placeholder").forEach(p => p.style.display = "none");
  document.body.classList.remove("no-scroll");
  if (mobileGhost) { mobileGhost.remove(); mobileGhost = null; }
  const original = document.querySelector(`[data-task-id="${currentDraggedElement}"]`);
  if (original) Object.assign(original.style, { position:"", left:"", top:"", zIndex:"" });
  currentDraggedElement = null; activeDropSection = null; isTouchDragging = false; stopAutoScroll();
}

/**
 * Toggles active styling for a Kanban section and shows/hides its placeholder.
 * On mobile drags, the placeholder remains hidden to avoid flicker.
 * @param {HTMLElement} section - The Kanban section element.
 * @param {boolean} active - Whether the section is the current drop target.
 */
function setSectionActive(section, active) {
  if (!section) return;
  section.classList.toggle("drag-over", active);
  const ph = section.querySelector(".drop-placeholder");
  if (ph) ph.style.display = (!isTouchDragging && active) ? "block" : "none";
}

/**
 * Returns the `.kanban_section` element at the given viewport point, if any.
 * @param {number} x - Client X coordinate.
 * @param {number} y - Client Y coordinate.
 * @returns {HTMLElement|null} The section under the point, or null.
 */
function getDropSectionAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(".kanban_section") : null;
}

/**
 * Desktop: begins native drag. Sets dataTransfer and applies visual classes.
 * @param {string|number} taskId - The dragged task id.
 * @param {DragEvent} event - The native dragstart event.
 */
function startDragging(taskId, event) {
  currentDraggedElement = String(taskId);
  if (event?.dataTransfer) {
    event.dataTransfer.setData("text/plain", String(taskId));
    event.dataTransfer.effectAllowed = "move";
  }
  const el = document.querySelector(`[data-task-id="${taskId}"]`);
  if (el) setTimeout(() => el.classList.add("dragging-swing","invisible-during-drag"), 0);
}

/**
 * Desktop: allows dropping into a section and highlights it.
 * @param {DragEvent} ev - The dragover event.
 */
function allowDrop(ev) { ev.preventDefault(); setSectionActive(ev.currentTarget, true); }

/**
 * Desktop: removes highlight when the pointer leaves a section.
 * @param {DragEvent} ev - The dragleave event.
 */
function hideDropPlaceholder(ev) { setSectionActive(ev.currentTarget, false); }

/**
 * Persists the task's new status to Firebase and re-renders the board.
 * @async
 * @param {string} newStatus - New status key (e.g., "toDo", "inProgress").
 * @returns {Promise<void>}
 */
async function moveTo(newStatus) {
  if (currentDraggedElement == null) return;
  const task = tasks.find(t => String(t.id) === String(currentDraggedElement));
  if (!task) return;
  task.status = newStatus;
  await fetch(`${BASE_URL}tasks/${currentDraggedElement}.json`, {
    method:"PUT", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(task)
  });
  cleanupDrag(); await loadTasksFromFirebase();
}

/**
 * Mobile: prepares a potential drag; does not create the ghost yet.
 * Starts measuring from the initial touch position.
 * @param {TouchEvent} ev - The touchstart event.
 */
function onTouchStart(ev) {
  const card = ev.target.closest(".task_container");
  if (!card) return;
  currentDraggedElement = card.dataset.taskId;
  const t = ev.touches[0]; touchStartX = t.clientX; touchStartY = t.clientY; pointerY = t.clientY;
  isTouchDragging = false;
}

/**
 * Handles touch-move during mobile drag.
 * - Tracks pointer Y for auto-scroll
 * - Enforces activation threshold before starting a drag
 * - Initializes ghost on first valid move, positions it, and updates drop target
 *
 * @param {TouchEvent} ev - The touchmove event from the document.
 * @returns {void}
 * @global currentDraggedElement, isTouchDragging, touchStartX, touchStartY, pointerY
 */
function onTouchMove(ev) {
    if (currentDraggedElement == null) return;
    const t = ev.touches[0];
    pointerY = t.clientY;
    const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
    if (!isTouchDragging && Math.hypot(dx, dy) < TOUCH_ACTIVATION_THRESHOLD) return;
    ev.preventDefault();
    if (!isTouchDragging) initTouchDrag();
    positionGhostAt(t.clientX, t.clientY);
    updateActiveDropTarget(t.clientX, t.clientY);
}
  
/**
* Initializes a mobile drag session.
* - Locks body scroll
* - Hides original card visually, creates a ghost clone, and starts auto-scroll loop
*
* @returns {void}
* @global currentDraggedElement, isTouchDragging, mobileGhost
* @fires startAutoScroll
*/
function initTouchDrag() {
    isTouchDragging = true; document.body.classList.add("no-scroll");
    const original = document.querySelector(`[data-task-id="${currentDraggedElement}"]`);
    original?.classList.add("dragging-swing","invisible-during-drag");
    mobileGhost = original ? original.cloneNode(true) : document.createElement("div");
    mobileGhost.classList.add("dragging-touch");
    Object.assign(mobileGhost.style, { position:"fixed", width:`${original?.offsetWidth||250}px`, pointerEvents:"none", zIndex:"2000" });
    document.body.appendChild(mobileGhost); startAutoScroll();
}
  
/**
* Positions the mobile ghost element at a given viewport point.
* Centers the ghost under the finger based on its dimensions.
*
* @param {number} x - Client X coordinate.
* @param {number} y - Client Y coordinate.
* @returns {void}
* @global mobileGhost
*/
function positionGhostAt(x, y) {
    mobileGhost.style.left = `${x - mobileGhost.offsetWidth / 2}px`;
    mobileGhost.style.top  = `${y - mobileGhost.offsetHeight / 2}px`;
}
  
/**
* Updates the currently active drop section under a given point.
* Applies/removes highlight and placeholder visibility appropriately.
*
* @param {number} x - Client X coordinate.
* @param {number} y - Client Y coordinate.
* @returns {void}
* @global activeDropSection
* @see getDropSectionAtPoint, setSectionActive
*/
function updateActiveDropTarget(x, y) {
    const target = getDropSectionAtPoint(x, y);
    if (target !== activeDropSection) {
      document.querySelectorAll(".kanban_section").forEach(s => setSectionActive(s, s === target));
      activeDropSection = target || null;
    }
}

/**
 * Mobile: drops into the active section if available; otherwise cancels.
 * Always cleans up visual state afterward.
 * @async
 * @returns {Promise<void>}
 */
async function onTouchEnd() {
  if (!currentDraggedElement) return cleanupDrag();
  if (isTouchDragging && activeDropSection?.dataset?.status) await moveTo(activeDropSection.dataset.status);
  else cleanupDrag();
}

/**
 * Starts an rAF loop that scrolls the window when the finger is near edges.
 * Speed scales non-linearly with proximity to the edge.
 */
function startAutoScroll() {
    if (autoScrollRAF) return;
    const tick = () => {
      if (!isTouchDragging) { autoScrollRAF = 0; return; }
      const h = window.innerHeight, m = SCROLL_EDGE_MARGIN, max = SCROLL_MAX_SPEED;
      let speed = 0;
      if (pointerY < m) { const r = (m - pointerY)/m; speed = -max * easeOutQuad(r); }
      else if (pointerY > h - m) { const r = (pointerY - (h - m))/m; speed = max * easeOutQuad(r); }
      if (speed) window.scrollBy(0, speed);
      autoScrollRAF = requestAnimationFrame(tick);
    };
    autoScrollRAF = requestAnimationFrame(tick);
}

/**
 * Easing function for edge auto-scroll speed.
 * Input is clamped to [0..1]. Current variant is cubic (aggressive near edges).
 * @param {number} r - Normalized distance ratio from the edge (0..1).
 * @returns {number} Eased ratio in 0..1 used to scale speed.
 */
function easeOutQuad(r){ r=Math.min(Math.max(r,0),1); return r*r*r; }

/**
 * Stops the auto-scroll rAF loop if running.
 * @returns {void}
 */
function stopAutoScroll() {
  if (autoScrollRAF) { cancelAnimationFrame(autoScrollRAF); autoScrollRAF = 0; }
}

/**
 * Maps a value `v` from range [a..b] to [c..d].
 * Note: not used in the current flow; kept for potential utility.
 * @param {number} v - Input value.
 * @param {number} a - Input range start.
 * @param {number} b - Input range end.
 * @param {number} c - Output range start.
 * @param {number} d - Output range end.
 * @returns {number} Mapped value.
 */
function mapRange(v, a, b, c, d) {
  if (b === a) return c;
  return c + (d - c) * ((v - a) / (b - a));
}

/** Global event bindings for touch and desktop drag end. */
document.addEventListener("touchstart", onTouchStart, { passive: true });
document.addEventListener("touchmove", onTouchMove, { passive: false });
document.addEventListener("touchend", onTouchEnd);
document.addEventListener("dragend", cleanupDrag);