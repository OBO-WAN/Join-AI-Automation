/**
 * Generates the HTML string for a single task card displayed on the Kanban board.
 * 
 * The card includes task category, title, description, assigned user avatars,
 * priority icon, and an empty container for subtask progress (populated later by JS).
 * It also includes drag-and-drop attributes and a click event hook to open the overlay.
 * 
 * Used in rendering logic such as `renderCurrentTasks()` in board.js.
 * 
 * @function getKanbanTemplate
 * @param {Object} task - The task object to render.
 * @param {string} task.id - Unique identifier for the task.
 * @param {string} task.category - Task category (e.g., "Technical Task").
 * @param {string} task.categoryClass - CSS class applied to the category label.
 * @param {string} task.title - Task title.
 * @param {string} task.details - Task description/details.
 * @param {string} task.priority - Task priority (e.g., "low", "medium", "urgent").
 * @param {Array<Object>} assignedUsersHTML - Pre-rendered user initials HTML string.
 * @param {number} index - Index of the task in the current list (used for DOM targeting).
 * 
 * @returns {string} - HTML string representing a Kanban board task card.
 * 
 * @example
 * const cardHTML = getKanbanTemplate(task, assignedHTML, 3);
 * document.getElementById('toDoContainer').innerHTML += cardHTML;
 */
function getKanbanTemplate(task, assignedUsersHTML, index) {
  return `    <div class="task_container hover" data-task-id="${task.id}" data-task-index="${index}" draggable="true" ondragstart="startDragging('${task.id}', event)">
                    
                    <div class="task">
                        <div class="task_category ${task.categoryClass}">${task.category}</div>

                        <div class="task_information">
                            <p class="task_title" id="task_title">${task.title}</p>
                            <p class="task_details" id="task_details">${task.description}</p>
                        </div>

                        <div id="subtask_container_${index}" class="subtask_container"></div>

                        <div class="user_priority_container">
                            <div class="user_initials">${assignedUsersHTML}</div>
                            <img src="./assets/icons/priority/priority_${task.priority}.png" class="priority_medium" id="priority">
                        </div>

                    </div>
                </div>

`;
}

/**
 * Generates the HTML template for the Add Task overlay form
 * @returns {string} HTML string for the add task overlay with form fields, dropdowns, and buttons
 */

