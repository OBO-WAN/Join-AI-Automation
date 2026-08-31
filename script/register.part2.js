/**
 * register.part2.js
 * Password helpers + auth / user presence / login-signup flow logic.
 * Requires register.part1.js to be loaded first.
 *
 */

/**
 *
 * @function getPasswordRefs
 * @description Determines and returns the appropriate password input field reference and error message reference
 * based on whether the context is the sign-up form or the login form.
 * @param {boolean} isSignUp - A boolean indicating whether the context is the sign-up form (`true`) or the login form (`false`).
 * @returns {object} - An object containing the password input field reference and the error message reference.
 * - `currentPasswordRef`: The HTML element reference for the password input field (either `passwordSignUpRef` or `passwordLogInRef`).
 * - `currentErrorMessageRef`: The HTML element reference for the corresponding password error message (either `errorMessagePasswordSignInRef` or `errorMessagePasswordLogInRef`).
 */


function getPasswordRefs(isSignUp) {
  const { passwordSignUpRef, passwordLogInRef, errorMessagePasswordSignInRef, errorMessagePasswordLogInRef } = getIdRefs();
  let currentPasswordRef;
  let currentErrorMessageRef;

  if (isSignUp) {
    currentPasswordRef = passwordSignUpRef;
    currentErrorMessageRef = errorMessagePasswordSignInRef;
  } else {
    currentPasswordRef = passwordLogInRef;
    currentErrorMessageRef = errorMessagePasswordLogInRef;
  }

  return { currentPasswordRef, currentErrorMessageRef };
}

/**
 * 
 * Handles the case when the password input field is empty.
 * Removes the error message display and the error class from the input field if they exist.
 * @param {HTMLElement | null} currentPasswordRef - The reference element of the password input field.
 * @param {HTMLElement | null} currentErrorMessageRef - The reference element of the error message display for the password.
 * @returns {boolean} - Returns true, as an empty field is considered "valid" in terms of the *minimum requirement* (actual validation for existence might occur elsewhere).
 */
function handleEmptyPassword(currentPasswordRef, currentErrorMessageRef,errorMessageLogInRef) {
  if (currentErrorMessageRef) {
      currentErrorMessageRef.classList.remove('d-flex');
  }
  if (errorMessageLogInRef) {
      errorMessageLogInRef.classList.remove('d-flex');
  }    
  if (currentPasswordRef) {
    currentPasswordRef.classList.remove('not-valide-error');
  }
  return true;
}

/**
 *
 * @function handlePasswordLengthValidation
 * @description Validates the length of a provided password. If the trimmed length is less than 8 characters,
 * it calls `showPasswordLengthError` to display an error message and add a visual error indicator.
 * Otherwise, it calls `clearPasswordLengthError` to hide the error message and remove the error indicator.
 * @param {string} trimmedPassword - The password string after leading and trailing whitespace has been removed.
 * @param {HTMLElement | null} currentPasswordRef - A reference to the HTML input element for the password.
 * @param {HTMLElement | null} currentErrorMessageRef - A reference to the HTML element displaying the password length error message.
 * @returns {boolean} - Returns `true` if the trimmed password length is 8 characters or more, otherwise returns `false`.
 */
function handlePasswordLengthValidation(trimmedPassword, currentPasswordRef, currentErrorMessageRef) {
  if (trimmedPassword.length < 8) {
    return showPasswordLengthError(currentPasswordRef, currentErrorMessageRef);
  } else {
    return clearPasswordLengthError(currentPasswordRef, currentErrorMessageRef);
  }
}

/**
 *
 * @function showPasswordLengthError
 * @description Displays the password length error message and adds the error class to the password input field.
 * @param {HTMLElement | null} currentPasswordRef - A reference to the HTML input element for the password.
 * @param {HTMLElement | null} currentErrorMessageRef - A reference to the HTML element displaying the password length error message.
 * @returns {boolean} - Returns `false` to indicate that the password length is invalid.
 */
function showPasswordLengthError(currentPasswordRef, currentErrorMessageRef) {
  if (currentErrorMessageRef) {
    currentErrorMessageRef.classList.add('d-flex');
  }
  if (currentPasswordRef) {
    currentPasswordRef.classList.add('not-valide-error');
  }
  return false;
}

/**
 *
 * @function clearPasswordLengthError
 * @description Clears the password length error message and removes the error class from the password input field.
 * @param {HTMLElement | null} currentPasswordRef - A reference to the HTML input element for the password.
 * @param {HTMLElement | null} currentErrorMessageRef - A reference to the HTML element displaying the password length error message.
 * @returns {boolean} - Returns `true` to indicate that the password length is valid (meets the minimum requirement).
 */
