let Contacts = [];
let actualContactIndex = 0;
let contactToDelete = null;

let colorsArray = [
  "#FF6B6B", "#FF8C42", "#FFA500", "#FFD700", "#FFE600", "#B4FF00", "#4CAF50", "#00C853", "#00E5FF", "#00B8D4",
  "#1DE9B6", "#00CFAE", "#00BCD4", "#40C4FF", "#2196F3", "#3D5AFE", "#536DFE", "#7C4DFF", "#AB47BC", "#E040FB",
  "#FF4081", "#F50057", "#EC407A", "#FF1744", "#FF5252", "#D500F9", "#9C27B0", "#BA68C8", "#E91E63", "#FFB300",
  "#FFC400", "#FF9100", "#FF7043", "#F06292", "#FF6E40", "#C51162", "#8E24AA", "#651FFF", "#00BFA5", "#76FF03"
];

/**
 * Fetches contacts from the remote database and renders them.
 * @param {any} data - Unused parameter.
 * @returns {any} The input data.
 */
function getContacts(data) {
    fetch(
        "https://joinstorage-ef266-default-rtdb.europe-west1.firebasedatabase.app/contacts.json"
    )
        .then((response) => response.json())
        .then((data) => {
            Contacts = data;
            renderContacts(data);
        });

    if (getViewMode() === 1) clearViewCard();
    setActualContactIndex(-1);
    /*versionHandling();*/
    return data;
}

/**
 * Updates the remote database with the provided contacts data.
 * @param {Array} data - The contacts array to store.
 */
function updateDatabase(data) {
    fetch(
        "https://joinstorage-ef266-default-rtdb.europe-west1.firebasedatabase.app/contacts.json",
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        }
    )
        .then((response) => response.json())
        .then((data) => {
        })
        .catch((error) => {
        });
}

/**
 * Creates a new contact from the form and updates the UI.
 */
function createContact() {
    let newContact = buildContactFromForm();
    if (!newContact) return;

    addContactAndUpdateUI(newContact);
}

/**
 * Builds a contact object from the form inputs.
 * @returns {Object|null} The contact object or null if validation fails.
 */
function buildContactFromForm() {
    let kindOfDlgPc = "";
    if (getViewMode() === 1) kindOfDlgPc = "_pc";

    let name = document.getElementById("name_input" + kindOfDlgPc)?.value.trim();
    let mail = document.getElementById("mail_input" + kindOfDlgPc)?.value.trim();
    let phone = document.getElementById("phone_input" + kindOfDlgPc)?.value.trim();

    if (!name || !mail || !phone || !emailIsValid(mail)) {
        console.warn("Invalid form input", { name, mail, phone });
        return null;
    }
    name = capitalizeWords(name);
    return {
        name,
        mail,
        phone: phone || "No phone number available"
    };
}

/**
 * Adds a contact to the list, updates the database, and refreshes the UI.
 * @param {Object} contact - The contact object.
 */
function addContactAndUpdateUI(contact) {
    Contacts.push(contact);
    updateDatabase(Contacts);
    renderContacts(Contacts);

    const index = findContactNewIndex(contact);

    closeContactDialog();
    closeContactDialogMobile();
}

/**
 * Finds the new index of a contact after sorting the contacts array by name.
 * @param {Object} contact - The contact object to search for.
 * @returns {number} - The new index of the contact in the sorted Contacts array, or -1 if not found.
 */
function findContactNewIndex(contact) {
    for (let i = 0; i < Contacts.length; i++) {
        if (
            Contacts[i].name === contact.name &&
            Contacts[i].mail === contact.mail &&
            Contacts[i].phone === contact.phone
        ) {
            return i;
        }
    }
    return -1;
}

/**
 * Edits an existing contact with new data from the form.
 * @param {number} id - The contact index.
 */
function editContact(id) {
    let kindOfDlgPc = "";
    let viewMode = getViewMode();
    if (viewMode === 1) {
        kindOfDlgPc = "_pc";
    }

    let name = document.getElementById("name_input" + kindOfDlgPc).value.trim();
    let mail = document.getElementById("mail_input" + kindOfDlgPc).value.trim();
    let phone = document
        .getElementById("phone_input" + kindOfDlgPc)
        .value.trim();

    if (!name || !mail || !phone) {
        return;
    }
    if (emailIsValid(mail) == false) {
        return;
    }

   saveEditedContact(id, kindOfDlgPc, name, mail, phone, viewMode)
}

