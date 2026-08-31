/**
 * register.part1.js
 * Foundational DOM refs + basic UI helpers + email validation.
 * MUST be loaded BEFORE register.part2.js inside the HTML.
 *
 */

/**
 * 
 * @function getIdRefs
 * @description Retrieves references to various DOM elements by their IDs and returns them as an object.
 * @returns {object} An object containing references to various DOM elements. The keys of the object correspond to the reference names (e.g., `animationJoinLogoRef`), and the values are the corresponding DOM elements.
 * 
 */
function getIdRefs() {
  return {
    bodyLoginRegisterRef: document.getElementById('body_log_in'),
    animationsLogoOverlayRef: document.getElementById('animations_logo_overlay'),
    animationJoinLogoRef: document.getElementById('animation_join_logo'),
    animationFinishedRef: document.getElementById('animation_finished'),
    navLogInRef: document.getElementById('nav_log_in'),
    loginContainerRef: document.getElementById('login_container'),
    signUpContainerRef: document.getElementById('sign_up_container'),
    footerLogInRef: document.getElementById('footer_log_in'),
    imgPasswordLogInRef: document.getElementById('img_password_log_in'),
    loginFormRef: document.getElementById('login_form'),
    nameSignUpRef: document.getElementById('name_sign_up'),
    emailSignUpRef: document.getElementById('email_sign-up'),
    emailLogInRef: document.getElementById('email_log_in'),
    passwordLogInRef: document.getElementById('password_log_in'),
    passwordSignUpRef: document.getElementById('password_sign_up'),
    confirmPasswordSignUpRef: document.getElementById('confirm_sign_up'),
    checkboxRef: document.getElementById('checkbox'),
    signUpButtonRef: document.getElementById('sign_up_button'),
    customCheckmarkRef: document.getElementById('custom_checkmark'),
    errorMessageEmailNotValideSignUpRef: document.getElementById('error_message_email_not_valide_sign_up'),
    errorMessageEmailNotValideLoginRef: document.getElementById('error_message_email_not_valide_login'),
    errorMessageNameRef: document.getElementById('error_message_name'),
    errorMessageLogInRef: document.getElementById('error_message_log_in'),
    errorMessagePasswordSignInRef: document.getElementById('error_message_password_sign_up'),
    errorMessagePasswordLogInRef: document.getElementById('error_message_password_log_in'),
    errorMessageConfirmPasswordRef: document.getElementById('error_message_confirm_password'),
    errorMessageEmailRef: document.getElementById('error_message_email'),
    popupOverlaySignUpRef: document.getElementById('popup_overlay_sign_up'),
    logoWhiteRef: document.getElementById('logo_white'), 
    logoGrayRef: document.getElementById('logo_gray'), 
  };
}

/**
 *
 * @function togglePasswordVisibility
 * @description Toggles the visibility of a password input field and updates the corresponding visibility icon.
 * @param {string} inputId - The ID of the password input element.
 * @param {HTMLElement} iconElement - The HTML element representing the visibility toggle icon.
 */
function togglePasswordVisibility(inputId, iconElement) {
  const passwordInput = document.getElementById(inputId);
  const toggleIcon = iconElement;
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.src = 'assets/icons/visibility-eye.svg';
    toggleIcon.alt = 'Visibility Eye Icon';
  } else {
    passwordInput.type = 'password';
    toggleIcon.src = 'assets/icons/visibility-eye-off.svg';
    toggleIcon.alt = 'Visibility eye of Icon';
  }
}

/**
 * 
 * @function delayedRedirectAndReset
 * @description **This function is called by `handleSignUpSuccess` to perform post-sign-up actions.**
 * It uses `setTimeout` to delay the redirection to the 'log_in.html' page and calls the
 * `resetProberties` function after a specified delay (500 milliseconds).
 */
function delayedRedirectAndReset(){
 setTimeout(() => {
      goToUrl('index.html');
      toggleCheckbox(true);
    }, 500);
}

/**
 *
 * @function handlePasswordConfirmationResult
 * @description Handles the visual feedback based on whether the provided passwords match.
 * If they do not match, it displays the error message and adds the error class to both password input fields.
 * If they match, it clears the error message and removes the error class from the input fields.
 * @param {boolean} passwordsMatch - A boolean indicating whether the password and confirm password values are the same.
 * @param {HTMLElement} errorMessageConfirmPasswordRef - The HTML element for the confirm password error message.
 * @param {HTMLElement} passwordSignUpRef - The HTML input element for the password on the sign-up form.
 * @param {HTMLElement} confirmPasswordSignUpRef - The HTML input element for the confirm password on the sign-up form.
 * @returns {boolean} - Returns `false` if the passwords do not match, `true` otherwise.
 */
