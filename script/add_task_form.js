/**
 * Initializes event listeners for the "Add Task" form.
 *
 * Typically called on page load to activate form interactivity.
 */
function initAddTaskFormEvents() {
    const clearBtn = document.querySelector(".clear-btn");
    if (clearBtn) {
      clearBtn.onclick = resetForm;
    }
  
    const form = document.getElementById("taskForm");
    const submitBtn = document.querySelector(".create-btn");
  
    if (submitBtn && form) {
      submitBtn.onclick = function (event) {
        event.preventDefault();
  
        if (!validateForm()) {
          return;
        }
  
        submitTask();
      };
    }
}
  
/**
 * Attaches real-time validation listeners to form fields.
 *
 * This function adds `input` event listeners to specific fields (e.g., title and due date)
 * to remove validation error styles and messages as soon as the user corrects the input.
 * 
 * Typically called on form initialization to enhance user feedback during input.
 */
function addFieldValidationListeners() {
    const title = document.getElementById("title");
    const titleError = document.getElementById("error-title");
  
    const dueDate = document.getElementById("due-date");
    const dueDateError = document.getElementById("error-due-date");
  
    title.addEventListener("input", () => {
      if (title.value.trim()) {
        title.classList.remove("input-error");
        titleError.classList.remove("active");
      }
    });
  
    dueDate.addEventListener("input", () => {
      if (dueDate.value.trim()) {
        dueDate.classList.remove("input-error");
        dueDateError.classList.remove("active");
      }
    });
}

/**
 * Validates the required fields of the task form.
 *
 * Each validation step is delegated to helper functions (e.g., `validateField`, `validateCategory`).
 * 
 * @returns {boolean} `true` if all validations pass, otherwise `false`.
 */
function validateForm() {
    let valid = true;
  
    if (!validateField("title", "error-title")) valid = false;
    if (!validateField("due-date", "error-due-date")) valid = false;
    if (!validateCategory()) valid = false;
  
    return valid;
}

/**
 * Validates a single input field by checking if it has a non-empty value.
 *
 * If the field is empty: (`input-error`) 
 *
 * If the field is valid: Any error styles and messages are removed.
 *
 * @param {string} inputId - The ID of the input or textarea element to validate.
 * @param {string} errorId - The ID of the associated error message element.
 * @returns {boolean} `true` if the field has a valid (non-empty) value, otherwise `false`.
 */
function validateField(inputId, errorId) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
  
    if (!input.value.trim()) {
      input.classList.add("input-error");
      error.classList.add("active");
      return false;
    } else {
      input.classList.remove("input-error");
      error.classList.remove("active");
      return true;
    }
}

/**
 * Special validation function for the custom category select component.
 * Checks if a category has been selected and handles error styling.
 * 
 * @returns {boolean} True if a category is selected, false otherwise.
 */

function validateCategory() {
    const category = document.getElementById("category");
    const error = document.getElementById("error-category");
    const header = document.querySelector(".category-select-header");
  
    if (!category.value.trim()) {
      header.classList.add("input-error");
      error.classList.add("active");
      return false;
    } else {
      header.classList.remove("input-error");
      error.classList.remove("active");
      return true;
    }
}

/**
 * Adds delete functionality to a subtask item
 * @param {HTMLElement} li - The subtask list item element
 */
function addSubtaskDeleteHandler(li) {
    const deleteButton = li.querySelector(".delete-subtask");
    deleteButton.addEventListener("click", () => li.remove());
}
  
/**
* Enables inline editing mode for a subtask
* @param {HTMLElement} li - The subtask list item element
*/
function enterEditMode(li) {
    const text = li.querySelector(".subtask-text");
    const input = li.querySelector(".subtask-edit-input");
    input.value = text.textContent.replace(/^•\s*/, "");
    text.style.display = "none"; input.classList.remove("d-none"); input.focus();
  
    const save = () => {
      const val = input.value.trim();
      if (val) text.textContent = `• ${val}`;
      input.classList.add("d-none"); text.style.display = "inline";
      input.removeEventListener("keydown", onEnter);
      input.removeEventListener("blur", save);
    };
  
    const onEnter = e => e.key === "Enter" && save();
    input.addEventListener("keydown", onEnter);
    input.addEventListener("blur", save);
}
  
/**
* Renders the assignee dropdown with contact checkboxes
*/
function renderAssigneeDropdown() {
    const container = document.getElementById("assignee-dropdown");
    if (!container) return;
  
    container.innerHTML = "";
  
    Contacts.forEach((contact, index) => {
      const initials = getInitials(contact.name);
      const color = getColor(initials[0]);
      const checkboxId = `assignee_${index}`;
  
      const html = `
              <label class="checkbox-label" for="${checkboxId}">
                  <div class="assignee-info">
                      <div class="user-initials" style="background-color: ${color};">${initials}</div>
                      <span>${contact.name}</span>
                  </div>
                  <input type="checkbox" id="${checkboxId}" value="${contact.name}" onchange="updateAssigneePlaceholder()">
              </label>
          `;
      container.insertAdjacentHTML("beforeend", html);
    });
}
  
