const BASE_URL = 'https://join-1ae7f-default-rtdb.europe-west1.firebasedatabase.app/'; // Updated Database

let Contacts = [];

loadContacts();

/**
 * 
 * Submits a new task by collecting form data, generating an ID, and saving to Firebase
 */
async function submitTask() {
  const task = collectTaskData();
  const tasks = await fetchAllTasks();
  const newId = getNextTaskId(tasks);
  task.id = newId.toString();

  saveTaskToFirebase(task, newId);
}

/**
 * Collects and formats all task-related input data from the task form.
 *
 * @typedef {Object} Task
 * @property {string} title - The task title.
 * @property {string} description - The task description.
 * @property {string} dueDate - The formatted due date (DD-MM-YYYY).
 * @property {string} category - The mapped category label.
 * @property {string|null} priority - The capitalized priority level, or null if none selected.
 * @property {string[]} assignedTo - A unique array of selected contact names.
 * @property {{task: string}[]} subTasks - A list of subtasks, each as an object with a task string.
 * @property {string} status - The default task status (e.g., "toDo").
 *
 * @returns {Task} The compiled task data object, ready to be saved or submitted.
 */
function collectTaskData() {
  const title = v("title"), description = v("description"), dueDate = formatDate(v("due-date"));
  const category = mapCategory(v("category"));
  const priority = formatPriority(document.querySelector("input[name='priority']:checked")?.value);
  const assignedTo = getCheckedValues('#assignee-dropdown input[type="checkbox"]:checked');
  const subTasks = getSubtasks();

  return { title, description, dueDate, category, priority, assignedTo, subTasks, status: "toDo" };
}

/**
 * Gets and trims the value of an input field by its ID.
 * @param {string} id - The ID of the input element.
 * @returns {string} The trimmed input value.
 */
const v = id => document.getElementById(id).value.trim();

/**
 * Formats a date string from "YYYY-MM-DD" to "DD-MM-YYYY".
 * @param {string} d - The raw date string.
 * @returns {string} The formatted date or an empty string if invalid.
 */
const formatDate = d => d ? d.split("-").reverse().join("-") : "";

/**
 * Maps a category key to its display label.
 * @param {string} v - The raw category value.
 * @returns {string} The mapped category label.
 */
const mapCategory = v => ({ "technical-task": "Technical Task", "user-story": "User Story" }[v] || v);

/**
 * Formats the priority string (capitalizes first letter).
 * @param {string|null} p - The raw priority value.
 * @returns {string|null} The formatted priority or null if not provided.
 */
const formatPriority = p => p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : null;

/**
 * Collects checked checkbox values and ensures they are unique.
 * @param {string} sel - The CSS selector for the checkboxes.
 * @returns {string[]} An array of unique selected values.
 */
const getCheckedValues = sel => [...new Set([...document.querySelectorAll(sel)].map(cb => cb.value))];

/**
 * Collects all subtasks from the subtask list in the DOM.
 * @returns {{task: string}[]} An array of subtasks as objects.
 */
const getSubtasks = () => [...document.querySelectorAll("#subtask-list li")]
  .map(i => ({ task: i.textContent.trim().replace(/^•+\s*/, "") }));

/**
 * 
 * Fetches all existing tasks from Firebase
 * @returns {Promise<Object>} Object containing all tasks or empty object on error
 */
async function fetchAllTasks() {
  try {
    const res = await fetch(`${BASE_URL}tasks.json`);
    return (await res.json()) || {};
  } catch (err) {
    console.warn("⚠️ Fehler beim Laden der Aufgaben:", err);
    return {};
  }
}

/**
 * 
 * Determines the next available task ID by finding the maximum existing ID
 * @param {Object} tasks - Object containing all existing tasks
 * @returns {number} Next available task ID
 */
function getNextTaskId(tasks) {
  let maxId = 0;
  for (const key in tasks) {
    const task = tasks[key];
    if (!task || typeof task !== "object") continue;

    const idNum = parseInt(task.id);
    if (!isNaN(idNum) && idNum > maxId) {
      maxId = idNum;
    }
  }
  return maxId + 1;
}

/**
 * Saves a task object to Firebase under the given task ID.
 *
 * @async
 * @param {Object} task - The task object to be saved.
 * @param {string|number} id - The unique ID under which the task will be stored in Firebase.
 * @returns {Promise<void>} Resolves when the task is successfully saved or logs an error if it fails.
 */
async function saveTaskToFirebase(task, id) {
  try {
    normalizeAssignedTo(task);
    const res = await putTaskToFirebase(task, id);

    if (res.ok) {
      handleSuccessfulSave();
    }
  } catch (error) {
    console.warn("⚠️ Error saving task:", error);
  }
}

