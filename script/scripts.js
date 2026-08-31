let randomColorsJson = null;

/**
 * 
 * @function startProcess
 * @description Initializes the application by loading the header, initializing the board,
 * and loading the random colors. It sequentially awaits the completion of each of these asynchronous operations.
 */
async function startProcess() {
 await loadHeaderAndInitialize()
  initBoard()
  await initializeRandomColors();
}

/**
 * 
 * @function initializeRandomColors
 * @description Asynchronously loads the `randomColorsJson` data. If loading is successful,
 * the data is stored in the global `randomColorsJson` variable. If loading fails,
 * an error message is logged to the console.
 */
async function initializeRandomColors() {
  try {
    randomColorsJson = await loadData('randomColorsJson');
    if (!randomColorsJson) {
      console.error('Failed to load randomColorsJson.');
    }
  } catch (error) {
    console.error('Error initializing randomColorsJson', error);
  }
}

/**
 * 
 * @function showConfirmation
 * @description Displays a confirmation popup with the given message and returns a Promise
 * that resolves with a boolean value indicating whether the user confirmed (true) or canceled (false).
 * It internally uses the `showConfirmPopup` function.
 * @param {string} message - The message to display in the confirmation popup.
 * @returns {Promise<boolean>} A Promise that resolves with `true` if the user confirms, and `false` otherwise.
 */
function showConfirmation(message) {
  return new Promise((resolve) => {
    showConfirmPopup(message, (confirmed) => {
      resolve(confirmed);
    });
  });
}

/**
 * 
 * @function showConfirmPopup
 * @description Displays a custom confirmation popup with the specified message and provides "Yes" and "No" buttons.
 * It takes a callback function that is executed with a boolean argument (`true` for "Yes", `false` for "No")
 * when the user clicks a button.
 * @param {string} msg - The message to display in the confirmation popup.
 * @param {function(boolean)} callback - A callback function that accepts a boolean argument
 * indicating the user's choice (true for Yes, false for No).
 */
function showConfirmPopup(msg, callback) {
  const p = document.querySelector('.confirm-popup'),
        m = p.querySelector('.confirm-message'),
        y = p.querySelector('.confirm-yes'),
        n = p.querySelector('.confirm-no');
  m.textContent = msg; p.classList.remove('hidden'); p.classList.add('active');
  y.onclick = () => { p.classList.add('hidden'); p.classList.remove('active'); callback(true); };
  n.onclick = () => { p.classList.add('hidden'); p.classList.remove('active'); callback(false); };
}

/**
 *
 * @async
 * @function getRandomColor
 * @description Asynchronously loads random color data and processes it to retrieve a single random color.
 * It handles potential errors during the data loading process.
 * @returns {Promise<string|null>} - A promise that resolves with a randomly selected color (string) if successful, or null if an error occurs during loading or processing.
 */

async function getRandomColor() {
  try {
    const randomColorsData = await loadData('randomColorsJson');
    return await processColorsData(randomColorsData);
  } catch (error) {
    console.error('Error getting random color:', error);
    return null;
  }
}

/**
 *
 * @async
 * @function processColorsData
 * @description Processes the JSON data containing random colors, extracting the key and the array of colors.
 * It performs checks for the existence of the JSON data, the key within it, and the availability of colors in the array.
 * If the data is valid, it calls the function to select and update a color.
 * @param {object|null} randomColorsJson - The JSON object containing the random colors, or null if loading failed.
 * @returns {Promise<string|null>} - A promise that resolves with the randomly selected color (string) if processing is successful, or null if any validation fails.
 */
async function processColorsData(randomColorsJson) {
  if (!randomColorsJson) return null;

  const key = Object.keys(randomColorsJson)[0];
  if (!key) {
    console.error('No key found in randomColorsJson.');
    return null;
  }

  const singleColorFromJson = randomColorsJson[key];
  if (!singleColorFromJson || singleColorFromJson.length === 0) {
    console.error('No more colors available or invalid data from Firebase');
    return null;
  }

  return await selectAndUpdateColor(key, singleColorFromJson);
}

/**
 *
 * @async
 * @function selectAndUpdateColor
 * @description Selects a random color from an array, removes it, and updates the remaining colors in Firebase.
 * @param {string} key - The key in the Firebase database where the color array is stored.
 * @param {Array<string>} colorsArray - An array of color strings.
 * @returns {Promise<string|null>} - A promise that resolves with the randomly selected color (string) if the update is successful, or null if the update fails.
 */