function getAddTaskOverlay(type = "add") {
  const formClass = type === "edit" ? "form-grid-edit" : "form-grid-add";
  const headline = type === "edit" ? "Edit Task" : "Add Task";
  const buttonText = type === "edit" ? "Save Changes" : "Create Task";

  return `
    <div class="overlay-content">
      <div class="add-task-container-overlay">
        <div class="add-task-title">
          <h2>${headline}</h2> 
          <button onclick="closeOverlay()" class="close_button_task hover">X</button>
        </div>
        <form id="taskForm" class="${formClass}">

          <div class="form-left">
            <label for="title">Title <span class="required-marker">*</span></label>
            <input type="text" id="title" name="title" placeholder="Enter a title" required>
            <div class="field-error-message" id="error-title">This field is required</div>

            <label for="description">Description</label>
            <textarea id="description" name="description" rows="4" placeholder="Enter a Description"></textarea>

            <label for="due-date">Due Date <span class="required-marker">*</span></label>
            <input type="date" id="due-date" name="due-date" required>
            <div class="field-error-message" id="error-due-date">This field is required</div>
          </div>

          <div class="form-right">
            <label>Priority</label>
            <div class="priority-options">
              <input type="radio" id="priority-urgent" name="priority" value="urgent">
              <label for="priority-urgent" class="priority-button urgent">
                Urgent <img src="./assets/icons/priority/priority_urgent.png" alt="Urgent icon">
              </label>

              <input type="radio" id="priority-medium" name="priority" value="medium" checked>
              <label for="priority-medium" class="priority-button medium">
                Medium <img src="./assets/icons/priority/priority_medium.png" alt="Medium icon">
              </label>

              <input type="radio" id="priority-low" name="priority" value="low">
              <label for="priority-low" class="priority-button low">
                Low <img src="./assets/icons/priority/priority_low.png" alt="Low icon">
              </label>
            </div>

            <label>Assigned to</label>
            <div class="custom-multiselect">
              <div class="multiselect-header" onclick="toggleAssigneeDropdown()">
                <span id="selected-assignees-placeholder">Select contacts</span>
                <img src="assets/icons/arrow_drop_downaa.png" class="dropdown-icon">
              </div>
              <div class="multiselect-dropdown d-none" id="assignee-dropdown"></div>
              <div class="selected-assignee-avatars" id="selected-assignee-avatars"></div>
            </div>

            <label>Category <span class="required-marker">*</span></label>
            <div class="custom-category-select">
              <div class="category-select-header" onclick="toggleCategoryDropdown()">
                <span id="selected-category-placeholder">Select category</span>
                <img src="assets/icons/arrow_drop_downaa.png" class="dropdown-icon">
              </div>
              <div class="category-dropdown d-none" id="category-dropdown">
                <div class="category-option" onclick="selectCategory('technical-task')">Technical Task</div>
                <div class="category-option" onclick="selectCategory('user-story')">User Story</div>
              </div>
            </div>
            <input type="hidden" id="category" name="category" required>
            <div class="field-error-message" id="error-category">This field is required</div>

            <label for="subtask">Subtasks</label>
            <div class="subtask-input-container">
              <input type="text" id="subtask" placeholder="Add new subtask" onkeydown="handleSubtaskKey(event)">
              <button type="button" onclick="addSubtask()" class="subtask-add-btn">+</button>
            </div>
            <ul id="subtask-list"></ul>
          </div>
        </form>

        <div class="form-footer">
          <div class="form-hint">
            <span class="required-marker">*</span>This field is required
          </div>
          <div class="task-buttons">
            <button type="reset" class="clear-btn" id="clear-btn">
              Clear <span class="x-icon">X</span>
            </button>
            <button type="submit" class="create-btn">
              ${buttonText}
              <img src="./assets/icons/check.png" alt="Create Icon">
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates the HTML template for the task detail overlay/popup
 * @param {Object} task - The task object containing task details
 * @param {string} task.id - Unique identifier for the task
 * @param {string} task.category - Task category name
 * @param {string} task.categoryClass - CSS class for category styling
 * @param {string} task.title - Task title
 * @param {string} task.description - Task description
 * @param {string} assignedUsersHTML - Pre-rendered HTML string for assigned user avatars
 * @param {number} index - Index of the task in the current list
 * @param {string} formattedDate - Formatted due date string
 * @param {string} priority - Task priority level (low, medium, urgent)
 * @param {string} subtasksHTML - Pre-rendered HTML string for subtasks
 * @returns {string} HTML string for the task detail overlay
 */
function getTaskSheetOverlay(task, assignedUsersHTML, index, formattedDate, priority, subtasksHTML) {
  return `
    <div class="task_container_overlay hover">
      <div class="task_overlay">

        <div class="overlay_headline"> 
          <div class="task_category_overlay ${task.categoryClass}">${task.category}</div>
          <button onclick="closeOverlay()" class="close_button hover">X</button>
        </div>

        <div class="task_information_overlay">
          <p class="task_title_overlay" id="task_title">${task.title}</p>
          <p class="task_details_overlay" id="task_details">${task.description}</p>

          <table>
            <tr>
              <td>Due date:</td>
              <td class="td_right">${formattedDate}</td>
            </tr>
            <tr>
              <td>Priority:</td>
              <td class="td_priority">
                <p class="margin_right_10">${priority}</p>
                <img src="./assets/icons/priority/priority_${priority}.png" alt="${priority}">
              </td>
            </tr>
          </table>

          <div class="assigned_container">
            <p>Assigned to:</p>
            <div class="assigned_user">
              <div class="user_badge">
                <div class="user_initials_overlay">${assignedUsersHTML}</div>
              </div>
            </div>
          </div>

          <div id="subtask_container_${index}" class="subtask_container"></div>

          <div class="popup-subtasks">
            <span class="subtasks-label">Subtasks:</span>
            <div class="subtasks-list" id="subtasks-list-${index}">
              ${subtasksHTML}
            </div>
          </div>

          <div class="popup-actions">
            <div class="action-box delete" onclick="deleteTaskFromBoardPopup('${task.id}')">
              <div class="delete-icon">
                <img src="assets/icons/delete_icon.svg" alt="Delete" id="delete_icon">
              </div>
              <span class="delete-btn">Delete</span>
            </div>

            <div>
              <img src="assets/icons/vertical_line.svg" alt="divider">
            </div>

            <div class="action-box edit" onclick="editPopupTask('${task.id}')">
              <div class="edit-icon">
                <img src="assets/icons/edit.svg" alt="Edit" id="edit_icon">
              </div>
              <span class="edit-btn">Edit</span>
            </div>
          </div>

        </div>  
      </div>
    </div>
  `;
}

/**
 * Generates the HTML template for the Edit Task overlay (no <h2> headline)
 * Mirrors getAddTaskOverlay("edit") so existing prefill/validation work unchanged.
 * @returns {string}
 */
function getEditTaskOverlay() {
  const formClass = "form-grid-edit";
  const buttonText = "OK";

  return `
    <div class="overlay-content">
      <div class="add-task-container-overlay">
      <button onclick="closeOverlay()" class="close_button_edit hover">X</button>
        <form id="taskForm" class="\${formClass}">

          <div class="form-left">
            <label for="title">Title</label>
            <input type="text" id="title" name="title" placeholder="Enter a title" required>
            <div class="field-error-message" id="error-title">This field is required</div>

            <label for="description">Description</label>
            <textarea id="description" name="description" rows="4" placeholder="Enter a Description"></textarea>

            <label for="due-date">Due Date</label>
            <input type="date" id="due-date" name="due-date" required>
            <div class="field-error-message" id="error-due-date">This field is required</div>
          </div>

          <div class="form-right">
            <label>Priority</label>
            <div class="priority-options">
              <input type="radio" id="priority-urgent" name="priority" value="urgent">
              <label for="priority-urgent" class="priority-button urgent">
                Urgent <img src="./assets/icons/priority/priority_urgent.png" alt="Urgent icon">
              </label>

              <input type="radio" id="priority-medium" name="priority" value="medium" checked>
              <label for="priority-medium" class="priority-button medium">
                Medium <img src="./assets/icons/priority/priority_medium.png" alt="Medium icon">
              </label>

              <input type="radio" id="priority-low" name="priority" value="low">
              <label for="priority-low" class="priority-button low">
                Low <img src="./assets/icons/priority/priority_low.png" alt="Low icon">
              </label>
            </div>

            <label>Assigned to</label>
            <div class="custom-multiselect">
              <div class="multiselect-header" onclick="toggleAssigneeDropdown()">
                <span id="selected-assignees-placeholder">Select contacts</span>
                <img src="assets/icons/arrow_drop_downaa.png" class="dropdown-icon">
              </div>
              <div class="multiselect-dropdown d-none" id="assignee-dropdown"></div>
              <div class="selected-assignee-avatars" id="selected-assignee-avatars"></div>
            </div>

            <label>Category</label>
            <div class="custom-category-select">
              <div class="category-select-header" onclick="toggleCategoryDropdown()">
                <span id="selected-category-placeholder">Select category</span>
                <img src="assets/icons/arrow_drop_downaa.png" class="dropdown-icon">
              </div>
              <div class="category-dropdown d-none" id="category-dropdown">
                <div class="category-option" onclick="selectCategory('technical-task')">Technical Task</div>
                <div class="category-option" onclick="selectCategory('user-story')">User Story</div>
              </div>
            </div>
            <input type="hidden" id="category" name="category" required>
            <div class="field-error-message" id="error-category">This field is required</div>

            <label for="subtask">Subtasks</label>
            <div class="subtask-input-container">
              <input type="text" id="subtask" placeholder="Add new subtask" onkeydown="handleSubtaskKey(event)">
              <button type="button" onclick="addSubtask()" class="subtask-add-btn">+</button>
            </div>
            <ul id="subtask-list"></ul>
          </div>
        </form>

        <div class="form-footer-edit">
          <div class="task-buttons">
            <button type="reset" class="clear-btn" id="clear-btn">
              Clear <span class="x-icon">X</span>
            </button>
            <button type="submit" class="create-btn">
              ${buttonText}
              <img src="./assets/icons/check.png" alt="Create Icon">
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}