/**
 * Normalizes the "assignedTo" field of a task.
 * Ensures that the field is always an array, converting objects if necessary.
 *
 * @param {Object} task - The task object whose "assignedTo" field is being normalized.
 */
function normalizeAssignedTo(task) {
  if (!Array.isArray(task.assignedTo)) {
    task.assignedTo = Object.values(task.assignedTo || {});
  }
}

/**
 * Sends a PUT request to Firebase to store a task.
 *
 * @param {Object} task - The task object to save.
 * @param {string|number} id - The ID under which the task will be saved in Firebase.
 * @returns {Promise<Response>} The fetch response object.
 */
function putTaskToFirebase(task, id) {
  return fetch(`${BASE_URL}tasks/${id}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
}

/**
 * Handles all actions after a successful task save.
 * Shows a toast message, resets the form, closes the overlay if present,
 * reloads tasks from Firebase, and redirects to the board page.
 *
 * @async
 * @returns {Promise<void>} Resolves once all post-save actions are complete.
 */
async function handleSuccessfulSave() {
  showToast("Task added to Board", "./assets/img/board.png");
  resetForm();
  if (document.getElementById("overlay")) closeOverlay();
  if (typeof loadTasksFromFirebase === "function") await loadTasksFromFirebase();
  setTimeout(() => (window.location.href = "board.html"), 1000);
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
 * Loads the contact list from Firebase and updates the global `Contacts` array.
 *
 * @async
 * @function
 * @returns {Promise<void>} A promise that resolves when contacts are successfully loaded and rendered.
 *
 * @throws {Error} Logs a warning if the fetch operation fails or if the returned data is not an array.
 */
async function loadContacts() {
  try {
    const res = await fetch(`${BASE_URL}contacts.json`);
    const data = await res.json();

    if (!Array.isArray(data)) {
      console.warn("⚠️ Contacts ist kein Array.");
      return;
    }

    Contacts = data;
    renderAssigneeDropdown();
  } catch (error) {
    console.warn("⚠️ Fehler beim Laden der Kontakte:", error);
  }
}

/**
 * Extracts initials from a contact name
 * @param {string} name - The contact's full name
 * @returns {string} Uppercase initials
 */
function getInitials(name) {
  return name
    .trim()
    .split(" ")
    .map((word) => word[0].toUpperCase())
    .join("");
}

/**
 * Returns a color from a predefined palette based on the first letter
 * @param {string} letter - The first letter of initials
 * @returns {string} Hex color code
 */
function getColor(letter) {
  const colorsArray = [
    "#FF6B6B",
    "#FF8C42",
    "#FFA500",
    "#FFD700",
    "#FFE600",
    "#B4FF00",
    "#4CAF50",
    "#00C853",
    "#00E5FF",
    "#00B8D4",
    "#1DE9B6",
    "#00CFAE",
    "#00BCD4",
    "#40C4FF",
    "#2196F3",
    "#3D5AFE",
    "#536DFE",
    "#7C4DFF",
    "#AB47BC",
    "#E040FB",
    "#FF4081",
    "#F50057",
    "#EC407A",
    "#FF1744",
    "#FF5252",
    "#D500F9",
    "#9C27B0",
  ];
  const index = (letter.toUpperCase().charCodeAt(0) - 65) % colorsArray.length;
  return colorsArray[index];
}

/**
 * Adds a new subtask to the list from the input field
 */
function addSubtask() {
  const input = document.getElementById("subtask");
  const value = input.value.trim();
  if (!value) return;

  const li = createSubtaskElement(value);
  document.getElementById("subtask-list").appendChild(li);
  input.value = "";
}

/**
 * Creates a subtask list element with edit and delete functionality
 * @param {string} value - The subtask text
 * @returns {HTMLElement} List item element for the subtask
 */
function createSubtaskElement(value) {
  const li = document.createElement("li");
  li.classList.add("subtask-item");

  li.innerHTML = `
        <span class="subtask-circle"></span>
        <span class="subtask-text">• ${value}</span>
        <input class="subtask-edit-input d-none" type="text" value="${value}">
        <div class="subtask-actions">
            <img src="./assets/icons/edit.svg" class="edit-subtask" title="Edit">
            <img src="./assets/icons/delete_icon.svg" class="delete-subtask" title="Delete">
        </div>
    `;

  addSubtaskEditHandler(li);
  addSubtaskDeleteHandler(li);
  li.addEventListener("dblclick", () => enterEditMode(li));
  return li;
}

/**
 * Adds edit functionality to a subtask item
 * @param {HTMLElement} li - The subtask list item element
 */
function addSubtaskEditHandler(li) {
  const editButton = li.querySelector(".edit-subtask");
  editButton.addEventListener("click", () => enterEditMode(li));
}