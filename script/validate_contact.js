let masegeName = [];
let masegeMail = [];
let masegePhone = [];

/**
 * Updates an input and its error message to reflect validation state.
 * @param {HTMLInputElement|null} input - Field being validated.
 * @param {HTMLElement|null} errorElement - Element containing the error text.
 * @param {boolean} isValid - Whether the field value is valid.
 * @param {string} message - Error text shown for an invalid value.
 * @returns {boolean} The supplied validation result.
 */
function setContactFieldValidation(input, errorElement, isValid, message) {
    if (!input || !errorElement) return false;

    errorElement.textContent = isValid ? "" : message;
    input.style.borderColor = isValid ? "#DBDBDB" : "red";
    input.setAttribute("aria-invalid", String(!isValid));
    return isValid;
}

/**
 * Validates and renders the desktop name field.
 * @returns {boolean} Whether the name is valid.
 */
function validateName() {
    const input = document.getElementById("name_input_pc");
    return setContactFieldValidation(
        input,
        document.getElementById("form_name_erro_pc"),
        validateName_LowLevel(input?.value),
        "Please enter your first and last name",
    );
}

/**
 * Validates and renders the mobile name field.
 * @returns {boolean} Whether the name is valid.
 */
function validateNameMobile() {
    const input = document.getElementById("name_input");
    return setContactFieldValidation(
        input,
        document.getElementById("form_name_erro_mobile"),
        validateName_LowLevel(input?.value),
        "Please enter your first and last name",
    );
}

/**
 * Requires at least two name parts containing at least two characters each.
 * @param {string} name - Full name value.
 * @returns {boolean} Whether the name is valid.
 */
function validateName_LowLevel(name) {
    const parts = String(name || "").trim().split(/\s+/);
    return (
        parts.length >= 2 &&
        parts[0].length >= 2 &&
        parts[parts.length - 1].length >= 2
    );
}

/**
 * Validates and renders the desktop email field.
 * @returns {boolean} Whether the email is valid.
 */
function validateMail() {
    const input = document.getElementById("mail_input_pc");
    return setContactFieldValidation(
        input,
        document.getElementById("form_mail_erro_pc"),
        validateMail_LowLevel(input?.value),
        "A valid email address is required",
    );
}

/**
 * Validates and renders the mobile email field.
 * @returns {boolean} Whether the email is valid.
 */
function validateMailMobile() {
    const input = document.getElementById("mail_input");
    return setContactFieldValidation(
        input,
        document.getElementById("form_mail_erro_mobile"),
        validateMail_LowLevel(input?.value),
        "A valid email address is required",
    );
}

/**
 * Checks a basic email address structure.
 * @param {string} mail - Email value.
 * @returns {boolean} Whether the email is valid.
 */
function validateMail_LowLevel(mail) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(mail || "").trim());
}

/**
 * Validates and renders the desktop phone field.
 * @returns {boolean} Whether the phone number is valid.
 */
function validatePhone() {
    const input = document.getElementById("phone_input_pc");
    return setContactFieldValidation(
        input,
        document.getElementById("form_phone_erro_pc"),
        validatePhone_LowLevel(input?.value),
        "A valid phone number is required",
    );
}

/**
 * Validates and renders the mobile phone field.
 * @returns {boolean} Whether the phone number is valid.
 */
function validatePhoneMobile() {
    const input = document.getElementById("phone_input");
    return setContactFieldValidation(
        input,
        document.getElementById("form_phone_erro_mobile"),
        validatePhone_LowLevel(input?.value),
        "A valid phone number is required",
    );
}

/**
 * Allows an optional leading plus and common separators, with at least seven digits.
 * @param {string} phone - Phone value.
 * @returns {boolean} Whether the phone number is valid.
 */
function validatePhone_LowLevel(phone) {
    const value = String(phone || "").trim();
    const digitCount = (value.match(/\d/g) || []).length;
    return /^\+?[0-9\s/-]+$/.test(value) && digitCount >= 7;
}

/**
 * Validates every desktop field so all errors appear on submission.
 * @returns {boolean} Whether the desktop form is valid.
 */
function validateContactFormPc() {
    return [validateName(), validateMail(), validatePhone()].every(Boolean);
}

/**
 * Validates every mobile field so all errors appear on submission.
 * @returns {boolean} Whether the mobile form is valid.
 */
function validateContactFormMobile() {
    return [
        validateNameMobile(),
        validateMailMobile(),
        validatePhoneMobile(),
    ].every(Boolean);
}
