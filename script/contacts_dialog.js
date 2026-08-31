/**
 * @function configEditDlgBox
 * @description Configures the contact dialog box depending on whether a contact is being created or edited.
 * Determines the view mode (desktop or mobile/tablet) and delegates to the appropriate setup function.
 * Always adds validation listeners for form inputs.
 * 
 * @param {number} id - The index of the contact to edit. If `id < 0`, a new contact will be created.
 */
function configEditDlgBox(id) {
    const dlg = getViewMode() === 1 ? "_pc" : "";
    const kind = id < 0 ? "createContact" : "editContact";
    kind === "editContact" ? setupEditContactDialog(id, dlg) : setupCreateContactDialog(id, dlg);
    addValidationListeners();
}
  
/**
* @function setupEditContactDialog
* @description Prepares the dialog for editing an existing contact. 
* Populates form fields, sets the save button, and updates the contact avatar(s).
* 
* @param {number} id - The index of the contact in the global `Contacts` array.
* @param {string} dlg - Dialog suffix used to target PC (`"_pc"`) or other modes (`""`).
*/
function setupEditContactDialog(id, dlg) {
    document.getElementById("Kind_Of_Dlg" + dlg).innerHTML = "Edit contact";
    document.getElementById("id_Edit_Btn" + dlg).onclick = () => editContact(id);
    document.getElementById("id_Edit_Btn_Text" + dlg).innerText = "Save";
    const c = Contacts[id]; ["name","mail","phone"].forEach(f => document.getElementById(f+"_input"+dlg).value = c[f]);
    [configAvatar_pc, configAvatar_mobile].forEach(fn => fn(c, getColor(id)));
}
  
/**
* @function setupCreateContactDialog
* @description Prepares the dialog for creating a new contact. 
* Configures the button and dialog elements for contact creation.
* 
* @param {number} id - Always negative here, indicating a new contact.
* @param {string} dlg - Dialog suffix used to target PC (`"_pc"`) or other modes (`""`).
*/
function setupCreateContactDialog(id, dlg) {
    document.getElementById("id_Edit_Btn" + dlg).onclick = () => createContact(id);
    createContactDialog(dlg);
    document.getElementById("id_Edit_Btn_Text" + dlg).innerText = "Create";
}
  
/**
* @function addValidationListeners
* @description Attaches real-time validation listeners to both PC and mobile contact forms.
* Runs validation functions for name, email, and phone fields on each keyup event.
*/
function addValidationListeners() {
    document.getElementById("contact_form_pc")?.addEventListener("keyup", e => { 
      validateName(e); validateMail(e); validatePhone(e); 
    });
    document.getElementById("contact_form_mobile")?.addEventListener("keyup", e => { 
      validateNameMobile(e); validateMailMobile(e); validatePhoneMobile(e); 
    });
}

/**
 * Prepares the dialog for creating a new contact.
 * @param {string} kindOfDlgPc - Dialog suffix.
 */
function createContactDialog(kindOfDlgPc) {
  let AddNewcontactAvatar = document.getElementById("add_new_contact_avatar");
  let AddNewcontactAvatar_mobile = document.getElementById("add_new_contact_avatar_mobile");

  const dlgHeadline = document.getElementById("Kind_Of_Dlg" + kindOfDlgPc);
  if (dlgHeadline) dlgHeadline.innerHTML = "Add contact";

  if (AddNewcontactAvatar) {
    AddNewcontactAvatar.style.backgroundColor = "#eeecec";
    AddNewcontactAvatar.innerHTML = `
      <img class="ov_avatar" src="./assets/img/add_new_contact_ov_avatar.png" alt="add new contact avatar">
    `;
  }

  if (AddNewcontactAvatar_mobile) {
    AddNewcontactAvatar_mobile.style.backgroundColor = "#eeecec";
    AddNewcontactAvatar_mobile.innerHTML = `
      <img class="ov_avatar" src="./assets/img/add_new_contact_ov_avatar.png" alt="add new contact avatar">
    `;
  }
}

/**
 * Opens the contact dialog for editing or creating a contact.
 * @param {number} id - The contact index or -1 for new contact.
 */
