/**
 * Drag & Drop controller for the Kanban board (desktop + mobile/touch).
 * - Desktop uses native HTML5 DnD.
 * - Mobile starts dragging when a touched card is moved, while a tap stays a tap.
 * - Placeholders stay hidden during touch drag to avoid flicker.
 */

/** Currently dragged task id as a string; `null` if none. */
let currentDraggedElement = null;
/** Ghost element used during touch drag; `null` when idle. */
let mobileGhost = null,
  activeDropSection = null;
/**
 * Touch state:
 * - `touchStartX`, `touchStartY`: starting coordinates
 * - `isTouchDragging`: becomes true after movement activates the drag
 * - `pointerX`, `pointerY`: last pointer position for targeting/auto-scroll
 */
let touchStartX = 0,
  touchStartY = 0,
  isTouchDragging = false,
  pointerX = 0,
  pointerY = 0,
  touchOffsetX = 0,
  touchOffsetY = 0;
/** Source card for the active/pending touch gesture. */
let touchSourceCard = null;
/** Original draggable state restored when the touch gesture finishes. */
let touchSourceWasDraggable = true;
/** Timestamp until which the synthetic click after a touch drag is ignored. */
let suppressTouchClickUntil = 0;
/** requestAnimationFrame id for the auto-scroll loop (0 when not running). */
let autoScrollRAF = 0;
/** Movement needed to distinguish a drag from a tap. */
const TOUCH_DRAG_THRESHOLD = 8;
/** Short haptic pulse used when touch drag activates. */
const TOUCH_HAPTIC_DURATION = 35;
/** Distance from viewport edges (px) where auto-scroll starts. */
const SCROLL_EDGE_MARGIN = 96;
/** Gentle minimum scroll speed (px per frame) inside the edge zone. */
const SCROLL_MIN_SPEED = 2;
/** Maximum scroll speed (px per frame) at the viewport edge. */
const SCROLL_MAX_SPEED = 18;
/** Maximum distance (px) for a nearby visible section to become a drop target. */
const DROP_TARGET_MAGNET_DISTANCE = 96;
/** Local n8n production webhook for task status change notifications. */
const STATUS_NOTIFICATION_WEBHOOK_URL =
  "https://n8n.naranjo.io/webhook/task-status-changed";

/**
 * Sends a task status change notification to the local n8n webhook.
 * @async
 * @param {Object} params - Notification payload.
 * @param {string|number} params.taskId - Firebase task key.
 * @param {string} params.title - Task title.
 * @param {string} params.oldStatus - Status before the drag/drop update.
 * @param {string} params.newStatus - Status after the drag/drop update.
 * @param {string} params.creatorEmail - Email address of the task creator.
 * @param {string} params.creatorType - Creator type, such as "internal" or "external".
 * @returns {Promise<void>} Resolves when the notification request succeeds.
 * @throws {Error} Throws when the webhook response is not successful.
 */