function handlePasswordConfirmationResult(passwordsMatch, errorMessageConfirmPasswordRef, passwordSignUpRef, confirmPasswordSignUpRef) {
  if (!passwordsMatch) {
    errorMessageConfirmPasswordRef.classList.add('d-flex');
    passwordSignUpRef.classList.add('not-valide-error');
    confirmPasswordSignUpRef.classList.add('not-valide-error');
    return false;
  } else {
    clearConfirmPasswordError();
    return true;
  }
}

/**
 *
 * @function checkPasswordConfirm
 * @description Checks if the password and confirm password input fields match.
 * It utilizes the `handlePasswordConfirmationResult` function to manage the visual feedback
 * based on the comparison. It also handles the case where the confirm password field is empty.
 * @returns {boolean} - Returns `true` if the passwords match or if the confirm password field is empty, `false` otherwise.
 */
function checkPasswordConfirm() {
  const { password, confirmPassword } = setIdRefValueTrimSignUp();
  const { errorMessageConfirmPasswordRef, passwordSignUpRef, confirmPasswordSignUpRef } = getIdRefs();

  if (confirmPassword === "") {
    clearConfirmPasswordError();
    return true;
  }

  const passwordsMatch = password === confirmPassword;
  return handlePasswordConfirmationResult(passwordsMatch, errorMessageConfirmPasswordRef, passwordSignUpRef, confirmPasswordSignUpRef);
}

/**
 * @function clearConfirmPasswordError
 * @description Clears the error styling and message related to the confirm password field.
 */
function clearConfirmPasswordError() {
  const { errorMessageConfirmPasswordRef, confirmPasswordSignUpRef, passwordSignUpRef } = getIdRefs();
  errorMessageConfirmPasswordRef.classList.remove('d-flex');
  confirmPasswordSignUpRef.classList.remove('not-valide-error');
  passwordSignUpRef.classList.remove('not-valide-error');
}

/**
 *
 * @function getEmailInputData
 * @description Extracts the email value from the provided input field, trims any leading or trailing whitespace,
 * and determines the appropriate email reference (for sign-up or login) based on the `isSignUp` flag.
 * @param {HTMLInputElement} emailInputField - The HTML input element for the email.
 * @param {boolean} isSignUp - A boolean indicating whether the context is the sign-up form (`true`) or the login form (`false`).
 * @returns {object} - An object containing the trimmed email value and the corresponding email reference element.
 * - `trimmedEmail`: The email value with leading and trailing whitespace removed.
 * - `currentEmailRef`: The HTML element reference for the email input field (either `emailSignUpRef` or `emailLogInRef`).
 */
function getEmailInputData(emailInputField, isSignUp) {
  const { emailSignUpRef, emailLogInRef } = getIdRefs();
  const email = emailInputField.value;
  const trimmedEmail = email.trim();
  const currentEmailRef = isSignUp ? emailSignUpRef : emailLogInRef;
  return { trimmedEmail, currentEmailRef };
}

/**
 * @function validateEmail
 * @description Validates an email input, shows/hides the correct error message,
 * and toggles the 'not-valide-error' class.
 *
 * @param {HTMLInputElement} inputField - The email input element to be validated.
 * @param {boolean} isSignUp - True for sign-up form, false for login form.
 * @returns {boolean} True if valid, otherwise false.
 */
function validateEmail(inputField, isSignUp) {
  const v = inputField.value.trim();
  const { errorMessageEmailNotValideSignUpRef: sign, errorMessageEmailNotValideLoginRef: login } = getIdRefs();
  const ref = isSignUp ? sign : login, valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  inputField.classList.toggle("not-valide-error", !valid);
  if (ref) ref.classList.toggle("d-flex", !valid);

  return valid;
}

/**
 * 
 * @function clearEmailValidationErrors
 * @description Removes the display style and error class from email validation error messages and the corresponding email input field.
 * It differentiates between sign-up and login forms to target the correct error message and input field.
 * @param {boolean} - A boolean flag indicating whether the validation context is for the sign-up form (`true`) or the login form (`false`).
 */
function clearEmailValidationErrors(boolean) {
  const { errorMessageEmailNotValideSignUpRef, errorMessageEmailNotValideLoginRef, errorMessageEmailRef, emailSignUpRef, emailLogInRef } = getIdRefs();
  if (boolean) {
    emailSignUpRef.classList.remove('not-valide-error');
    errorMessageEmailNotValideSignUpRef.classList.remove('d-flex');
    errorMessageEmailRef.classList.remove('d-flex');
  } else {
    emailLogInRef.classList.remove('not-valide-error');
    errorMessageEmailNotValideLoginRef.classList.remove('d-flex');
  }
}

