/**
 * Toggles the visibility of the dropdown menu and go back button section
 * for mobile view.
 */
function toggleMenu() {
  const menu = document.getElementById("dropdown_menu");
  const goBackBtn = document.getElementById("go_back_btn_container");
  const arrowLeft = document.getElementById("arrow-left");
  const contactMobile = document.getElementById("mobile_view_card_header");
  const contactTablet = document.getElementById("Tablet_view_card_header");
  const addTaskResp = document.getElementById("add_task_headline_responsive");
  const addTask = document.getElementById("add_task_headline");
  const open = menu.style.display === "flex";

  menu.style.display = open ? "none" : "flex";
  menu.style.zIndex = open ? "1" : "4000";

  if (goBackBtn) goBackBtn.style.display = open ? "flex" : "none";
  if (arrowLeft) arrowLeft.style.display = open ? "flex" : "none";
  if (contactMobile || contactTablet) if (goBackBtn) goBackBtn.style.display = open ? "flex" : "none";
  if (open && addTaskResp) { addTaskResp.style.zIndex = "3"; addTaskResp.style.display = "flex"; }
  if (!open && addTaskResp) { addTaskResp.style.zIndex = "3"; addTaskResp.style.display = "none"; }
  if (addTask) addTask.style.zIndex = open ? "3" : "1";
}

function switchoffMenu(){
    let goBackBtn = document.getElementById("go_back_btn_container");
    const menu = document.getElementById("dropdown_menu");

    if (menu.style.display == "flex") {
        menu.style.display = "none";
        if (goBackBtn) {
            goBackBtn.style.display = "flex";
        }
    }
} 

/**
 * Sets the active class on the clicked navigation link and navigates to the target href.
 * @param {string} targetHref - The URL to navigate to.
 * @param {HTMLElement} anchor - The anchor element that was clicked.
 */
function toHrefFocus(targetHref, anchor) {
  const allLinks = document.querySelectorAll('.nav-links .link-button');
  allLinks.forEach(link => link.classList.remove('active'));

  const parentLi = anchor.closest('.link-button');
  if (parentLi) parentLi.classList.add('active');

  window.location.href = targetHref;
}

/**
 * Renders the user's initials in the avatar icon if logged in,
 * otherwise sets a default initial.
 */
function setUserInitials() {
  const firstInitial = document.getElementById('first_icon_initials');
  const lastInitial = document.getElementById('last_icon_initials');
  let firstName = sessionStorage.getItem('firstName');
  let lastName = sessionStorage.getItem('lastName');
  let prooofLokedIn = sessionStorage.getItem("isUser");

  if (prooofLokedIn == "true" && firstName && lastName) {
    firstInitial.textContent = firstName[0].toUpperCase();
    lastInitial.textContent = lastName[0].toUpperCase();
    lastInitial.style.display = "flex";
  }
  else{
      let AvatarInitialFirst = document.getElementById("first_icon_initials");
      let AvatarInitialLast = document.getElementById("last_icon_initials");
      AvatarInitialFirst.innerHTML ="G";
      AvatarInitialLast.innerHTML = "";
  }
}

/**
 * Logs out the user by clearing session storage and redirecting to login page.
 */
function logOut() {
  sessionStorage.clear(); 
  window.location.href = 'index.html';
}

window.addEventListener('DOMContentLoaded', setUserInitials);