async function notifyTaskStatusChanged({
  taskId,
  title,
  oldStatus,
  newStatus,
  creatorEmail,
  creatorType,
}) {
  const response = await fetch(STATUS_NOTIFICATION_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId,
      title,
      oldStatus,
      newStatus,
      creatorEmail,
      creatorType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Status notification failed: ${response.status}`);
  }
}

/** Restores the source card's native draggable state after touch handling. */
function restoreTouchSourceCard() {
  if (touchSourceCard?.isConnected) {
    touchSourceCard.draggable = touchSourceWasDraggable;
  }
  touchSourceCard = null;
  touchSourceWasDraggable = true;
}

/**
 * Clears all drag-related UI state and timers.
 * - Removes visual classes, placeholders, and body scroll lock
 * - Removes the mobile ghost
 * - Resets inline styles on the original card
 * - Stops the auto-scroll loop
 */
function cleanupDrag() {
  document
    .querySelectorAll(".dragging-swing,.invisible-during-drag")
    .forEach((el) =>
      el.classList.remove("dragging-swing", "invisible-during-drag"),
    );
  document
    .querySelectorAll(".kanban_section")
    .forEach((s) => s.classList.remove("drag-over"));
  document
    .querySelectorAll(".drop-placeholder")
    .forEach((p) => (p.style.display = "none"));
  document.body.classList.remove("no-scroll");
  if (mobileGhost) {
    mobileGhost.remove();
    mobileGhost = null;
  }
  const original = document.querySelector(
    `[data-task-id="${currentDraggedElement}"]`,
  );
  if (original)
    Object.assign(original.style, {
      position: "",
      left: "",
      top: "",
      zIndex: "",
    });
  restoreTouchSourceCard();
  currentDraggedElement = null;
  activeDropSection = null;
  isTouchDragging = false;
  touchOffsetX = 0;
  touchOffsetY = 0;
  stopAutoScroll();
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
  if (ph) ph.style.display = !isTouchDragging && active ? "block" : "none";
}

/**
 * Returns the `.kanban_section` element at the given viewport point, if any.
 * During touch drag, a nearby visible section can become the target even when
 * the finger is over fixed navigation or a small gap between sections.
 * @param {number} x - Client X coordinate.
 * @param {number} y - Client Y coordinate.
 * @returns {HTMLElement|null} The section under/nearest the point, or null.
 */
function getDropSectionAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (el?.closest("header,.sidebar,.nav-links")) return null;
  const directTarget = el ? el.closest(".kanban_section") : null;
  if (directTarget || !isTouchDragging) return directTarget;
  return getNearestVisibleDropSection(x, y);
}

/**
 * Returns the visible vertical board area between fixed navigation elements.
 * @returns {{top: number, bottom: number}} Usable viewport bounds in pixels.
 */
function getDragViewportBounds() {
  const header = document.querySelector("header");
  const mobileNav = document.querySelector(".nav-links");
  const headerRect = header?.getBoundingClientRect();
  const mobileNavRect = mobileNav?.getBoundingClientRect();
  const headerIsFixed = header && getComputedStyle(header).position === "fixed";
  const mobileNavIsFixed =
    mobileNav &&
    getComputedStyle(mobileNav).position === "fixed" &&
    mobileNavRect.height > 0;

  return {
    top: headerIsFixed ? Math.max(0, headerRect.bottom) : 0,
    bottom: mobileNavIsFixed
      ? Math.min(window.innerHeight, mobileNavRect.top)
      : window.innerHeight,
  };
}

/**
 * Finds the closest visible Kanban section to a viewport point.
 * This keeps a useful target selected while edge auto-scroll moves the board.
 * @param {number} x - Client X coordinate.
 * @param {number} y - Client Y coordinate.
 * @returns {HTMLElement|null} Closest visible section within the magnet range.
 */
function getNearestVisibleDropSection(x, y) {
  let nearestSection = null;
  let nearestDistance = Infinity;
  const viewport = getDragViewportBounds();

  document.querySelectorAll(".kanban_section").forEach((section) => {
    const rect = section.getBoundingClientRect();
    if (
      rect.bottom < viewport.top ||
      rect.top > viewport.bottom ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    )
      return;

    const closestX = Math.max(rect.left, Math.min(x, rect.right));
    const closestY = Math.max(rect.top, Math.min(y, rect.bottom));
    const distance = Math.hypot(x - closestX, y - closestY);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestSection = section;
    }
  });

  return nearestDistance <= DROP_TARGET_MAGNET_DISTANCE
    ? nearestSection
    : null;
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
  if (el)
    setTimeout(
      () => el.classList.add("dragging-swing", "invisible-during-drag"),
      0,
    );
}

/**
 * Desktop: allows dropping into a section and highlights it.
 * @param {DragEvent} ev - The dragover event.
 */
function allowDrop(ev) {
  ev.preventDefault();
  setSectionActive(ev.currentTarget, true);
}

/**
 * Desktop: removes highlight when the pointer leaves a section.
 * @param {DragEvent} ev - The dragleave event.
 */
function hideDropPlaceholder(ev) {
  setSectionActive(ev.currentTarget, false);
}

/**
 * Persists the task's new status to Firebase and re-renders the board.
 * @async
 * @param {string} newStatus - New status key (e.g., "toDo", "inProgress").
 * @returns {Promise<void>}
 */
async function moveTo(newStatus) {
  if (currentDraggedElement == null) return;
  const taskId = String(currentDraggedElement);
  const task = tasks.find((t) => String(t.id) === taskId);
  if (!task) {
    cleanupDrag();
    return;
  }
  const oldStatus = task.status;
  if (oldStatus === newStatus) {
    cleanupDrag();
    return;
  }

  const oldStatusChangedAt = task.statusChangedAt;
  task.status = newStatus;
  task.statusChangedAt = new Date().toISOString();

  cleanupDrag();
  renderCurrentTasks();

  try {
    const response = await fetch(`${BASE_URL}tasks/${taskId}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: task.status,
        statusChangedAt: task.statusChangedAt,
      }),
    });
    if (!response.ok) {
      throw new Error(`Firebase status update failed: ${response.status}`);
    }

    if (task.creator?.email) {
      notifyTaskStatusChanged({
        taskId,
        title: task.title || task.task || "Untitled",
        oldStatus,
        newStatus,
        creatorEmail: task.creator.email,
        creatorType: task.creator.type,
      }).catch((error) => console.warn("Status notification failed:", error));
    }

    await loadTasksFromFirebase();
  } catch (error) {
    task.status = oldStatus;
    if (oldStatusChangedAt === undefined) delete task.statusChangedAt;
    else task.statusChangedAt = oldStatusChangedAt;
    renderCurrentTasks();
    if (typeof showToast === "function") {
      showToast("Task could not be moved", "./assets/icons/error.png");
    }
    console.error("Task status update failed:", error);
  }
}

