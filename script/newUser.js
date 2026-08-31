/**
 * 
 * @function setIdRefValueTrimSignUp
 * @description Retrieves the values from the name, email, password, and confirm password input fields
 * in the sign-up form, trims any leading or trailing whitespace from each, and returns them as an object.
 * @returns {object} - An object containing the trimmed values of the sign-up form fields:
 * - `name`: The trimmed value of the name input field.
 * - `email`: The trimmed value of the email input field.
 * - `password`: The trimmed value of the password input field.
 * - `confirmPassword`: The trimmed value of the confirm password input field.
 */
function setIdRefValueTrimSignUp() {
    return {
      name: document.getElementById('name_sign_up').value.trim(),
      email: document.getElementById('email_sign-up').value.trim(),
      password: document.getElementById('password_sign_up').value.trim(),
      confirmPassword: document.getElementById('confirm_sign_up').value.trim(),
    };
}

/**
 * 
 * @async
 * @function handleSignUp
 * @description Asynchronously handles the sign-up process. It retrieves user input values (name, email, password),
 * creates profile data, checks if the password confirmation is valid, and then attempts to create a new user.
 * Upon successful user creation, it calls the `handleSignUpSuccess` function. If any error occurs during the process,
 * it logs the error to the console.
 * @returns {void} - This function does not return a value directly but performs asynchronous operations
 * that may result in user creation or an error.
 */
async function handleSignUp() {
    const { name, email, password} = setIdRefValueTrimSignUp();
    try {
      const nameParts = name.split(' ');
      const profileData = await createUserProfileDataFromParts(nameParts);
      if (!checkPasswordConfirm()) return;
      await createUser(profileData.firstName, profileData.lastName, email, password, profileData.randomColor, profileData.initials);
      handleSignUpSuccess(profileData);
    } catch (error) {
      console.error('Error creating user', error);
    }
}

/**
 * 
 * @function checkNamePartsLength
 * @description Checks if the provided array of name parts contains exactly two elements (first name and last name).
 * If the array does not have exactly two elements, it displays an error message and visually indicates an error
 * on the name input field.
 * @param {string[]} nameParts - An array of strings representing the parts of a user's name.
 * @returns {boolean} - Returns `true` if the `nameParts` array has exactly two elements, and `false` otherwise.
 */
function checkNamePartsLength(nameParts) {
    const { nameSignUpRef, errorMessageNameRef } = getIdRefs();
    if (nameParts.length !== 2) {
      errorMessageNameRef.classList.add('d-flex');
      nameSignUpRef.classList.add('not-valide-error');
      return false;
    }
    return true;
}

/**
 *
 * @function getNameInputData
 * @description Extracts the name value from the provided input field, trims any leading or trailing whitespace,
 * and splits the trimmed name into an array of parts based on whitespace.
 * @param {HTMLInputElement} nameInputField - The HTML input element for the name.
 * @returns {object} - An object containing the original name, the trimmed name, and an array of name parts.
 * - `name`: The original value of the name input field.
 * - `trimmedName`: The name value with leading and trailing whitespace removed.
 * - `nameParts`: An array of strings, where each element is a part of the trimmed name separated by one or more whitespace characters. Empty parts are filtered out.
 */
function getNameInputData(nameInputField) {
    const name = nameInputField.value;
    const trimmedName = name.trim();
    const nameParts = trimmedName.split(/\s+/).filter(part => part !== '');
    return { name, trimmedName, nameParts };
  }

/**
 *
 * @function validateName
 * @description Validates the name input field. It checks if the trimmed name is not empty and consists of exactly two parts (first and last name).
 * It updates the visual feedback (error message and input field styling) based on the validation result.
 * @param {HTMLInputElement} nameInputField - The input element for the name.
 * @returns {boolean} - Returns true if the name is valid, false otherwise.
 */
function validateName(nameInputField) {
    const { nameSignUpRef, errorMessageNameRef } = getIdRefs();
    const { name, trimmedName, nameParts } = getNameInputData(nameInputField);
  
    if (trimmedName === '') {
      errorMessageNameRef.classList.remove('d-flex');
      nameSignUpRef.classList.remove('not-valide-error');
      return false;
    }
  
    if (name !== trimmedName || nameParts.length !== 2) {
      errorMessageNameRef.classList.add('d-flex');
      nameSignUpRef.classList.add('not-valide-error');
      return false;
    } else {
      errorMessageNameRef.classList.remove('d-flex');
      nameSignUpRef.classList.remove('not-valide-error');
      return true;
    }
}

/**
 * 
 * @function createUserProfileDataFromParts
 * @description **This function is called by `handleSignUp` to generate user profile data.**
 * It takes an array of name parts, extracts the first and last names, asynchronously fetches a random color,
 * and generates the user's initials. It returns an object containing these generated properties.
 * @param {string[]} nameParts - An array containing the parts of the user's name (e.g., ["John", "Doe"]).
 * @returns {Promise<object>} - A Promise that resolves to an object containing `firstName`, `lastName`, `randomColor`, and `initials`.
 */
async function createUserProfileDataFromParts(nameParts){
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    const randomColor = await getRandomColor();
    const initials = firstName[0].toUpperCase() + lastName[0].toUpperCase();
    return { firstName, lastName, randomColor, initials };
}

