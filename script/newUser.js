/**
 * 
 * @function setIdRefValueTrimSignUp
 * @description Retrieves the values from the name, email, password, and confirm password input fields
 * in the sign-up form, trims the name and email, and preserves both password values exactly.
 * @returns {object} - An object containing the sign-up form values:
 * - `name`: The trimmed value of the name input field.
 * - `email`: The trimmed value of the email input field.
 * - `password`: The unchanged value of the password input field.
 * - `confirmPassword`: The unchanged value of the confirm password input field.
 */
function setIdRefValueTrimSignUp() {
    return {
      name: document.getElementById('name_sign_up').value.trim(),
      email: document.getElementById('email_sign-up').value.trim(),
      password: document.getElementById('password_sign_up').value,
      confirmPassword: document.getElementById('confirm_sign_up').value,
    };
}

let joinSignupMode = 'signup';
let joinSignupBusy = false;
let joinSignupUid = null;

function showSignUpStatus(message) {
    const status = document.getElementById('signup_status');
    status.textContent = message;
    status.classList.toggle('d-none', !message);
    document.getElementById('signup_login_link').classList.toggle('d-none', !message);
    document.getElementById('body_sign_up')?.classList.toggle('auth-status-visible', Boolean(message));
}

function renderSignUpMode(validate = true) {
    const profileMode = joinSignupMode !== 'signup';
    document.getElementById('signup_password_field').classList.toggle('d-none', profileMode);
    document.getElementById('signup_confirm_field').classList.toggle('d-none', profileMode);
    document.getElementById('email_sign-up').readOnly = profileMode || joinSignupBusy;
    document.getElementById('password_sign_up').disabled = joinSignupBusy;
    document.getElementById('confirm_sign_up').disabled = joinSignupBusy;
    document.getElementById('signup_heading').textContent = profileMode ? 'Profile' : 'Sign up';
    const labels = {
      signup: 'Sign up', profile: 'Save profile', checking: 'Checking profile…',
      'check-failed': 'Retry profile check', complete: 'Continue to summary',
      'login-required': 'Log in', finished: 'Completed',
    };
    document.getElementById('sign_up_button').textContent = labels[joinSignupMode];
    const editable = !joinSignupBusy && ['signup', 'profile'].includes(joinSignupMode);
    document.getElementById('name_sign_up').disabled = !editable;
    document.getElementById('checkbox').disabled = !editable;
    if (validate) enableOrDisableSignUpButton();
    else document.getElementById('sign_up_button').disabled = true;
}

async function initializeSignUpPage() {
    if (joinSignupBusy) return;
    const session = getStoredFirebaseAuth();
    if (!session?.localId) {
      joinSignupMode = new URLSearchParams(window.location.search).has('completeProfile')
        ? 'login-required' : 'signup';
      if (joinSignupMode === 'login-required') showSignUpStatus('Please log in to complete your JOIN profile.');
      renderSignUpMode(joinSignupMode !== 'signup');
      return;
    }
    joinSignupBusy = true;
    joinSignupUid = session.localId;
    joinSignupMode = 'checking';
    document.getElementById('email_sign-up').value = session.email;
    document.getElementById('password_sign_up').value = '';
    document.getElementById('confirm_sign_up').value = '';
    renderSignUpMode();
    try {
      const profile = await window.loadJoinUserProfile(session.localId);
      requireJoinProfileSession(session.localId);
      joinSignupMode = profile ? 'complete' : 'profile';
      showSignUpStatus(profile ? 'Your JOIN profile is complete.' : 'Your account exists. Please complete your JOIN profile.');
    } catch (error) {
      joinSignupMode = getStoredFirebaseAuth()?.localId === joinSignupUid ? 'check-failed' : 'login-required';
      showSignUpStatus(error.code === 'PROFILE_INVALID'
        ? 'The existing profile needs review. No data was replaced.'
        : 'Your profile could not be checked. Please retry, or log in again.');
    } finally {
      joinSignupBusy = false;
      renderSignUpMode();
    }
}