/**
 * Mobile: prepares a potential drag. A stationary touch remains a normal tap;
 * moving beyond the threshold activates dragging immediately.
 * Native HTML drag is temporarily disabled so it cannot steal the touch stream.
 * @param {TouchEvent} ev - The touchstart event.
 */
function onTouchStart(ev) {
  if (ev.touches.length !== 1) {
    if (currentDraggedElement != null) cleanupDrag();
    return;
  }
  const card = ev.target.closest(".task_container");
  if (!card) return;

  restoreTouchSourceCard();
  suppressTouchClickUntil = 0;
  touchSourceCard = card;
  touchSourceWasDraggable = card.draggable;
  card.draggable = false;
  currentDraggedElement = card.dataset.taskId;
  const t = ev.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  pointerX = t.clientX;
  pointerY = t.clientY;
  isTouchDragging = false;
  const rect = card.getBoundingClientRect();
  touchOffsetX = t.clientX - rect.left;
  touchOffsetY = t.clientY - rect.top;
}

/**
 * Handles touch-move during mobile interaction.
 * - Movement beyond the tap threshold activates dragging
 * - After activation, scrolling is locked and the ghost follows the finger
 *
 * @param {TouchEvent} ev - The touchmove event from the document.
 * @returns {void}
 */
function onTouchMove(ev) {
  if (currentDraggedElement == null) return;
  if (ev.touches.length !== 1) return cleanupDrag();
  const t = ev.touches[0];
  pointerX = t.clientX;
  pointerY = t.clientY;

  if (!isTouchDragging) {
    const dx = t.clientX - touchStartX,
      dy = t.clientY - touchStartY;
    if (Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD) return;

    suppressTouchClickUntil = Date.now() + 800;
    try {
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(TOUCH_HAPTIC_DURATION);
      }
    } catch (error) {
      console.debug("Touch haptics unavailable:", error);
    }

    initTouchDrag();
  }

  if (ev.cancelable) ev.preventDefault();
  positionGhostAt(pointerX, pointerY);
  updateActiveDropTarget(pointerX, pointerY);
}

/**
 * Initializes a mobile drag session after movement passes the tap threshold.
 * - Locks body scroll
 * - Hides original card visually, creates a visible ghost clone, and starts auto-scroll loop
 *
 * @returns {void}
 * @global currentDraggedElement, isTouchDragging, mobileGhost
 * @fires startAutoScroll
 */
function initTouchDrag() {
  isTouchDragging = true;
  document.body.classList.add("no-scroll");
  const original = document.querySelector(
    `[data-task-id="${currentDraggedElement}"]`,
  );
  mobileGhost = original
    ? original.cloneNode(true)
    : document.createElement("div");
  original?.classList.add("dragging-swing", "invisible-during-drag");
  mobileGhost.classList.remove("dragging-swing", "invisible-during-drag");
  mobileGhost.classList.add("dragging-touch");
  mobileGhost.draggable = false;
  mobileGhost.removeAttribute("ondragstart");
  Object.assign(mobileGhost.style, {
    position: "fixed",
    width: `${original?.offsetWidth || 250}px`,
    pointerEvents: "none",
    zIndex: "2000",
  });
  document.body.appendChild(mobileGhost);
  startAutoScroll();
}

/**
 * Positions the mobile ghost at the same finger-to-card offset used on pickup.
 *
 * @param {number} x - Client X coordinate.
 * @param {number} y - Client Y coordinate.
 * @returns {void}
 * @global mobileGhost
 */