/**
 * Saves the edited contact and updates the UI based on view mode.
 * @param {number} id - The contact index.
 * @param {string} kindOfDlgPc - Dialog suffix.
 * @param {string} name - The contact name.
 * @param {string} mail - The contact email.
 * @param {string} phone - The contact phone.
 * @param {number} viewMode - The current view mode.
 */
function saveEditedContact(id, dlgType, name, mail, phone, viewMode) {
    name = capitalizeWords(document.getElementById("name_input" + dlgType).value.trim());
    const newContact = { mail, name, phone: phone || "No phone number available" };
    Contacts[id] = newContact; updateDatabase(Contacts);
    id = findContactNewIndex(newContact);
  
    switch (viewMode) {
      case 1: renderContacts(Contacts); renderViewCard(id); closeContactDialog(); break;
      case 2: renderViewCard(id); closeContactDialogMobile(); break;
      case 3: closeContactDialogMobile(); renderTabletVievCard(id); break;
      case 4: MobileVievCard(id); closeContactDialogMobile(); break;
    }
}

/**
 * Validates an email address.
 * @param {string} email - The email to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
function emailIsValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Deletes a contact by index after confirmation.
 * @param {number} id - The contact index.
 */
function deleteContact(id) {
    if (id < 0 || id >= Contacts.length) {
        return;
    }

    Contacts.splice(id, 1);
    updateDatabase(Contacts);

    let viewMode = getViewMode();
    if (viewMode === 1) {
        renderContacts(Contacts);
    }
    goBacktoContacts();
}

/**
 * Configures the avatar for the desktop dialog.
 * @param {Object} contact - The contact object.
 * @param {string} avatarColor - The avatar color.
 */
function configAvatar_pc(contact, avatarColor) {

    let AddNewcontactAvatar = document.getElementById("add_new_contact_avatar");
    if (AddNewcontactAvatar) {
        let test = getInitials(contact.name);
        AddNewcontactAvatar.innerHTML = `
                <p class="contact_view_avatar_initials" id="add_new_contact_avatar_1">${test[0].toUpperCase()}</p>
                <p class="contact_view_avatar_initials" id="add_new_contact_avatar_2">${test[1].toUpperCase()}</p>
            `;
        AddNewcontactAvatar.style.backgroundColor = avatarColor;
        AddNewcontactAvatar.style.color = "#FFFFFF";
    }
}

/**
 * Configures the avatar for the mobile dialog.
 * @param {Object} contact - The contact object.
 * @param {string} avatarColor - The avatar color.
 */
function configAvatar_mobile(contact, avatarColor) {
    let AddNewcontactAvatar_mobile = document.getElementById(
        "add_new_contact_avatar_mobile"
    );
    if (AddNewcontactAvatar_mobile) {
        let test = getInitials(contact.name);
        AddNewcontactAvatar_mobile.innerHTML = `
                <p class="contact_view_avatar_initials" id="add_new_contact_avatar_mob_1">${test[0].toUpperCase()}</p>
                <p class="contact_view_avatar_initials" id="add_new_contact_avatar_mob_2">${test[1].toUpperCase()}</p>
            `;
        AddNewcontactAvatar_mobile.style.backgroundColor = avatarColor;
        AddNewcontactAvatar_mobile.style.color = "#FFFFFF";
    }
}

/**
 * Gets the initials from a name string.
 * @param {string} name - The full name.
 * @returns {Array} Array of initials.
 */
function getInitials(name) {
    if (!name || typeof name !== "string") return ['?', '?'];

    const parts = name.trim().split(/\s+/);
    const initials = parts.map(p => p[0].toUpperCase());

    if (initials.length === 1) initials.push(initials[0]);
    return initials.length >= 2 ? initials.slice(0, 2) : ['?', '?'];
}

/**
 * Sorts the contacts array by name.
 * @param {Array} contacts - The contacts array.
 */
function sortContacts(contacts) {
    contacts.sort((a, b) => a.name.localeCompare(b.name));
    Contacts = contacts;
}