/**
 * 
 * @function ifValidateEmailTrimmed
 * @description Checks if the original email input value has leading or trailing whitespace.
 * If whitespace is present, it displays the appropriate error message and adds an error class to the email input field.
 * @param {string} email - The original email input value.
 * @param {string} trimmedEmail - The trimmed email input value.
 * @param {HTMLElement} errorMessageEmailNotValideSignUpRef - The error message element for invalid email format on sign-up.
 * @param {HTMLElement} errorMessageEmailNotValideLoginRef - The error message element for invalid email format on login.
 * @param {HTMLElement} errorMessageEmailRef - The general error message element for the email field.
 * @param {HTMLElement} emailRef - The HTML input element for the email.
 * @param {boolean} boolean - A boolean indicating if the validation is for the sign-up form (true) or login form (false).
 * @returns {boolean} - Returns true if there is no leading or trailing whitespace, false otherwise.
 */
function ifValidateEmailTrimmed(email, trimmedEmail, errorMessageEmailNotValideSignUpRef, errorMessageEmailNotValideLoginRef, errorMessageEmailRef, emailRef, boolean) {
  if (email !== trimmedEmail) {
    if (boolean) {
      errorMessageEmailNotValideSignUpRef.classList.add('d-flex');
    } else {
      errorMessageEmailNotValideLoginRef.classList.add('d-flex');
    }
    errorMessageEmailRef.classList.remove('d-flex');
    if (emailRef) {
      emailRef.classList.add('not-valide-error');
    }
    return false;
  }
  return true;
}

/**
 * 
 * @function ifEmailPattern
 * @description Checks if the trimmed email input value matches a basic email pattern.
 * If the pattern does not match, it displays the appropriate error message and adds an error class to the email input field.
 * @param {string} trimmedEmail - The trimmed email input value.
 * @param {HTMLElement} errorMessageEmailNotValideSignUpRef - The error message element for invalid email format on sign-up.
 * @param {HTMLElement} errorMessageEmailNotValideLoginRef - The error message element for invalid email format on login.
 * @param {HTMLElement} errorMessageEmailRef - The general error message element for the email field.
 * @param {HTMLElement} emailRef - The HTML input element for the email.
 * @param {boolean} boolean - A boolean indicating if the validation is for the sign-up form (true) or login form (false).
 * @returns {boolean} - Returns true if the email matches the pattern, false otherwise.
 */
function ifEmailPattern(trimmedEmail, errorMessageEmailNotValideSignUpRef, errorMessageEmailNotValideLoginRef, errorMessageEmailRef, emailRef, boolean) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmedEmail)) {
    if (boolean) {
      errorMessageEmailNotValideSignUpRef.classList.add('d-flex');
    } else {
      errorMessageEmailNotValideLoginRef.classList.add('d-flex');
    }
    if (emailRef) {
      emailRef.classList.add('not-valide-error');
    }
    return false;
  }
  return true;
}

/**
 * @function validatePassword
 * @description Validates a password input field by checking length. 
 * Shows or hides appropriate error messages based on form context.
 * 
 * @param {HTMLInputElement} inputField - The password input element.
 * @param {boolean} isSignUp - True if validating for sign-up; false for login.
 * @returns {boolean} - True if the password is valid, otherwise false.
 */
function validatePassword(inputField, isSignUp) {
  const password = inputField.value.trim();
  const isValid = password.length >= 8;

  const {
    errorMessagePasswordLogInRef,
    errorMessagePasswordSignInRef
  } = getIdRefs();

  const errorMessage = isSignUp ? errorMessagePasswordSignInRef : errorMessagePasswordLogInRef;

  if (!isValid) {
    inputField.classList.add('not-valide-error');
    if (errorMessage) errorMessage.classList.add('d-flex');
    return false;
  } else {
    inputField.classList.remove('not-valide-error');
    if (errorMessage) errorMessage.classList.remove('d-flex');
    return true;
  }
}

/**
 *
 * @function getPasswordInputData
 * @description Extracts the password value from the provided input field and trims any leading or trailing whitespace.
 * @param {HTMLInputElement} passwordInputField - The HTML input element for the password.
 * @returns {object} - An object containing the original password value and the trimmed password value.
 * - `password`: The original value of the password input field.
 * - `trimmedPassword`: The password value with leading and trailing whitespace removed.
 */
function getPasswordInputData(passwordInputField) {
  const password = passwordInputField.value;
  const trimmedPassword = password.trim();
  return { password, trimmedPassword };
}