function positionGhostAt(x, y) {
  if (!mobileGhost) return;
  mobileGhost.style.left = `${x - touchOffsetX}px`;
  mobileGhost.style.top = `${y - touchOffsetY}px`;
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
    document
      .querySelectorAll(".kanban_section")
      .forEach((s) => setSectionActive(s, s === target));
    activeDropSection = target || null;
  }
}

/**
 * Mobile: drops into the active section if available; otherwise cancels.
 * A stationary touch is cleaned up so its synthetic click can open details.
 * @async
 * @returns {Promise<void>}
 */
async function onTouchEnd() {
  if (!currentDraggedElement) return cleanupDrag();
  if (isTouchDragging && activeDropSection?.dataset?.status)
    await moveTo(activeDropSection.dataset.status);
  else cleanupDrag();
}

/** Cancels an interrupted touch gesture without moving a task. */
function onTouchCancel() {
  cleanupDrag();
}

/**
 * Suppresses the browser's native long-press/context-menu interaction while a
 * card touch gesture is pending or active. Mouse right-click remains unchanged.
 * @param {MouseEvent} ev - Context menu event.
 */
function suppressContextMenuDuringTouch(ev) {
  if (!touchSourceCard || !ev.target.closest(".task_container")) return;
  ev.preventDefault();
}

/**
 * Prevents the synthetic click generated after a touch drag from opening
 * the task overlay. Normal taps remain unaffected.
 * @param {MouseEvent} ev - Click event captured at the document level.
 */
function suppressClickAfterTouchDrag(ev) {
  if (Date.now() > suppressTouchClickUntil) return;
  if (!ev.target.closest(".task_container")) return;
  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation();
}

/**
 * Returns a smooth vertical auto-scroll speed for a pointer near the viewport edge.
 * Scrolling begins gently and accelerates as the finger approaches the edge.
 * @param {number} position - Pointer Y coordinate.
 * @param {number} viewportSize - Current viewport height.
 * @returns {number} Signed pixels per animation frame.
 */
function getVerticalAutoScrollSpeed(position, viewportSize) {
  const viewport = getDragViewportBounds();
  const top = Math.max(0, viewport.top);
  const bottom = Math.min(viewportSize, viewport.bottom);
  const usableHeight = Math.max(1, bottom - top);
  const margin = Math.min(SCROLL_EDGE_MARGIN, usableHeight / 3);
  let direction = 0;
  let ratio = 0;

  if (position < top + margin) {
    direction = -1;
    ratio = (top + margin - position) / margin;
  } else if (position > bottom - margin) {
    direction = 1;
    ratio = (position - (bottom - margin)) / margin;
  }

  if (!direction) return 0;
  const eased = easeInQuad(ratio);
  return (
    direction *
    (SCROLL_MIN_SPEED + (SCROLL_MAX_SPEED - SCROLL_MIN_SPEED) * eased)
  );
}

/**
 * Starts an rAF loop that scrolls the window when the finger is near edges.
 * The active drop target is recalculated while the page moves so a card can
 * flow across several status sections without requiring repeated finger motion.
 */
function startAutoScroll() {
  if (autoScrollRAF) return;
  const tick = () => {
    if (!isTouchDragging) {
      autoScrollRAF = 0;
      return;
    }

    const speed = getVerticalAutoScrollSpeed(pointerY, window.innerHeight);
    if (speed) {
      window.scrollBy(0, speed);
    }

    updateActiveDropTarget(pointerX, pointerY);
    autoScrollRAF = requestAnimationFrame(tick);
  };
  autoScrollRAF = requestAnimationFrame(tick);
}

/**
 * Quadratic edge easing: slow near the edge-zone boundary, faster at the edge.
 * @param {number} r - Normalized edge proximity ratio (0..1).
 * @returns {number} Eased ratio in 0..1.
 */
function easeInQuad(r) {
  r = Math.min(Math.max(r, 0), 1);
  return r * r;
}

/**
 * Stops the auto-scroll rAF loop if running.
 * @returns {void}
 */
function stopAutoScroll() {
  if (autoScrollRAF) {
    cancelAnimationFrame(autoScrollRAF);
    autoScrollRAF = 0;
  }
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
document.addEventListener("touchmove", onTouchMove, {
  passive: false,
  capture: true,
});
document.addEventListener("touchend", onTouchEnd);
document.addEventListener("touchcancel", onTouchCancel);
document.addEventListener("contextmenu", suppressContextMenuDuringTouch, true);
document.addEventListener("click", suppressClickAfterTouchDrag, true);
document.addEventListener("dragend", cleanupDrag);