async function selectAndUpdateColor(key, colorsArray) {
  const randomIndex = Math.floor(Math.random() * colorsArray.length);
  const selectedColor = colorsArray[randomIndex];
  colorsArray.splice(randomIndex, 1);
  const updateResult = await updateData(`randomColorsJson/${key}`, colorsArray);

  if (!updateResult) {
    console.error('Failed to update colors in Firebase.');
    return null;
  }

  return selectedColor;
}

/**
 * 
 * @function getIdRefsScript
 * @description Retrieves references to various HTML elements by their IDs that are specific to the add task functionality in script.js.
 * @returns {object} An object containing references to specific DOM elements related to adding tasks.
 */
function getIdRefsScript() {
  return {
    h1AddTaskRef: document.getElementById('h1_add_task'),
    footerddTaskRef: document.getElementById('footer_add_task'),
    verticalLineRef: document.getElementById('vertical_line'),
    addTaskContentRef: document.getElementById('add_task_content'),
    rightContainerRef: document.getElementById('right_container'),
    leftContainerRef: document.getElementById('left_container'),
    addTaskfetchTemplateRef: document.getElementById('add_task_fetch_template'),
  };
}

/**
 * 
 * @type {boolean}
 * @default false
 * @description Controls the visibility state of the button links sidebar.
 * Setting this global variable to `true` will show the sidebar, and setting it to `false` will hide it.
 */
window.showButtonLinksSidebar = false;

/**
 * 
 * @function goToUrl
 * @description Navigates the browser to the specified URL by setting the `window.location.href` property.
 * @param {string} url - The URL to navigate to.
 */
function goToUrl(url) {
  window.location.href = url;
}

/**
 * 
 * @function guestLogIn
 * @description Simulates a guest login by calling the `loginSuccessful` function.
 */
function guestLogIn() {
  loginSuccessful()
}

/**
 * 
 * @function loginSuccessful
 * @description Handles the actions to be performed after a successful login.
 * It sets the 'loggedIn' flag in sessionStorage to 'true', sets the `window.showButtonLinksSidebar`
 * to `true`, stores this boolean value in sessionStorage under the key 'linksSidebarBoolienKey',
 * and then navigates the user to the 'summary.html' page.
 */
function loginSuccessful() {
  sessionStorage.setItem('loggedIn', 'true');
  window.showButtonLinksSidebar = true;
  sessionStorage.setItem('linksSidebarBoolienKey', window.showButtonLinksSidebar);
  goToUrl('summary.html'); 
}

/**
 * 
 * @function logOut
 * @description Handles the logout process. It sets the `window.showButtonLinksSidebar` to `false`,
 * updates the 'linksSidebarBoolienKey' in sessionStorage, removes 'loggedIn', 'loggedInUserId',
 * and 'activePage' from sessionStorage, and then navigates the user back to the 'log_in.html' page.
 */

function logOut() {

  goToUrl('index.html');

  window.showButtonLinksSidebar = false;
  sessionStorage.setItem('linksSidebarBoolienKey', window.showButtonLinksSidebar);

  sessionStorage.removeItem('loggedIn');
  sessionStorage.removeItem('loggedInUserId');
  sessionStorage.removeItem('activePage');
  sessionStorage.removeItem('firstName');
  sessionStorage.removeItem('lastName');
  sessionStorage.removeItem('userInitials');
}

/**
 * 
 * @function hideLoggedInLinks
 * @description Hides HTML elements with the class 'hide-before-log-in' by adding the 'd-none' class to them.
 * This is typically used to hide links or sections that should only be visible to logged-in users.
 */
function hideLoggedInLinks() {
  const htmlLinks = document.getElementsByClassName('hide-before-log-in');

  Array.from(htmlLinks).forEach((element) => {
    element.classList.add('d-none');
  });
}

/**
 * 
 * @function showLoggedInLinks
 * @description Shows HTML elements with the class 'hide-before-log-in' by removing the 'd-none' class,
 * and hides elements with the class 'hide-after-log-in' and 'mobil-view-links-container' by adding the 'd-none' class.
 * This is used to dynamically adjust the visibility of links based on the login status.
 */
function showLoggedInLinks() {
  const htmlLinks = document.getElementsByClassName('hide-before-log-in');
  const loggedInLink = document.getElementsByClassName('hide-after-log-in');
  const mobilViewLinksContainer = document.getElementsByClassName('mobil-view-links-container');

  Array.from(htmlLinks).forEach((element) => {
    element.classList.remove('d-none');
  });

  Array.from(loggedInLink).forEach((element) => {
    element.classList.add('d-none');
  });

  Array.from(mobilViewLinksContainer).forEach((element) => {
    element.classList.add('d-none');
  });
}