/** Creates an Auth account once, then provisions or resumes its JOIN profile. */
async function handleSignUp() {
    if (joinSignupBusy || joinSignupMode === 'finished') return;
    if (joinSignupMode === 'login-required') return goToUrl('login.html');
    if (joinSignupMode === 'complete') return goToUrl('summary.html');
    if (joinSignupMode === 'check-failed' ||
        (joinSignupMode === 'signup' && getStoredFirebaseAuth()?.localId)) {
      return initializeSignUpPage();
    }
    const completingProfile = joinSignupMode === 'profile';
    const { name, email, password } = setIdRefValueTrimSignUp();
    const validation = completingProfile
      ? { name: validateName(document.getElementById('name_sign_up')), privacy: document.getElementById('checkbox').checked }
      : validateSignUpInputs();
    if (!Object.values(validation).every(Boolean)) return;

    joinSignupBusy = true;
    renderSignUpMode();
    showSignUpStatus('');
    let authSession;
    try {
      const profileData = await createUserProfileDataFromParts(name.split(/\s+/));
      authSession = completingProfile ? getStoredFirebaseAuth() : await window.firebaseSignUp(email, password);
      if (!authSession?.localId || (completingProfile && authSession.localId !== joinSignupUid)) {
        throw joinProfileError('PROFILE_AUTH_REQUIRED', 'Please log in again.');
      }
      joinSignupUid = authSession.localId;
      document.getElementById('password_sign_up').value = '';
      document.getElementById('confirm_sign_up').value = '';
      const profile = await createUser(
        authSession.localId, profileData.firstName, profileData.lastName,
        authSession.email, profileData.randomColor, profileData.initials
      );
      requireJoinProfileSession(authSession.localId);
      joinSignupMode = 'finished';
      if (completingProfile) {
        applyJoinAuthIdentity(authSession);
        applyJoinProfileToSession(profile);
        goToUrl('summary.html');
      } else {
        handleSignUpSuccess(profileData);
      }
    } catch (error) {
      console.error('Error creating user', error);
      const session = getStoredFirebaseAuth();
      if (error.code === 'PROFILE_AUTH_REQUIRED' ||
          (authSession?.localId && session?.localId !== authSession.localId)) {
        joinSignupMode = 'login-required';
        showSignUpStatus('Your session changed or expired. Please log in again.');
      } else if (['PROFILE_INVALID', 'PROFILE_CONFLICT'].includes(error.code)) {
        joinSignupMode = 'check-failed';
        showSignUpStatus('The existing profile needs review. No data was replaced. Retry the profile check.');
      } else if (authSession?.localId && session?.localId === authSession.localId) {
        joinSignupMode = 'profile';
        showSignUpStatus('Your account exists, but your profile could not be saved. Retry saving your profile.');
      } else if (completingProfile) {
        joinSignupMode = 'login-required';
        showSignUpStatus('Your session changed or expired. Please log in again.');
      } else {
        const { emailSignUpRef, errorMessageEmailRef } = getIdRefs();
        const exists = String(error.message).includes('EMAIL_EXISTS');
        if (exists) {
          errorMessageEmailRef?.classList.add('d-flex');
          emailSignUpRef?.classList.add('not-valide-error');
        }
        showSignUpStatus(exists
          ? 'An account with this email already exists. Log in to complete your profile.'
          : 'Account creation could not be confirmed. Try logging in before registering again.');
      }
    } finally {
      joinSignupBusy = false;
      renderSignUpMode();
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
    const initials = firstName[0].toUpperCase() + lastName[0].toUpperCase();
    const palette = ["#FF7A00", "#9327FF", "#6E52FF", "#FC71FF", "#FFBB2B", "#1FD7C1", "#462F8A", "#00BEE8"];
    const colorIndex = [...initials].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
    const randomColor = palette[colorIndex];
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
    window.firebaseAuthLogout?.();
    delayedRedirectAndReset();
}

/**
 * 
 * @function createUser
 * @description Creates the authenticated user's profile only if it does not already exist.
 * @param {string} uid - The authenticated user's UID.
 * @param {string} firstname - The first name of the user.
 * @param {string} lastname - The last name of the user.
 * @param {string} email - The email address of the user.
 * @param {string} randomColor - A randomly generated color associated with the user.
 * @param {string} initials - The initials of the user (e.g., first and last name initials).
 */
async function createUser(uid, firstname, lastname, email, randomColor, initials) {
    const newUser = { firstname, lastname, email, randomColor, initials };
    try {
      return await window.provisionJoinUserProfile(uid, newUser);
    } catch (error) {
      console.error('Error posting profile data', error);
      throw error;
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
 * @description Enables signup or profile completion only when its inputs are valid and no request is in flight.
 * @returns {void} - This function does not return a value directly but modifies the `disabled` property of the sign-up button.
 */
async function enableOrDisableSignUpButton() {
    const { signUpButtonRef } = getIdRefs();
    if (joinSignupBusy || ['checking', 'finished'].includes(joinSignupMode)) {
      signUpButtonRef.disabled = true;
      return;
    }
    if (['check-failed', 'complete', 'login-required'].includes(joinSignupMode)) {
      signUpButtonRef.disabled = false;
      return;
    }
    if (joinSignupMode === 'profile') {
      signUpButtonRef.disabled = !(
        validateName(document.getElementById('name_sign_up')) && document.getElementById('checkbox').checked
      );
      return;
    }
    const {
      isNameValid,
      isEmailValid,
      isPasswordValid,
      isConfirmValid,
      isCheckboxChecked
    } = validateSignUpInputs();

    signUpButtonRef.disabled = !(
      isNameValid &&
      isEmailValid &&
      isPasswordValid &&
      isConfirmValid &&
      isCheckboxChecked
    );
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
