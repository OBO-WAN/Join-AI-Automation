window.addEventListener("resize", () => {
    handleWindowResize();
});

/**
 * tea window resize events and updates the UI accordingly.
 */
function handleWindowResize() {
    const idx = getActualContactIndex(); switchoffMenu();
    switch (getViewMode()) {
      case 1:
        clearTabletViewCard(); if (!checkIfTabletViewCardActive()) goBacktoContacts();
        document.getElementById("add_new_contact_section").innerHTML = getAddNewContactTemplate();
        renderContacts(Contacts); renderViewCard(idx); addNewContactSectionState_pc(true); break;
      case 2: goBacktoContacts(); addNewContactSectionState_pc(false); break;
      case 3: goBacktoContacts(); MobileVievCard(idx); addNewContactSectionState_pc(false); break;
      case 4: goBacktoContacts(); MobileVievCard(idx); break;
    }
}

/**
 * Checks if the tablet view card header is currently active (visible).
 *
 * @returns {boolean} Returns true if the tablet view card header element exists and is visible; otherwise, false.
 */
function checkIfTabletViewCardActive() {
    let tabletViewCardHeader = document.getElementById("tablate_view_card_header");
    return tabletViewCardHeader && tabletViewCardHeader.style.display !== "none";
}

/**
 * Removes all null or undefined elements from the given contacts array in place.
 *
 * @param {Array} contacts - The array of contacts to be cleaned.
 */
function deletAllNullElementsFromArray(contacts){
    for (let i = contacts.length - 1; i >= 0; i--) {
        if (!contacts[i]) {
            contacts.splice(i, 1);
        }
    }
}

/**
 * Renders the list of contacts in the UI.
 * - Enables scrolling for the contacts list container.
 * - Sorts the contacts array.
 * - Displays the contacts list element.
 * - Generates and inserts contact cards into the contact card section.
 * - Activates click events for contact cards.
 * 
 * @param {Array<Object>} contacts - The array of contact objects to render.
 */
function renderContacts(contacts) {
    switchoffMenu(); scrollEnable();
    deletAllNullElementsFromArray(contacts);
    sortContacts(contacts);
  
    document.getElementById("contacts_list")?.style && (document.getElementById("contacts_list").style.display = "flex");
  
    const cards = generateContactsCards(contacts);
    const section = document.getElementById("contact_card_section");
    if (section) { section.innerHTML = cards; activateContactCardClick(); }
}

/**
 * Renders the contact view card for mobile view.
 * - Hides the contacts list and add new contact section.
 * - Displays the mobile view card for the selected contact.
 * - Calls renderViewCard to fill contact details.
 * 
 * @param {number} index - The index of the contact to display.
 */
function MobileVievCard(index) {
    switchoffMenu();
    if (index < 0) return;
    const color = getColor(index);
    document.getElementById("contacts_list")?.style && (document.getElementById("contacts_list").style.display = "none");
    document.getElementById("add_new_contact_section")?.style && (document.getElementById("add_new_contact_section").style.display = "none");
    const container = document.getElementById("contactslist_container");
    container.innerHTML = getMobileViewCardTemplate(index, color);
    renderViewCard(index);
    container.style.overflow = "hidden";
}

/**
 * Renders the header for the tablet view card.
 */
function getTabletViewCardHeader() {
    let tabletViewCardHeader = getTeblateViewCardHeaderTemplate();
    let tabletViewCardHeaderId = document.getElementById(
        "Tablet_view_card_header"
    );
    tabletViewCardHeaderId.innerHTML = tabletViewCardHeader;
}

/**
 * Renders the contact view card for tablet view.
 * @param {number} index - The contact index.
 */
function renderTabletVievCard(index) {
    switchoffMenu();
    scrollDisable();    
    addNewContactSectionState(true);
    
    if (index >= 0) {
        const contact = Contacts[index];
        const color = getColor(index);

        addNewContactSectionState(false);

        renderTabletCardContainer(index, color);
        fillTabletCardFields(contact);
    }
    hideContactsList();
}

/**
 * Renders the container for the tablet view card.
 * @param {number} index - The contact index.
 * @param {string} color - The avatar color.
 */
function renderTabletCardContainer(index, color) {
    switchoffMenu();
    const TabletViewContainer = document.getElementById("tablate_view_card_container");
    TabletViewContainer.style.display = "flex";
    TabletViewContainer.innerHTML = getTabletViewCardTemplate(index, color);

    const tabletViewCardHeaderId = document.getElementById("Tablet_view_card_header");
    tabletViewCardHeaderId.innerHTML = getTabletViewCardHeaderTemplate();
}

/**
 * Fills the tablet card fields with contact data.
 * @param {Object} contact - The contact object.
 */
function fillTabletCardFields(contact) {
    switchoffMenu();
    document.getElementById("contact_view_avatar_initials").innerText =
        contact.name
            .split(" ")
            .map((word) => word[0].toUpperCase())
            .join("");
    document.getElementById("contact_view_name").innerText = contact.name;
    document.getElementById("contact_view_mail").innerText = contact.mail;
    document.getElementById("contact_view_phone").innerText =
        contact.phone || "No phone number available";
}

