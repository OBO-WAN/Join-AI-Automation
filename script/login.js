window.addEventListener('load', () => {
    runIntroAnimation();
});

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const nav = document.getElementById("nav_log_in");
    nav.classList.remove("hidden");
    nav.classList.add("fade-in");
  }, 1500);
});

/**
 * Runs the introductory login animation sequence.
 *
 * This async function coordinates the staged reveal of the login UI
 * after the splash/logo animation finishes. It waits for a short delay,
 * disables pointer events on the overlay, and then reveals the main
 * login content, footer, and the static logo container.
 *
 * @async
 * @function runIntroAnimation
 * @returns {Promise<void>} Resolves once the intro animation sequence completes.
 *
 * @example
 * // Trigger the intro animation on page load
 * window.addEventListener("load", () => {
 *   runIntroAnimation();
 * });
 *
 * @description
 * Steps performed:
 * 1. Waits 1500ms using `delay`.
 * 2. Disables pointer events on the `#animationsLogoOverlay` element
 *    so the user can interact with the UI underneath.
 * 3. Calls `revealElement` on:
 *    - `#loginMain` (the login form container)
 *    - `#footerLogin` (the footer links)
 *    - `#animationFinished` (the static logo shown after the animated logo)
 */

async function runIntroAnimation() {
    const overlay = document.getElementById('animationsLogoOverlay');
    const loginMain = document.getElementById('loginMain');
    const footerLogin = document.getElementById('footerLogin');
    const animationFinished = document.getElementById('animationFinished');

    await delay(1500); 

    if (overlay) overlay.style.pointerEvents = 'none';

    revealElement(loginMain);
    revealElement(footerLogin);
    revealElement(animationFinished);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function revealElement(element) {
    if (element) {
        
        element.classList.remove('hidden');
        element.style.display = 'flex';
        element.style.opacity = '1';
        element.classList.add('fade-in');
    }
}

function login() {
    console.log("Login function triggered");

    sessionStorage.setItem("isUser", "true");
}

function guestLogin() {
    localStorage.setItem("isGuest", "true");
    window.location.href = "summary.html";
    sessionStorage.setItem("isUser", "false");
}

function togglePasswordVisibility(inputId, iconElement) {
  const passwordInput = document.getElementById(inputId);
  const icon = iconElement;

  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  icon.src = isPassword ? "assets/icons/visibility-eye-off.svg" : "assets/icons/visibility-eye.svg";
  icon.alt = isPassword ? "Hide Password" : "Show Password";
}

/**
 * 
 * @function checkAndShowAnimation
 * @description Checks if the initial login animation has already been shown in the current session.
 * If the animation has been shown (indicated by the 'animationShown' item in sessionStorage),
 * it directly shows the finished animation state and removes the overlay.
 * Otherwise, it calls the `startLoginAnimationsWithDelay` function to initiate the delayed fade-in animations
 * for the login container, navigation, and footer, and then hides the overlay.
 * Finally, it sets the 'animationShown' item in sessionStorage to 'true' to prevent the animation from
 * showing again in the current session and retrieves the 'linksSidebarBoolienKey' from sessionStorage.
 */
function checkAndShowAnimation() {
    const {animationsLogoOverlayRef, animationFinishedRef, navLogInRef, loginContainerRef, footerLogInRef } = getIdRefs();
    animationsLogoOverlayRef.classList.remove('d-none');
    if (sessionStorage.getItem('animationShown')) {
      animationFinishedRef.classList.add('d-flex');
      animationsLogoOverlayRef.classList.add('d-none');
      removeAnimation();
      return;
    }
    startLoginAnimationsWithDelay(loginContainerRef,navLogInRef,footerLogInRef,animationsLogoOverlayRef,animationFinishedRef);
    sessionStorage.setItem('animationShown', 'true');
    sessionStorage.getItem('linksSidebarBoolienKey');
  }

  /**
   * 
   * @function removeAnimation
   * @description Removes any applied CSS animation and resets the opacity property for the login container,
   * login navigation, and login/register footer elements. This is likely used to clear fade-in animations.
   */
  function removeAnimation() {
    const { navLogInRef, loginContainerRef, footerLogInRef } = getIdRefs();
    loginContainerRef.style.removeProperty('animation');
    loginContainerRef.style.opacity = 'unset';
    navLogInRef.style.removeProperty('animation');
    navLogInRef.style.opacity = 'unset';
    footerLogInRef.style.removeProperty('animation');
    footerLogInRef.style.opacity = 'unset';
  }
  
  /**
   * 
   * @function removeOpacity
   * @description Resets the opacity property to its default value ('unset') for the login container,
   * login navigation, and login/register footer elements. This effectively makes the elements fully visible
   * if their opacity was previously modified (e.g., during an animation).
   */
  function removeOpacity() {
    const { navLogInRef, loginContainerRef, footerLogInRef } = getIdRefs();
    loginContainerRef.style.opacity = 'unset';
    navLogInRef.style.opacity = 'unset';
    footerLogInRef.style.opacity = 'unset';
  }

/**
 * 
 * @function setIdRefValueTrimLogIn
 * @description Retrieves the values from the email and password input fields in the login form,
 * trims any leading or trailing whitespace, and returns them as an object.
 * @returns {object} - An object containing the trimmed values of the login form fields:
 * - `emailLogIn`: The trimmed value of the email input field.
 * - `passwordLogIn`: The trimmed value of the password input field.
 */
function setIdRefValueTrimLogIn() {
    return {
      emailLogIn: document.getElementById('email_log_in').value.trim(),
      passwordLogIn: document.getElementById('password_log_in').value.trim(),
    };
  }

function showLoginOverlayErrorOnly() {
  const { errorMessageLogInRef } = getIdRefs();
  if (errorMessageLogInRef) {
    errorMessageLogInRef.classList.add('d-flex');
  }
}

function validateEmailLogin(inputField) {
  const value = inputField.value.trim();
  const {
    errorMessageEmailNotValideLoginRef
  } = getIdRefs();

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  if (!isValid) {
    inputField.classList.add('not-valide-error');
    errorMessageEmailNotValideLoginRef?.classList.add('show-error');
    return false;
  } else {
    inputField.classList.remove('not-valide-error');
    errorMessageEmailNotValideLoginRef?.classList.remove('show-error');
    return true;
  }
}

function validatePasswordLogin(inputField) {
  const value = inputField.value.trim();
  const { errorMessagePasswordLogInRef } = getIdRefs();

  const isValid = value.length >= 8;

  if (!isValid) {
    inputField.classList.add('not-valide-error');
    errorMessagePasswordLogInRef?.classList.add('show-error');
    return false;
  } else {
    inputField.classList.remove('not-valide-error');
    errorMessagePasswordLogInRef?.classList.remove('show-error');
    return true;
  }
}
  
/**
*
* @function handleGenericLoginErrorDisplay
* @description Controls the visibility of the generic login error message based on the visibility states
* of the specific email and password error messages. It displays the generic error message only if neither
* the email nor the password error messages are currently visible.
* @param {HTMLElement | null} errorMessageLogInRef - The HTML element representing the generic login error message.
* @param {boolean} isEmailErrorVisible - A boolean indicating if the email error message is currently visible (has the 'd-flex' class).
* @param {boolean} isPasswordErrorVisible - A boolean indicating if the password error message is currently visible (has the 'd-flex' class).
*/
function handleGenericLoginErrorDisplay(errorMessageLogInRef, isEmailErrorVisible, isPasswordErrorVisible) {
    if (errorMessageLogInRef) {
      if (!isEmailErrorVisible && !isPasswordErrorVisible) {
        errorMessageLogInRef.classList.add('d-flex');
      } else {
        errorMessageLogInRef.classList.remove('d-flex');
      }
    }
}