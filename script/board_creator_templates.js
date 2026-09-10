/**
 * Escapes creator-provided text before inserting it into task markup.
 * @param {*} value - Creator value to escape.
 * @returns {string} HTML-safe text.
 */
function escapeCreatorText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

/**
 * Generates compact creator information for a Kanban task card.
 * @param {Object|null} creator - Creator display data.
 * @returns {string} Creator HTML or an empty string.
 */
function getCreatorCardHTML(creator) {
  if (!creator) return "";

  return `
                        <div class="task_creator">
                            <span class="task_creator_label">Created by:</span>
                            <span class="task_creator_identity">${escapeCreatorText(creator.identity)}</span>
                            <span class="creator_type_badge creator_type_${creator.type}">${escapeCreatorText(creator.label)}</span>
                        </div>`;
}

/**
 * Generates the creator identity, including disclosure for external email addresses.
 * @param {Object} creator - Creator display data.
 * @returns {string} Creator identity HTML.
 */
function getCreatorIdentityHTML(creator) {
  const identity = escapeCreatorText(creator.identity);
  if (creator.type !== "external") {
    return `<span class="task_creator_identity">${identity}</span>`;
  }

  return `<span class="task_creator_email_disclosure">
          <button type="button" class="task_creator_identity task_creator_email_trigger" aria-expanded="false" aria-controls="task-creator-email-popover" title="${identity}">${identity}</button>
          <span id="task-creator-email-popover" class="task_creator_email_popover" role="tooltip" hidden>${identity}</span>
        </span>`;
}

/**
 * Generates creator information for the task detail overlay.
 * @param {Object|null} creator - Creator display data.
 * @returns {string} Creator HTML or an empty string.
 */
function getCreatorOverlayHTML(creator) {
  if (!creator) return "";

  return `
    <div class="task_creator_overlay creator_${creator.type}">
      <div class="task_creator_info">
        <span class="task_creator_label">Creator:</span>

        <span class="creator_type_badge creator_type_${creator.type}">
          ${creator.type === "external" ? `<svg class="creator_badge_icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M3 12h18"></path>
            <path d="M12 3c2.5 2.7 4 5.8 4 9s-1.5 6.3-4 9c-2.5-2.7-4-5.8-4-9s1.5-6.3 4-9z"></path>
          </svg>` : ""}${escapeCreatorText(creator.label)}
        </span>

        ${getCreatorIdentityHTML(creator)}
      </div>

      <${creator.type === "external" ? `a href="mailto:${escapeCreatorText(creator.identity)}"` : "span"} class="task_creator_action">
        <span class="task_creator_action_icon" aria-hidden="true"></span>
        ${creator.type === "internal" ? "Profil" : "E-mail"}
      </${creator.type === "external" ? "a" : "span"}>
    </div>`;
}