function clearPasswordLengthError(currentPasswordRef, currentErrorMessageRef) {
  if (currentErrorMessageRef) {
    currentErrorMessageRef.classList.remove('d-flex');
  }
  if (currentPasswordRef) {
    currentPasswordRef.classList.remove('not-valide-error');
  }
  return true;
}

/**
 * 
 * @function checkUserIsPresent
 * @description Asynchronously checks if any user data exists.
 * It attempts to load user data from the '/user' endpoint.
 * If user data is found, it extracts the user IDs and calls `checkUserIsPresentForLoob` and `showLoginError`.
 * @param {boolean} [parameter=false] - An optional boolean parameter that is passed to the `checkUserIsPresentForLoob` function.
 * @returns {Promise<boolean>} - Returns a Promise that resolves to `false` if user data is present (indicating an error condition for login in this context),
 * or `false` if an error occurs during data loading. It does not resolve to `true` in the current implementation.
 */
async function checkUserIsPresent(parameter = false) {
  try {
    const users = await loadData('/user');
    if (users) {
      const userIds = Object.keys(users);
     return checkUserIsPresentForLoob(users,userIds, parameter);
    }
    return false;
  } catch (error) {
    console.error('Error verifying user', error);
    return false;
  }
}

/**
 * @async
 * @function handleUserPresenceCheck
 * @description
 * Determines how to handle a user record depending on the context:
 * - **Sign-up mode (`parameter === true`)** → checks for duplicate email addresses
 *   using `ifParameterTrue`.
 * - **Login mode (`parameter === false`)** → compares the provided login credentials
 *   with the current user record. On a match, persists user session data and calls
 *   `loginSuccessful()`. On failure, highlights input fields and may display a
 *   generic login error message.
 *
 * @param {boolean} parameter - Context flag.
 *   - `true`: Sign-up flow (check for duplicate email).
 *   - `false`: Login flow (validate email + password).
 * @param {Object} user - The user object to validate against.
 * @param {string} user.email - The user's email address.
 * @param {string} user.password - The user's password.
 * @param {string} [user.initials] - Optional user initials (stored on successful login).
 * @param {string} [user.firstname] - Optional user first name (stored on successful login).
 * @param {string} [user.lastname] - Optional user last name (stored on successful login).
 * @param {string} userId - Unique identifier of the user (used to persist the session).
 *
 * @returns {Promise<boolean>} Resolves to:
 *   - `true` → if the email is already registered (sign-up) OR credentials are valid (login).
 *   - `false` → if the email is free (sign-up) OR credentials are invalid (login).
 *
 * @throws {Error} Propagates unexpected errors from dependent functions like `loadUserData`.
 */

async function handleUserPresenceCheck(parameter, user, userId) {
  if (parameter) return ifParameterTrue(parameter, user);
  const { emailLogIn, passwordLogIn } = setIdRefValueTrimLogIn();

  if (credentialsMatch(user, emailLogIn, passwordLogIn)) {
    return onLoginSuccess(userId, user);
  }

  showLoginFieldErrors();
  maybeShowGenericLoginError();
  return false;
}

function credentialsMatch(user, email, password) {
  return user?.email === email && user?.password === password;
}

function persistLoggedInUser(userId, user) {
  sessionStorage.setItem('loggedInUserId', userId);
  if (user) {
    if (user.initials)   sessionStorage.setItem('userInitials', user.initials);
    if (user.firstname)  sessionStorage.setItem('firstName', user.firstname);
    if (user.lastname)   sessionStorage.setItem('lastName', user.lastname);
  }
}

function showLoginFieldErrors() {
  const { emailLogInRef, passwordLogInRef } = getIdRefs();
  emailLogInRef?.classList.add('not-valide-error');
  passwordLogInRef?.classList.add('not-valide-error');
}

function maybeShowGenericLoginError() {
  const {
    errorMessageLogInRef,
    errorMessageEmailNotValideLoginRef,
    errorMessagePasswordLogInRef
  } = getIdRefs();

  const isEmailErrorVisible = isErrorVisible(errorMessageEmailNotValideLoginRef);
  const isPasswordErrorVisible = isErrorVisible(errorMessagePasswordLogInRef);

  handleGenericLoginErrorDisplay(
    errorMessageLogInRef,
    isEmailErrorVisible,
    isPasswordErrorVisible
  );
}