/**
 * 
 * @function loadUserData
 * @description Asynchronously loads user data based on the 'loggedInUserId' stored in sessionStorage.
 * If a user ID is found, it attempts to fetch the user data from the `/user/${userId}` endpoint.
 * If the data is successfully loaded, it calls `removeLoginError` and returns the user object.
 * If the user data is not found or an error occurs, it logs an error and returns an object with `initials: null`.
 * If no 'loggedInUserId' is found in sessionStorage, it also returns `{ initials: null }`.
 * @returns {Promise<object>} A Promise that resolves with the user data object if found,
 * or an object `{ initials: null }` if not found or an error occurs.
 */
async function loadUserData() {
  const userId = sessionStorage.getItem('loggedInUserId');
  if (userId) {
    try {
      const user = await loadData(`/user/${userId}`);
      if (user) {
        return user;
      } else {
        console.error('User data not found.');
        return { initials: null };
      }
    } catch (error) {
      console.error('Error loading user data', error);
      return { initials: null };
    }
  } else {
    return { initials: null };
  }
}

/**
 * 
 * @function back
 * @description Navigates the browser to the previous page in the history.
 */
function back() {
  window.history.back();
}

/**
 * 
 * @function showPupupOverlaySignUp
 * @description Displays a popup overlay for sign-up confirmation by adding the 'd-flex' class.
 * After a short delay (1000 milliseconds), it removes the 'd-flex' class to hide the overlay.
 */
function showPupupOverlaySignUp() {
  const { popupOverlaySignUpRef } = getIdRefs();
  popupOverlaySignUpRef.classList.add('d-flex');
  setTimeout(function () {
    popupOverlaySignUpRef.classList.remove('d-flex');
  }, 1000);
}

/**
 * 
 * @function setAllPropertysForEditPopup
 * @description Modifies the styles and classes of various HTML elements to adapt the add task form
 * for use as an edit popup on the board. It hides the main header and footer, the vertical line,
 * adjusts the content layout, and sets overflow properties for the container elements.
 */
function setAllPropertysForEditPopup() {
  const { h1AddTaskRef, footerddTaskRef, verticalLineRef, addTaskContentRef, rightContainerRef, leftContainerRef, addTaskfetchTemplateRef } = getIdRefsScript();

  h1AddTaskRef.classList.add('d-none');
  footerddTaskRef.classList.add('d-none');
  verticalLineRef.classList.add('d-none');
  addTaskContentRef.classList.remove('add-task-content');
  addTaskContentRef.classList.add('add-task-content-board-popup');
  rightContainerRef.style.overflowX = 'unset';
  rightContainerRef.style.overflowY = 'unset';
  leftContainerRef.style.overflowX = 'unset';
  leftContainerRef.style.overflowY = 'unset';
  leftContainerRef.style.marginBottom = '24px';
  addTaskfetchTemplateRef.classList.add('overflow-y');
}

/**
 *
 * @function isTaskFormValid
 * @description Checks the validity of the task form by validating the title, date, and category fields.
 * It calls the individual validation functions for each field and returns true only if all fields are valid.
 * @returns {boolean} - Returns true if all task form fields are valid, false otherwise.
 */
function isTaskFormValid() {
  const titleValid = validateInputTitle();
  const dateValid = validateInputDate();
  const categoryValid = validateCategory();
  return titleValid && dateValid && categoryValid;
}

/**
 *
 * @function handleTaskSubmit
 * @description Handles the submission of a task, determining whether it's a new task being added on the board or a task being added through the main form.
 * It validates the task form and then calls the appropriate function to push the task data to Firebase based on the visibility of the board's add task section.
 */
function handleTaskSubmit() {
  const isBoardAddTask = document.getElementById('board_add_task');
  const isVisible = isBoardAddTask && isBoardAddTask.style.display !== 'none';

  if (!isTaskFormValid()) return;

  if (isVisible) {
    pushBoardTaskToFirebase();
  } else {
    pushTaskToFirebase();
  }
}

/**
 *
 * @function validateField
 * @description Checks the validity of an input field and displays or hides an associated error message.
 * If invalid, it adds the CSS class 'not-valide-error' to the input field and displays the element with the class 'error-message-log-in' in the parent element.
 * If valid, it removes the CSS class and hides the error message again.
 * @param {HTMLInputElement} inputField - The input field to validate (of type HTMLInputElement).
 */
function validateField(inputField) {
  if (!inputField.checkValidity()) {
    inputField.classList.add('not-valide-error');
    const errorMessage = inputField.parentNode.querySelector('.error-message-log-in');
    if (errorMessage) {
      errorMessage.style.display = 'block';
    }
  } else {
    inputField.classList.remove('not-valide-error');
    const errorMessage = inputField.parentNode.querySelector('.error-message-log-in');
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }
}