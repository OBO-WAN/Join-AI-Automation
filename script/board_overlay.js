/**
 * Opens the Add Task overlay with form and functionality
 */
function addNewTask() {

   if (window.matchMedia("(max-width: 768px)").matches) {
    // Mobile → direkt auf Unterseite weiterleiten
    window.location.href = "add_task.html";
    return;
  }

  const overlay = document.getElementById("overlay");
  overlay.innerHTML = "";
  overlay.innerHTML = getAddTaskOverlay();
  overlay.classList.remove("d-none");

  setMinDateToday();
  loadContacts();
  initAddTaskFormEvents();
}

/**
 * Closes the currently open overlay
 */
function closeOverlay() {
  const overlay = document.getElementById("overlay");
  overlay.classList.add("d-none");
}

/**
 * Opens the task detail overlay with full task information
 * @param {Object} task - Task object to display
 * @param {string} assignedUsersHTML - HTML string for assigned user avatars
 * @param {number} index - Task index for DOM targeting
 */
function openTask(task, assignedUsersHTML, index) {
  const formattedDate = formatDateForOverlay(task.dueDate) || "—";
  document.body.classList.add("overlay-active");

  const priority = (task.priority || "low").toLowerCase();
  const subtasksHTML = generateSubtasksHTML(task.subTasks, task.id);

  const overlay = document.getElementById("overlay");
  overlay.innerHTML = getTaskSheetOverlay(
    task,
    assignedUsersHTML,
    index,
    formattedDate,
    priority,
    subtasksHTML
  );
  overlay.classList.remove("d-none");

}

/**
 * Formats a date string for display in the task overlay
 * @param {string} dueDate - Date string in DD-MM-YYYY format
 * @returns {string} Formatted date string for display
 */
function formatDateForOverlay(dueDate) {
  if (!dueDate || !dueDate.includes("-")) return "";

  const parts = dueDate.split("-");
  if (parts.length !== 3) return "";

  const [day, month, year] = parts;

  const paddedDay = day.padStart(2, "0");
  const paddedMonth = month.padStart(2, "0");

  const iso = `${year}-${paddedMonth}-${paddedDay}`;
  const dateObj = new Date(iso);

  if (isNaN(dateObj.getTime())) {
    console.warn("⚠️ Invalid date passed to formatter:", dueDate);
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateObj);
}

/**
 * Formats a date from DD-MM-YYYY to YYYY-MM-DD for HTML date inputs
 * @param {string} dueDate - Date string in DD-MM-YYYY format
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDateForInput(dueDate) {
  if (!dueDate) return "";

  const [day, month, year] = dueDate.split("-");
  return `${year}-${month}-${day}`;
}

/**
 * Opens the edit overlay for a task
 * @param {string} taskId - ID of the task to edit
 */
function editPopupTask(taskId) {
  const task = tasks.find(t => t.id == taskId);
  if (!task) return;

  showEditOverlay(task);

  const clearBtn = document.getElementById("clear-btn");
  if (clearBtn) clearBtn.remove();

  setMinDateToday();
  
  setTimeout(() => {
  prefillEditForm(task);
}, 200);

  loadContacts().then(() => {
    preselectAssignees(task.assignedTo);
  });

  setupEditFormSubmit(taskId);
}

/**
 * Shows the edit overlay with the add task form modified for editing
 * @param {Object} task - Task object to edit
 */
function showEditOverlay(task) {
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = "";
  overlay.classList.remove("d-none");
  overlay.innerHTML = getAddTaskOverlay();
  overlay.innerHTML = getEditTaskOverlay();
}

/**
 * Prefills the edit form with existing task data
 * @param {Object} task - Task object containing data to prefill
 */
function prefillEditForm(task) {
  const titleInput = document.getElementById("title");
  const descInput = document.getElementById("description");
  const dueInput = document.getElementById("due-date");
  const categoryInput = document.getElementById("category");
  const categoryPlaceholder = document.getElementById("selected-category-placeholder");

  if (titleInput) {
    titleInput.value = task.task || task.title || "";
  }
  
  if (descInput) {
    descInput.value = task.description || "";
  }

  if (dueInput) {
    const formattedDueDate = formatDateForInput(task.dueDate);
    dueInput.value = formattedDueDate;
  } else {
    console.warn("⚠️ 'due-date' input not found in the DOM.");
  }
  
  if (categoryInput && categoryPlaceholder) {
    categoryInput.value = task.category;
    categoryPlaceholder.textContent = task.category;
  }
  
  if (task.priority) {
    const priorityValue = task.priority.toLowerCase();
    const priorityInput = document.querySelector(
      `input[name="priority"][value="${priorityValue}"]`
    );
    if (priorityInput) {
      priorityInput.checked = true;
    } else {
      console.warn("⚠️ Priority input not found for value:", priorityValue);
    }
  }

  if (task.subTasks && Array.isArray(task.subTasks)) {
    const subtaskList = document.getElementById("subtask-list");
    if (subtaskList) {
      subtaskList.innerHTML = "";
      for (const sub of task.subTasks) {
        const subText = sub.task || sub;
        const li = createSubtaskElement(subText);
        subtaskList.appendChild(li);
      }
    } else {
      console.warn("⚠️ Subtask list container not found.");
    }
  }
}

/**
 * Preselects assignees in the dropdown based on task data
 * @param {Array} assignedToArray - Array of assigned contact names
 */
function preselectAssignees(assignedToArray) {
  if (!Array.isArray(assignedToArray)) return;

  assignedToArray.forEach((name) => {
    const checkbox = [
      ...document.querySelectorAll('#assignee-dropdown input[type="checkbox"]'),
    ].find((cb) => cb.value === name);
    if (checkbox) checkbox.checked = true;
  });

  updateAssigneePlaceholder();
}