/**
* Updates the visual placeholder for selected assignees in the task form.
*
*
+ Typically called when checkboxes in the "Assigned to" dropdown are toggled.
*/
function updateAssigneePlaceholder() {
    const avatars = document.getElementById("selected-assignee-avatars");
    const placeholder = document.getElementById("selected-assignees-placeholder");
    const checkboxes = document.querySelectorAll('#assignee-dropdown input[type="checkbox"]');
    if (!avatars || !placeholder) return;
  
    const selected = [...checkboxes].filter(cb => { cb.closest(".checkbox-label")?.classList.toggle("selected", cb.checked); return cb.checked; }).map(cb => cb.value);
  
    avatars.innerHTML = ""; placeholder.textContent = "Select contacts";
    selected.slice(0, 4).forEach(n => { const i = getInitials(n), c = getColor(i[0]); avatars.innerHTML += `<div class="avatar" style="background-color:${c};">${i}</div>`; });
    if (selected.length > 4) avatars.innerHTML += `<div class="avatar" style="background-color:#2a3647;">+${selected.length - 4}</div>`;
}
  
/**
* Closes custom dropdowns when clicking outside of them.
*
* Applies to: assignee multiselect dropdown & category selection dropdown
*
* This helps ensure that dropdowns do not remain open unintentionally when interacting elsewhere on the page.
*/
document.addEventListener("click", function (event) {
    const dropdowns = [
      {
        dropdown: document.getElementById("assignee-dropdown"),
        header: document.querySelector(".multiselect-header"),
      },
      {
        dropdown: document.getElementById("category-dropdown"),
        header: document.querySelector(".category-select-header"),
      },
    ];
    dropdowns.forEach(({ dropdown, header }) => {
      if (!dropdown || !header) return;
      if (!dropdown.contains(event.target) && !header.contains(event.target)) {
        dropdown.classList.add("d-none");
      }
    });
});
  
/**
* Toggles the visibility of the assignee dropdown
*/
function toggleAssigneeDropdown() {
    document.getElementById("category-dropdown").classList.add("d-none");
    const assigneeDropdown = document.getElementById("assignee-dropdown");
    assigneeDropdown.classList.toggle("d-none");
}
  
/**
* Toggles the visibility of the category dropdown
*/
function toggleCategoryDropdown() {
    document.getElementById("assignee-dropdown").classList.add("d-none");
    const categoryDropdown = document.getElementById("category-dropdown");
    categoryDropdown.classList.toggle("d-none");
}
  
/**
* Selects a category and updates the display
* @param {string} value - The category value to select
*/
function selectCategory(value) {
    const label = {
      "technical-task": "Technical Task",
      "user-story": "User Story",
    };
  
    document.getElementById("category").value = value;
    document.getElementById("selected-category-placeholder").textContent =
      label[value] || "Select category";
    document.getElementById("category-dropdown").classList.add("d-none");
}
  
/**
* Handles Enter key press in subtask input to add subtask
* @param {KeyboardEvent} event - The keyboard event
*/
function handleSubtaskKey(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubtask();
    }
}
  
/**
* Sets the minimum date for the due date input to today's date
*/
function setMinDateToday() {
    const dateInput = document.getElementById("due-date");
    if (dateInput) {
      const today = new Date().toISOString().split("T")[0];
      dateInput.min = today;
    }
}
  
/**
* Initializes the Add Task form once the DOM is fully loaded.
*/
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("taskForm");
  
    if (form) {
      initAddTaskFormEvents();
      addFieldValidationListeners();
      loadContacts();
      setMinDateToday();
    }
});

/**
 * Closes the task creation overlay by hiding it
 * 
 */
function closeOverlay() {
    const overlay = document.getElementById("overlay");
    if (overlay) {
      overlay.classList.add("d-none");
    }
}

/**
 * Resets the task form to its initial default state.
 *
 * Typically used after submitting or cancelling the task form.
 */
function resetForm() {
    document.getElementById("taskForm").reset();
    document.getElementById("subtask-list").innerHTML = "";
    document.querySelectorAll('#assignee-dropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateAssigneePlaceholder();
  
    document.querySelectorAll("#taskForm input, #taskForm textarea").forEach(el => {
      el.classList.remove("input-error");
      el.setCustomValidity?.("");
    });
  
    document.querySelectorAll(".field-error-message").forEach(e => e.classList.remove("active"));
  
    const cat = document.getElementById("category"), ph = document.getElementById("selected-category-placeholder"),
          head = document.querySelector(".category-select-header"), err = document.getElementById("error-category");
  
    if (cat && ph && head && err) { cat.value = ""; ph.textContent = "Select category"; head.classList.remove("input-error"); err.classList.remove("active"); }
}

/**
 * 
 * Displays a temporary toast notification
 * @param {string} message - Message to display
 * @param {string} iconPath - Path to icon image (optional)
 * Create toast element
 * Auto-remove toast after 4 seconds
 */
function showToast(message, iconPath = "./assets/img/board.png") {
    const container = document.getElementById("toast-container");
    if (!container) return;
  
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
          <span>${message}</span>
          <img src="${iconPath}" alt="Icon">
      `;
  
    container.appendChild(toast);
  
    setTimeout(() => {
      toast.remove();
    }, 4000);
}