/**
 * Gets the first letter of a name and checks if it changed.
 * @param {string} name - The name.
 * @param {string} oldLetter - The previous letter.
 * @param {boolean} change - Change flag.
 * @returns {string} The first letter.
 */
function getFirstLetter(name, oldLetter, change) {

    let firstLetter = name.charAt(0);

    if (oldLetter !== firstLetter) {
        change = true;
    } else {
        change = false;
    }
    oldLetter = firstLetter;

    return firstLetter;
}

/**
 * Determines the current view mode based on the window's width.
 *
 * @returns {number} The view mode:
 *   1 - Desktop big (window width >= 1100)
 *   2 - Desktop small (window width < 1100)
 *   3 - Tablet (window width < 825)
 *   4 - Mobile (window width < 560)
 */
function getViewMode() {
    if (window.innerWidth < 560) {
      return 4;
    } else if (window.innerWidth < 825) {
      return 3;
    } else if (window.innerWidth < 1100) {
      return 2;
    } else {
      return 1;
    }
}

/**
 * Gets a color from the colors array based on index.
 * @param {number} index - The index.
 * @returns {string} The color.
 */
function getColor(index) {
    let idx = index;
    if (idx < 0) {
        idx = 0;
    }

    return colorsArray[idx % colorsArray.length];
}

/**
 * Gets a color from the colors array based on the first letter.
 * @param {string} firstLetter - The first letter.
 * @returns {string} The color.
 */
function getColorFromFirstLetter(firstLetter) {
    let text = "";
    text = String(firstLetter).toUpperCase();

    let colorIndex = text.charCodeAt(0) - 65;

    return colorsArray[colorIndex];
}

/**
 * Capitalizes the first letter of each word in a sentence.
 * @param {string} Sentence - The sentence.
 * @returns {string} The capitalized sentence.
 */
function capitalizeWords(Sentence) {
    return Sentence.replace(/(^\w{1})|(\s+\w{1})/g, (letter) =>
        letter.toUpperCase()
    );
}

/**
 * Sets the actual contact index.
 * @param {number} index - The index.
 * @returns {number} The set index.
 */
function setActualContactIndex(index) {
    actualContactIndex = index;
    return actualContactIndex;
}

/**
 * Gets the actual contact index.
 * @returns {number} The actual contact index.
 */
function getActualContactIndex() {
    return actualContactIndex;
}

/**
 * Controls the display state of the add new contact section based on view mode.
 * @param {number} viewMode - The view mode.
 */
function contorlAddNewContactSection(viewMode) {
        if (viewMode === 1) {
            addNewContactSectionState_pc(true);
        } else if (viewMode === 2) {
            addNewContactSectionState(true);
            addNewContactSectionState_pc(false);
        } else if (viewMode === 3) {
            addNewContactSectionState(true);
            addNewContactSectionState_pc(false);
        } else if (viewMode === 4) {
            addNewContactSectionState_pc(false);
        }
}

/**
 * Handles the submission of the mobile contact form.
 * Prevents the default submit action, validates the form,
 *
 * @param {SubmitEvent} event - The submit event triggered by the form
 */
function handleMobileContactSubmit(event) {
    event.preventDefault(); 
    if (event.target.checkValidity()) {
    } else {
      event.target.reportValidity();
    }
}

/**
 * Opens the delete confirmation overlay for a specific contact.
 *
 * @param {number} id - The index of the contact in the Contacts array to be deleted
 */
function promptDeleteContact(id) {
    contactToDelete = id;
    document.getElementById("deleteConfirmOverlay").classList.remove("hidden");
}
  
/**
* Closes the delete confirmation overlay and resets the pending delete contact.
*/
function closeDeleteConfirm() {
    document.getElementById("deleteConfirmOverlay").classList.add("hidden");
    contactToDelete = null;
}
  
/**
* Confirms the deletion of the selected contact.
* re-renders the contact list, clears the view card, and closes the overlay.
*/
function confirmDeleteContact() {
    if (contactToDelete !== null) {
      Contacts.splice(contactToDelete, 1); 
      updateDatabase(Contacts);
      renderContacts(Contacts); 
      clearViewCard();
      closeDeleteConfirm();
    }
}