/**
 * Hides the contacts list in the UI.
 */
function hideContactsList() {
    const contactsListElem = document.getElementById("contacts_list");
    if (contactsListElem) contactsListElem.style.display = "none";
}

/**
 * Clears the tablet view card container.
 */
function clearTabletViewCard() {
    switchoffMenu();
    let tabletViewCardContainer = document.getElementById(
        "tablate_view_card_container"
    );
    if (tabletViewCardContainer) {
        tabletViewCardContainer.innerHTML = "";
        tabletViewCardContainer.style.display = "none";
    }
}

/**
 * Clears the contact view card based on view mode.
 */
function clearViewCard() {
    switchoffMenu();
    let contactViewCard = document.getElementById("contactViewCard");
    let contact_view_card = document.getElementById("contact_view_card");

    let viewMode = getViewMode();
    if (viewMode === 1 && contactViewCard) {
        contactViewCard.innerHTML = "";
    } else if (viewMode === 2 && contact_view_card) {
        contact_view_card.innerHTML = "";
    } else if (viewMode === 3 && contact_view_card) {
        contact_view_card.innerHTML = "";
    } else if (viewMode === 4 && contact_view_card) {
        contact_view_card.innerHTML = "";
    }

    setActualContactIndex(-1);
}

/**
 * Renders the contact view card for desktop view.
 * @param {number} index - The contact index.
 */
function renderViewCard(index) {
    switchoffMenu();
    setActualContactIndex(index);

    if (index >= 0) {
        let contact = Contacts[index];
        let color = getColor(index);
        let tempViewCard = getViewCardTemplate(index, color);
        document.getElementById("contactViewCard").innerHTML = tempViewCard;

        let initials = getInitials(contact.name || '');
        document.getElementById("contact_view_avatar_initials").innerText = initials.join('');
        document.getElementById("contact_view_name").innerText = contact.name;
        document.getElementById("contact_view_mail").innerText = contact.mail;
        document.getElementById("contact_view_phone").innerText =
            contact.phone || "No phone number available";
    }
}

/**
 * Generates HTML for all contact cards, grouped by first letter.
 * @param {Array} contacts - The contacts array.
 * @returns {string} The HTML string for contact cards.
 */
function generateContactsCards(contacts) {
    let oldLetter = "", cards = "";
    contacts.forEach((c, i) => {
      const initials = getInitials(c.name), first = c.name[0].toUpperCase();
      if (oldLetter !== first) {
        cards += `<div class="contacts_section_header"><p class="contacts_section_letter">${first}</p></div>`;
        oldLetter = first;
      }
      cards += getContactCardTamplate(c.name, c.mail, initials, i, getColor(i));
    });
    return cards;
}

/**
 * Returns to the contacts list view and resets UI.
 */
function goBacktoContacts() {
    switchoffMenu(); let tabletDiv = "", viewMode = getViewMode();
    if ([2,3].includes(viewMode)) {
      tabletDiv = `<div id="tablate_view_card_container" class="tablate_view_card_container"></div>`;
      document.getElementById("contacts_list")?.style && (document.getElementById("contacts_list").style.display = "flex");
    }
    const container = document.getElementById("contactslist_container");
    if (container) {
      container.innerHTML = getGoBackTemplate(tabletDiv);
      contorlAddNewContactSection(viewMode);
    }
    renderContacts(Contacts); setActualContactIndex(-1); clearViewCard();
}

/**
 * Renders the appropriate contact view based on the current version.
 * @param {number} index - The contact index.
 */
function proofVersion(index) {
    setActualContactIndex(index);
    switch (getViewMode()) {
      case 1:  return renderViewCard(index);
      case 2:
      case 3: return renderTabletVievCard(index);
      case 4: return MobileVievCard(index);
    }
}

/**
 * Handles clicks outside the mobile menu to close it.
 * @param {Event} event - The mouse event.
 */
function handleOutsideClickForMobileMenu(event) {
    let menu = document.getElementById("mobile_view_card_menu");
    if (menu && !menu.contains(event.target)) {
        editContactsMobileMenuOff();
    }
}

/**
 * Activates click handlers for all contact cards.
 * When a contact card is clicked, it is highlighted by adding
 * the "active" class while removing the class from all other cards.
 *
 * This ensures that only one contact card is active at a time.
 */
function activateContactCardClick() {
    document.querySelectorAll('.contact_card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.contact_card').forEach(c => 
                c.classList.remove('active')
            );
            this.classList.add('active');
        });
    });
}

/**
 * Enables scrolling for the contacts list container by setting its overflow style to "scroll".
 */
function scrollEnable() {
    let contactListContainer = document.getElementById("contactslist_container");   
    if (contactListContainer) {
        contactListContainer.style.overflow = "scroll";
    }
}

/**
 * Disables scrolling for the contacts list container by setting its overflow style to "hidden".
 */
function scrollDisable() {
    let contactListContainer = document.getElementById("contactslist_container");
    if (contactListContainer) {
        contactListContainer.style.overflow = "hidden";
    }
}