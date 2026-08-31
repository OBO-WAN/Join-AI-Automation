let masegeName = [];
let masegeMail = [];
let masegePhone = [];
const contactFormPc = document.getElementById("contact_form_pc");

/**
 * Prevents default submission for the PC contact form
 * until validation is handled.
 */
document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById("contact_form_pc");
    if (form) {
        form.addEventListener("submit", function(event) {
            event.preventDefault();
        });
    }
});

/**
 * Prevents default submission for the mobile contact form
 * until validation is handled.
 */
document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById("contact_form_mobile");
    if (form) {
        form.addEventListener("submit", function(event) {    
            event.preventDefault();
        });
    }
});

/**
 * Validates the name input for the PC contact form.
 * Displays an error if the name is missing or incomplete.
 */
function validateName() {
    const name = document.getElementById("name_input_pc");
    const nameError = document.getElementById("form_name_erro_pc");
    let msgName = "Please enter your first and last name";

    if (validateName_LowLevel(name.value)) {
        nameError.innerHTML = "";
        name.style.borderColor = "#DBDBDB";
    } else {
        nameError.innerHTML = msgName;
        name.style.borderColor = "red";
    }
}

/**
 * Validates the name input for the mobile contact form.
 * Displays an error if the name is missing or incomplete.
 */
function validateNameMobile() {
    const name = document.getElementById("name_input");
    const nameError = document.getElementById("form_name_erro_mobile");
    let msgName = "Please enter your first and last name";

    if (validateName_LowLevel(name.value)) {
        nameError.innerHTML = "";
        name.style.borderColor = "#DBDBDB";
    } else {
        nameError.innerHTML = msgName;
        name.style.borderColor = "red";
    }   
}

/**
 * Low-level validation for names.
 * Ensures the input contains at least two words,
 * each at least 2 characters long, and total length >= 5.
 *
 * @param {string} name - The full name input value
 * @returns {boolean} True if the name is valid, otherwise false
 */
function validateName_LowLevel(name) {
    let test = name.split(" ");
    let result = false;

    let length_1 = test[0].length;
    let length_2 = 0;
    if (test.length > 1) {
        length_2 = test[1].length;
    }

    if (name.length >= 5 && test.length >= 2 && length_1 >= 2 && length_2 >= 2) {
        result = true;
    } else {
        result = false;
    }
    return result;
}

/**
 * Validates the email input for the PC contact form.
 * Displays an error if the email format is invalid.
 */
function validateMail() {
    const mail = document.getElementById("mail_input_pc");
    const mailError = document.getElementById("form_mail_erro_pc");
    let msgMail = "A valid email address is required";

    if (validateMail_LowLevel(mail.value)) {
        mailError.innerHTML = "";
        mail.style.borderColor = "#DBDBDB";
    } else {
        mailError.innerHTML = msgMail;
        mail.style.borderColor = "red";
    }
}

/**
 * Validates the email input for the mobile contact form.
 * Displays an error if the email format is invalid.
 */
function validateMailMobile() {
    const mail = document.getElementById("mail_input");
    const mailError = document.getElementById("form_mail_erro_mobile");
    let msgMail = "A valid email address is required";

    if (validateMail_LowLevel(mail.value)) {
        mailError.innerHTML = "";
        mail.style.borderColor = "#DBDBDB";
    } else {
        mailError.innerHTML = msgMail;
        mail.style.borderColor = "red";
    }
}

/**
 * Low-level validation for email addresses.
 * Uses a simple regex to check for basic email format.
 *
 * @param {string} mail - The email input value
 * @returns {boolean} True if the email format is valid, otherwise false
 */
function validateMail_LowLevel(mail) {
    let result = false;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        result = true;
    } else {
        result = false;
    }
    return result;
}

/**
 * Validates the phone number input for the PC contact form.
 * Displays an error if the number is invalid.
 */
function validatePhone() {
    const phone = document.getElementById("phone_input_pc");
    const phoneError = document.getElementById("form_phone_erro_pc");
    let msgPhone = "A Valid phone number is required";

    if (validatePhone_LowLevel(phone.value)) {
        phoneError.innerHTML = "";
        phone.style.borderColor = "#DBDBDB";
    } else {
        phoneError.innerHTML = msgPhone;
        phone.style.borderColor = "red";
    }
}

/**
 * Validates the phone number input for the mobile contact form.
 * Displays an error if the number is invalid.
 */
function validatePhoneMobile() {
    const phone = document.getElementById("phone_input");
    const phoneError = document.getElementById("form_phone_erro_mobile");
    let msgPhone = "A Valid phone number is required";

    if (validatePhone_LowLevel(phone.value)) {
        phoneError.innerHTML = "";
        phone.style.borderColor = "#DBDBDB";
    } else {
        phoneError.innerHTML = msgPhone;
        phone.style.borderColor = "red";
    }
}

/**
 * Low-level validation for phone numbers.
 * Accepts only digits (and an optional leading '+') 
 * with a minimum length of 7.
 *
 * @param {string} phone - The phone input value
 * @returns {boolean} True if the phone number is valid, otherwise false
 */
function validatePhone_LowLevel(phone) {
    let result = false;
    if (/^(\+)?[0-9]{7,}$/.test(phone)) {
        result = true;
    } else {
        result = false;
    }
    return result;
}