function openContactDialog(id) {
    switchoffMenu();
    let addNewContactButton = document.getElementById("add_new_contact_button");

    if (addNewContactButton) {
        addNewContactButton.style.display = "none";
    }

    let addNewContactOvSection = document.getElementById(
        "add_new_contact_ov_section"
    );
    if (addNewContactOvSection) {
        addNewContactOvSection.style.display = "flex";
        addNewContactOvSection.innerHTML = getAddNewContactTemplate();
        document.getElementById("add_new_contact_ov_container").style.display ="flex";
    }

    addNewContactSectionState_pc(true);
    configEditDlgBox(id);
}

/**
 * Closes the contact dialog and clears input fields.
 */
function closeContactDialog() {
    let name = document.getElementById("name_input_pc");
    let mail = document.getElementById("mail_input_pc");
    let phone = document.getElementById("phone_input_pc");

    if (name || mail || phone) {
        name.value = "";
        mail.value = "";
        phone.value = "";
    }

    let addNewSection = document.getElementById("add_new_contact_ov_section");
    let addNewContainer = document.getElementById("add_new_contact_ov_container");

    if (name || mail || phone) {
        addNewSection.style.display = "none";
        addNewSection.innerHTML = "";
        addNewContainer.style.display = "none";
    }
}

window.onclick =  (event) =>{
if (event.target.id === "add_new_contact_ov_section") {
        closeContactDialog();
    }
}
/*contact dialog mobile section*/
/**
 * Opens the contact dialog for mobile view.
 * @param {number} id - The contact index or -1 for new contact.
 */
function openContactDialogMobile(id) {
    let mobileDialogTemplate = getAddNewContactMobileTemplate();
    document.getElementById("add_new_contact_mobile_ov_container").innerHTML =
    mobileDialogTemplate;
    configEditDlgBox(id);
    editContactsMobileMenuOff();
    document.getElementById("contact_form_mobile")?.addEventListener("submit", function(event) {
    event.preventDefault()
});
}

/**
 * Closes the contact dialog for mobile view.
 */
function closeContactDialogMobile() {
    const addNewContactMobileOv = document.getElementById(
        "add_new_contact_mobile_ov"
    );

    if (addNewContactMobileOv) {
        addNewContactMobileOv.style.display = "none";
        const addNewContactMobileBtn = document.getElementById(
            "add_new_contact_Mobile_btn"
        );
        if (addNewContactMobileBtn) {
            addNewContactMobileBtn.style.display = "flex";
        }
    }
}

window.onclick =  (event) =>{
if (event.target.id === "add_new_contact_mobile_ov") {
        closeContactDialogMobile();
    }
}

/**
 * Shows the mobile menu for editing contacts.
 */
function editContactsMobileMenuOn() {
    document.getElementById("mobile_view_card_menu").style.display = "flex";
    document.addEventListener("mousedown", handleOutsideClickForMobileMenu);
}

/**
 * Hides the mobile menu for editing contacts.
 */
function editContactsMobileMenuOff() {
    let menu = document.getElementById("mobile_view_card_menu");
    if (menu) {
        menu.style.display = "none";
        document.removeEventListener("mousedown", handleOutsideClickForMobileMenu);
    }
}

/**
 * Sets the display state of the add new contact section for desktop.
 * @param {boolean} state - True to show, false to hide.
 */
function addNewContactSectionState_pc(state) {
    let stateStr = "none";
    if (state == true) stateStr = "flex";
    let section = document.getElementById("add_new_contact_button");
    if (section) {
        section.style.display = stateStr;
    } else {
        let addNewContactSection = document.getElementById(
            "add_new_contact_section"
        );
        if (addNewContactSection) {
            let addNewContact = `
                <button class="add_new_contact_button" id="add_new_contact_button" onclick="openContactDialog(-1)">
                <span class="add_contact_text">Add New Contact</span>
                <img src="./assets/icons/contact/addcontact.png" class="add_contact_icon">
                </button>`;
            addNewContactSection.innerHTML += addNewContact;
            section = document.getElementById("add_new_contact_button");
            section.style.display = stateStr;
        }
    }

    section = document.getElementById("add_new_contact_section");
    if (section) {
        section.style.display = stateStr;
    }
}

/**
 * Sets the display state of the add new contact section for mobile/tablet.
 * @param {boolean} state - True to show, false to hide.
 */
function addNewContactSectionState(state) {
    let stateStr = "none";
    if (state == true) stateStr = "flex";

    let section = document.getElementById("add_new_contact_Mobile_section");
    if (section) {
        section.style.display = stateStr;
    }

    section = document.getElementById("add_new_contact_Mobile_btn");
    if (section) {
        section.style.display = stateStr;
    }
}