async function onLoginSuccess(userId, user) {
  const { loginFormRef } = getIdRefs();
  persistLoggedInUser(userId, user);
  await loadUserData();
  loginFormRef?.reset();
  loginSuccessful();
  return true;
}

function loginSuccessful() {
  window.location.href = "summary.html";
}

/**
 *
 * @async
 * @function checkUserIsPresentForLoob
 * @description Iterates through a list of user IDs and checks for user presence using the `handleUserPresenceCheck` function.
 * It returns true as soon as a user check returns true.
 * @param {object} users - An object containing user data, where keys are user IDs and values are user objects.
 * @param {string[]} userIds - An array of user IDs to iterate through.
 * @param {boolean} parameter - A boolean flag passed to `handleUserPresenceCheck` to determine the type of check.
 * @returns {Promise<boolean>} - Returns `true` if any user check returns true, `false` otherwise.
 */
async function checkUserIsPresentForLoob(users, userIds, parameter) {
  for (let index = 0; index < userIds.length; index++) {
    const userId = userIds[index];
    const user = users[userId];
    if (await handleUserPresenceCheck(parameter, user, userId)) {
      return true;
    }
  }
  return false;
}

/**
 * 
 * @function ifParameterTrue
 * @description Checks if a given parameter is true. If it is, it compares the provided user's email with the trimmed value from the signup email input field.
 * If the emails match, it displays an error message and visually indicates an error on the email input field.
 * @param {*} parameter - The parameter to check for truthiness.
 * @param {object} user - An object containing the user's email property.
 * @returns {boolean|void} - Returns `true` if the parameter is true and the emails match. Returns `void` otherwise.
 * 
 */
function ifParameterTrue(parameter, user) {
  const { email } = setIdRefValueTrimSignUp();
  const { emailSignUpRef, errorMessageEmailRef } = getIdRefs();
  if (parameter) {
    if (user.email === email) {
      errorMessageEmailRef.classList.add('d-flex');
      emailSignUpRef.classList.add('not-valide-error');
      return true; 
    }
  }
  return false; 
}

/**
 * 
 * @function ifParameterFalse
 * @description Checks if a given parameter is false. If it is, it compares the provided user's email and password with the values in the login input fields.
 * If they match, it clears the login input fields, stores the user ID in sessionStorage, loads user data, and indicates a successful login.
 * @param {*} parameter - The parameter to check for falsiness.
 * @param {object} user - An object containing the user's email and password properties.
 * @param {string} userId - The ID of the user to store in sessionStorage upon successful login.
 * @returns {Promise<boolean|void>} - Returns `true` if the parameter is false and the login is successful. Returns `void` otherwise.
 * 
 */
async function ifParameterFalse(parameter, user, userId) {
  const { emailLogIn, passwordLogIn } = setIdRefValueTrimLogIn();
  const { loginFormRef } = getIdRefs();
  if (!parameter) {
    if (user.email === emailLogIn && user.password === passwordLogIn) {
      sessionStorage.setItem('loggedInUserId', userId);
      await loadUserData();
      loginFormRef.reset();
      loginSuccessful();
      return true; 
    } else {
      showLoginError();
    }
  }
  return false; 
}

function showLoginError() {
  const {
    errorMessageLogInRef,
    emailLogInRef,
    passwordLogInRef
  } = getIdRefs();

  if (errorMessageLogInRef) {
    errorMessageLogInRef.classList.add('d-flex');
  }

  if (emailLogInRef) {
    emailLogInRef.classList.add('not-valide-error');
  }
  if (passwordLogInRef) {
    passwordLogInRef.classList.add('not-valide-error');
  }
}

/**
 * 
 * @function removeLoginError
 * @description Retrieves references to the login error message, email input, and password input elements using `getIdRefs()`.
 * It then removes the 'd-flex' class from the error message to hide it and the 'not-valide-error' class from both the email and password input fields to remove the error indication.
 *
 */
function removeLoginError(){
    const { errorMessageLogInRef, passwordLogInRef, emailLogInRef } = getIdRefs();
    errorMessageLogInRef.classList.remove('d-flex');
    emailLogInRef.classList.remove('not-valide-error');
    passwordLogInRef.classList.remove('not-valide-error');
}

function isErrorVisible(el) {
  if (!el) return false;
  if (el.classList.contains('d-flex') || el.classList.contains('show-error')) return true;

  const cs = window.getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
}