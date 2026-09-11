/**
 * Sets the open state for an external creator email disclosure.
 * @param {HTMLButtonElement} trigger - Disclosure trigger.
 * @param {boolean} isOpen - Whether the full email should be visible.
 */
function setCreatorEmailDisclosure(trigger, isOpen) {
  const popover = document.getElementById(trigger.getAttribute("aria-controls"));
  if (!popover) return;
  trigger.setAttribute("aria-expanded", String(isOpen));
  popover.hidden = !isOpen;
}

/**
 * Closes every visible creator email disclosure.
 * @param {HTMLButtonElement|null} restoreFocusTo - Optional trigger to refocus.
 */
function closeCreatorEmailDisclosures(restoreFocusTo = null) {
  document.querySelectorAll(".task_creator_email_trigger[aria-expanded='true']")
    .forEach((trigger) => setCreatorEmailDisclosure(trigger, false));
  restoreFocusTo?.focus();
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest(".task_creator_email_trigger");
  if (trigger) {
    const shouldOpen = trigger.getAttribute("aria-expanded") !== "true";
    closeCreatorEmailDisclosures();
    setCreatorEmailDisclosure(trigger, shouldOpen);
    return;
  }

  if (!event.target.closest(".task_creator_email_disclosure")) {
    closeCreatorEmailDisclosures();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const trigger = document.querySelector(".task_creator_email_trigger[aria-expanded='true']");
  if (trigger) closeCreatorEmailDisclosures(trigger);
});