/**  TO BE ACTUALIZED
 * 
 * @function handleSignUpSuccess
 * @description **This function is called by `handleSignUp` after a successful user creation.**
 * It triggers the display of a sign-up success popup using `showPupupOverlaySignUp` and then initiates
 * a delayed redirection and form reset using `delayedRedirectAndReset`.
 */

function handleSignUpSuccess(profileData){
    showPupupOverlaySignUp();
    sessionStorage.setItem('userInitials', profileData.initials);
    sessionStorage.setItem('firstName', profileData.firstName);
    sessionStorage.setItem('lastName', profileData.lastName);
    delayedRedirectAndReset();
    delayedRedirectAndReset();
}

/**
 * 
 * @function createUser
 * @description Asynchronously sends user data to the '/user' endpoint using the `postData` function.
 * It constructs a new user object with the provided details and handles potential errors during the data posting process.
 * @param {string} firstname - The first name of the user.
 * @param {string} lastname - The last name of the user.
 * @param {string} email - The email address of the user.
 * @param {string} password - The password of the user.
 * @param {string} randomColor - A randomly generated color associated with the user.
 * @param {string} initials - The initials of the user (e.g., first and last name initials).
 */
async function createUser(firstname, lastname, email, password, randomColor, initials) {
    const newUser = { firstname, lastname, email, password, randomColor, initials };
    try {
      await postData('/user', newUser);
    } catch (error) {
      console.error('Error posting data', error);
    }
}

/**
 * 
 * @function toggleCheckbox
 * @description Toggles the state of a checkbox and updates its visual representation by changing the source and alt text of a custom checkmark image.
 * It also calls the `enableOrDisableSignUpButton` function to update the state of the sign-up button based on the checkbox's new state.
 * @param {HTMLElement | boolean} [element=false] - An optional HTML element. If provided and truthy, the checkbox will be unchecked before toggling.
 * @returns {void} - This function does not return any value directly. It modifies the state and appearance of the checkbox and potentially the sign-up button.
 */
function toggleCheckbox(element = false) {
    const { checkboxRef, customCheckmarkRef } = getIdRefs();
    if (element) checkboxRef.checked = false;
    checkboxRef.checked;
    if (checkboxRef.checked) {
      customCheckmarkRef.src = 'assets/icons/checkbox-checked.svg';
      customCheckmarkRef.alt = 'Checkbox Checked';
    } else {
      customCheckmarkRef.src = 'assets/icons/checkbox-empty.svg';
      customCheckmarkRef.alt = 'Checkbox not Checked';
    }
    enableOrDisableSignUpButton();
}

/**
 * 
 * @async
 * @function enableOrDisableSignUpButton
 * @description Asynchronously enables or disables the sign-up button based on the validation status of the sign-up input fields
 * (name, email, password, confirm password), the checked state of the terms and conditions checkbox,
 * and whether the entered email address already exists. It calls `validateSignUpInputs` to retrieve the validation statuses
 * and `checkUserIsPresent` to check for existing users.
 * @returns {void} - This function does not return a value directly but modifies the `disabled` property of the sign-up button.
 */
async function enableOrDisableSignUpButton() {
    const { signUpButtonRef } = getIdRefs();
    const { isNameValid, isEmailValid, isPasswordValid, isConfirmValid, isCheckboxChecked } = validateSignUpInputs();
    let isEmailAlreadyExists = false;
    if (isNameValid && isEmailValid && isPasswordValid && isConfirmValid && isCheckboxChecked) {
      isEmailAlreadyExists = await checkUserIsPresent(true);
    }
    if (isNameValid && isEmailValid && isPasswordValid && isConfirmValid && isCheckboxChecked && !isEmailAlreadyExists) {
      signUpButtonRef.disabled = false;
    } else {
      signUpButtonRef.disabled = true;
    }
}

/**
 * 
 * @function validateSignUpInputs
 * @description Retrieves references to the sign-up input fields and performs individual validation checks for name, email, password,
 * confirm password, and the terms and conditions checkbox. It returns an object containing the boolean results of each validation.
 * @returns {object} - An object containing the validation statuses for each input field:
 * - `isNameValid`: Boolean indicating if the name input is valid.
 * - `isEmailValid`: Boolean indicating if the email input is valid.
 * - `isPasswordValid`: Boolean indicating if the password input is valid.
 * - `isConfirmValid`: Boolean indicating if the confirm password input matches the password.
 * - `isCheckboxChecked`: Boolean indicating if the terms and conditions checkbox is checked.
 */
function validateSignUpInputs() {
    const { nameSignUpRef, emailSignUpRef, passwordSignUpRef, confirmPasswordSignUpRef, checkboxRef } = getIdRefs();
    const isNameValid = validateName(nameSignUpRef);
    const isEmailValid = validateEmail(emailSignUpRef, true);
    const isPasswordValid = validatePassword(passwordSignUpRef, true);
    const isConfirmValid = checkPasswordConfirm(confirmPasswordSignUpRef);
    const isCheckboxChecked = checkboxRef.checked;
    return {
      isNameValid,
      isEmailValid,
      isPasswordValid,
      isConfirmValid,
      isCheckboxChecked,
    };
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