/**
 * Sets up the form submit handler for editing tasks
 * @param {string} taskId - ID of the task being edited
 */
function setupEditFormSubmit(taskId) {
  const form = document.getElementById("taskForm");
  const saveBtn = document.querySelector(".create-btn");

  saveBtn.onclick = async function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    await saveEditedTask(taskId);
  };
}

/**
 * Saves an edited task to Firebase and reopens the task overlay
 * @param {string} taskId - ID of the task to save
 */
async function saveEditedTask(taskId) {
  const task = tasks.find((t) => t.id == taskId);
  const updatedTask = collectTaskData();
  updatedTask.id = taskId;
  updatedTask.status = task.status; // Preserve current status

  await fetch(`${BASE_URL}tasks/${taskId}.json`, {
    method: 'PUT',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedTask)
  });

  showToast("Task updated", "./assets/img/board.png");

  await loadTasksFromFirebase();
  const updated = tasks.find(t => t.id == taskId);
  if (updated) {
    const taskData = prepareTaskForTemplate(updated);
    const index = tasks.findIndex(t => t.id == taskId);

    const assignedUsersHTML = buildAssignedUsersHTML(updated.assignedTo);

    openTask(taskData, assignedUsersHTML, index);
  }
}

/**
 * Saves task edits to Firebase (legacy function)
 * @param {string} taskId - ID of the task to save
 */
async function saveTaskEdits(taskId){
  const task = tasks.find((t) => t.id == taskId);
  if (!task) return;

  const newTitle = document.getElementById("edit-title").value.trim();
  const newDetails = document.getElementById("edit-details").value.trim();
  const newDueDate = document.getElementById("edit-dueDate").value;
  const newPriority = document.getElementById("edit-priority").value;

  const [year, month, day] = newDueDate.split("-");
  const formattedDate = `${day}-${month}-${year}`;

  task.task = newTitle;
  task.description = newDetails;
  task.dueDate = formattedDate;
  task.priority = newPriority;

  await fetch(`${BASE_URL}tasks/${taskId}.json`, {
    method: "PUT",
    body: JSON.stringify(task),
  });

  closeOverlay();
  await loadTasksFromFirebase(); // Re-render
}

/**
 * Toggles the completion status of a subtask and updates Firebase
 * @param {Element} element - The checkbox element that was clicked
 * @param {string} taskId - ID of the parent task
 * @param {number} subtaskIndex - Index of the subtask within the task
 */
async function toggleSubtaskCheckbox(element, taskId, subtaskIndex) {
  const task = tasks.find((t) => t.id == taskId);
  if (!task || !task.subTasks || !task.subTasks[subtaskIndex]) return;
  task.subTasks[subtaskIndex].done = !task.subTasks[subtaskIndex].done;
  const img = element.querySelector("img");
  img.src = `assets/icons/${
    task.subTasks[subtaskIndex].done ? "checkbox-checked" : "checkbox-empty"
  }.svg`;
  await fetch(`${BASE_URL}tasks/${taskId}.json`, {
    method: "PUT",
    body: JSON.stringify(task),
  });
  const progressContainer = document.getElementById(
    `subtask_container_${tasks.indexOf(task)}`
  );
  if (progressContainer) {
    proofSubtasks(task, tasks.indexOf(task));
  }
}

/**
 * Generates HTML markup for the list of subtasks displayed in the task overlay.
 * 
 * Each subtask is rendered with a clickable checkbox icon and its text,
 * allowing users to toggle completion status directly from the overlay.
 * Supports both string-based and object-based subtasks.
 *
 * @function generateSubtasksHTML
 * @param {Array<Object|string>} subtasks - An array of subtasks, each either a string or an object with `task` and `done` fields.
 * @param {string|number} taskId - The ID of the parent task, used for identifying which task to update on click.
 * @returns {string} - HTML string of the rendered subtasks list, including icons and toggle handlers.
 *
 * @example
 * const html = generateSubtasksHTML(task.subTasks, task.id);
 * document.getElementById("subtasks-list-3").innerHTML = html;
 */
function generateSubtasksHTML(subtasks = [], taskId) {
  return `
    <ul>
      ${subtasks
        .map((subtask, index) => {
          const raw = subtask.task ?? subtask ?? "";
          const text = typeof raw === "string" ? raw : "";
          const cleanText = text.replace(/^•+\s*/, "").trim();
          const done = subtask.done === true;
          const checkbox = done ? "checkbox-checked" : "checkbox-empty";

          return `
            <li class="overlay-subtask-item" onclick="toggleSubtaskCheckbox(this, '${taskId}', ${index})">
              <img src="assets/icons/${checkbox}.svg" alt="Checkbox" class="overlay-checkbox">
              <span class="${done ? 'overlay-subtask-done' : ''}">${cleanText}</span>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

/**
 * Shows a confirmation dialog and returns user's choice
 * @param {string} message - Message to display in the confirmation dialog
 * @returns {Promise<boolean>} Promise that resolves to true if confirmed, false if cancelled
 */
function showConfirmation(message = "Are you sure?") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const msg = document.getElementById("confirm-message");
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    msg.textContent = message;
    modal.classList.remove("d-none");

    const cleanUp = () => {
      modal.classList.add("d-none");
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
    };

    const onYes = () => {
      cleanUp();
      resolve(true);
    };
    const onNo = () => {
      cleanUp();
      resolve(false);
    };

    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
  });
}
