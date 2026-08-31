function getContactCardTamplate(name, email, initials, index, color) {
  return `
<div class="contact_card" onclick="proofVersion(${index})">
    <div class="contact_avatar_section">
        <div class="contact_avatar" id="contact_avatar" style="background-color:${color};">
            <p class="contact_avatar_initials">${initials[0]}</p>
            <p class="contact_avatar_initials">${initials[1]}</p>
        </div>
    </div>
    <div class="contact_info_section">
        <div class="contact_name"><span>${name}</span></div>
        <p  class="contact_email">${email}</p>
    </div>
</div>`;
}


function getViewCardTemplate(id, color) {
  return `
        <div class="Tablet_view_card">
            <div id="mobile_view_card_header">
                <div class="contact_view_header" id ="contact_view_header">  
                    <div class="contact_view_header_section">
                    <div class="contacts_view_hl_section">
                        <span class="contacts_view_hl">Contacts</span>
                    </div>    
                        
                    <div class="contacts_view_seperator"></div>
                    <div class="contacts_view_sloagen_section">
                        <span class="contacts_view_sloagen">Better wiht a Team</span>
                    </div>
                       
                    <div class="contacts_view_mobile_seperator_section">
                        <div class="mobile_view_card_seperator"></div>
                    </div>    
                </div>    
            </div>
        </div>
      

        <div class="contact_view_card" id="contact_view_card">
            <div class="contact_view_card_header" id="contact_view_card_header">
                <div class="contact_view_avatar_section" >
                    <div class="contact_view_avatar" id="contact_view_avatar"  style="background-color:${color};">
                        <p class="contact_view_avatar_initials" id="contact_view_avatar_initials"></p>
                        <p class="contact_view_avatar_initials" id="contact_view_avatar_initials"></p>
                    </div>
                </div>
                <div class="contact_view_head_info_section">
                    <div class="contact_view_name_section">
                        <span class="contact_view_name" id="contact_view_name"></span>
                    </div>
                    <div class="contact_view_edit_section">
                        <div class="edtit_section">
                            <img  class="contactview_icon" src="./assets/img/edit.png" alt="edit">
                            <span class="edit_txt" onclick="openContactDialog(${id})">Edit</span>
                        </div>
                        <div class="delete_section">
                            <img  class="contactview_icon" src="./assets/img/delete.png" alt="delete">
                            <span class="delete_txt" onclick="promptDeleteContact(${id})">Delete</span>
                        </div> 
                    </div>
                </div>
            </div>
            <div class="contact_view_card_info_section">
                <div class="contact_view_card_info_header">
                    <span class="contact_view_card_info_hl">Contact Information</span>
                </div>
                <div class="contact_view_mail_section">
                    <p class="contact_view_mail_hl">Email</p>
                    <a href="mailto:cooper@gmail.com" id="contact_view_mail" class="contact_view_mail"></a>
                </div>
                <div class="contact_view_phone_section">
                    <p class="contact_view_phon_hl">Phone</p>
                    <div id="contact_view_phone" class="contact_view_phon_num"></div>
                </div>
            </div>
        </div>
    `;
}


function getTabletViewCardTemplate(id, color) {
  return `

   <div class="Tablet_view_card_header"  id="Tablet_view_card_header"></div>

    <div class="contact_view_card" id="contact_view_card">
        <div class="contact_view_card_header" id="contact_view_card_header">
            <div class="contact_view_avatar_section" >
                <div class="contact_view_avatar" id="contact_view_avatar"  style="background-color:${color};">
                    <p class="contact_view_avatar_initials" id="contact_view_avatar_initials"></p>
                    <p class="contact_view_avatar_initials" id="contact_view_avatar_initials"></p>
                </div>
            </div>

            <div class="contact_view_head_info_section">
                <div class="contact_view_name_section">
                    <span class="contact_view_name" id="contact_view_name"></span>
                </div>
                <div class="contact_view_edit_section">
                    <div class="edtit_section">
                        <img  class="contactview_icon" src="./assets/img/edit.png" alt="edit">
                        <span class="edit_txt" onclick="openContactDialogMobile(${id})">Edit</span>
                    </div>
                    <div class="delete_section">
                        <img  class="contactview_icon" src="./assets/img/delete.png" alt="delete">
                        <span class="delete_txt" onclick="promptDeleteContact(${id})">Delete</span>
                    </div> 
                </div>
            </div>
            </div>
            <div class="contact_view_card_info_section">
                <div class="contact_view_card_info_header">
                    <span class="contact_view_card_info_hl">Contact Information</span>
                </div>
                <div class="contact_view_mail_section">
                    <p class="contact_view_mail_hl">Email</p>
                    <div id="contact_view_mail" class="contact_view_mail"></div>
                </div>
                <div class="contact_view_phone_section">
                    <p class="contact_view_phon_hl">Phone</p>
                    <div id="contact_view_phone" class="contact_view_phon_num"></div>
                </div>
            </div>

            <div class="mobil_view_card_edit_section">
                <div class="mobile_view_card_edit_btn" onclick="editContactsMobileMenuOn()">
                    <img class="mobile_view_card_edit_icon" src="./assets/icons/contact/mobile_edtit_menu_icon.png" alt="icon">
                </div>

                <div class="mobile_view_card_menu_section">
                    <div class="mobile_view_card_menu" id="mobile_view_card_menu">
                        <div class="contact_view_edit_mobile_section">
                            <div class="edtit_mobile_section" onclick="openContactDialogMobile(${id})">
                                <img  class="contactview_icon_mobile" src="./assets/icons/contact/edit_mobile.png" alt="edit">
                                <span class="edit_txt_mobile" >Edit</span>
                            </div>
                            <div class="delete_mobile_section">
                                <img  class="contactview_icon" src="./assets/icons/contact/delete_mobile.png" alt="delete">
                                <span class="delete_txt_mobile" onclick="promptDeleteContact(${id})">Delete</span>
                            </div> 
                        </div>
                        </div>
                    </div>
                </div>

    </div>
   `;
}


function getTabletViewCardHeaderTemplate() {
  return `
        <div class="contact_view_header" id="contact_view_header">  
            <div class="contact_view_header_section">
                <div class="contacts_view_hl_section">
                    <span class="contacts_view_hl">Contacts</span>
                </div> 

                <div class="contacts_view_seperator"></div>

                <div class="contacts_view_sloagen_section">
                    <span class="contacts_view_sloagen">Better wiht a Team</span>   
                </div>

                <div class="contacts_view_mobile_seperator_section">
                    <div class="mobile_view_card_seperator"></div>
                </div>    
            </div> 
            
            <div class="go_back_btn_container" id="go_back_btn_container"> 
              <div class="go_back_btn_section" id="go_back_btn_section" onclick="goBacktoContacts()" >
            <img src="./assets/icons/contact/next.png" alt="icon" class="go_back_btn" >
            </div>
            </div>
        </div>`;
}


function getMobileViewCardTemplate(id, color) {
  return `
    <div id="mobile_view_card_header">
      <div class="contact_view_header">  
            <div class="contact_view_header_section" id ="contact_view_header_section">
            <div class="contacts_view_hl_section">
                <span class="contacts_view_hl">Contacts</span>
            </div>    
            <div class="contacts_view_seperator"></div>
            <div class="contacts_view_sloagen_section">
                <span class="contacts_view_sloagen">Better wiht a Team</span>
                
                 </div>
                 <div class="contacts_view_mobile_seperator_section">
                 <div class="mobile_view_card_seperator"></div>
            </div>    
        </div>
           <div class="go_back_btn_container" id="go_back_btn_container">
                <div class="go_back_btn_section" id="go_back_btn_section" onclick="goBacktoContacts()" >
                    <img src="./assets/icons/contact/next.png" alt="icon" class="go_back_btn" >
                </div>
            </div>
        </div>
    </div>
      

        <div class="contact_view_card" id="contact_view_card">
            <div class="contact_view_card_header" id="contact_view_card_header">
                <div class="contact_view_avatar_section" >
                    <div class="contact_view_avatar" id="contact_view_avatar"  style="background-color:${color};>
                        <p class="contact_view_avatar_initials" id="contact_view_avatar_initials"></p>
                        <p class="contact_view_avatar_initials" id="contact_view_avatar_initials"></p>
                    </div>
                </div>
                    <div class="contact_view_head_info_section">
                        <div class="contact_view_name_section">
                            <span class="contact_view_name" id="contact_view_name"></span>
                        </div>
                        <div class="contact_view_edit_section">
                            <div class="edtit_section">
                                <img  class="contactview_icon" src="./assets/img/edit.png" alt="edit">
                                <span class="edit_txt" onclick="openContactDialog(${id})">Edit</span>
                            </div>
                            <div class="delete_section">
                                <img  class="contactview_icon" src="./assets/img/delete.png" alt="delete">
                                <span class="delete_txt" onclick="promptDeleteContact(${id})">Delete</span>
                            </div> 
                        </div>
                    </div>
                </div>

                    <div class="contact_view_card_info_section">
                        <div class="contact_view_card_info_header">
                            <span class="contact_view_card_info_hl">Contact Information</span>
                        </div>
                        <div class="contact_view_mail_section">
                            <p class="contact_view_mail_hl">Email</p>
                            <a href="mailto:cooper@gmail.com" id="contact_view_mail" class="contact_view_mail"></a>
                        </div>
                        <div class="contact_view_phone_section">
                            <p class="contact_view_phon_hl">Phone</p>
                            <div id="contact_view_phone" class="contact_view_phon_num"></div>
                        </div>
                    </div>

                    <div class="mobil_view_card_edit_section">
                        <div class="mobile_view_card_edit_btn" onclick="editContactsMobileMenuOn()">
                            <img class="mobile_view_card_edit_icon" src="./assets/icons/contact/mobile_edtit_menu_icon.png" alt="icon">
                        </div>

                        <div class="mobile_view_card_menu_section">
                            <div class="mobile_view_card_menu" id="mobile_view_card_menu">
                                <div class="contact_view_edit_mobile_section">
                                    <div class="edtit_mobile_section" onclick="openContactDialogMobile(${id})">
                                        <img  class="contactview_icon_mobile" src="./assets/icons/contact/edit_mobile.png" alt="edit">
                                        <span class="edit_txt_mobile" >Edit</span>
                                    </div>
                                    <div class="delete_mobile_section">
                                        <img  class="contactview_icon" src="./assets/icons/contact/delete_mobile.png" alt="delete">
                                        <span class="delete_txt_mobile" onclick="promptDeleteContact(${id})">Delete</span>
                                    </div> 
                                </div>
                                </div>
                            </div>
                            </div>
                        </div>
                    </div>
                </div>
           </div>`;
}


function getAddNewContactTemplate() {
  return `
    <div class="add_new_contact_ov_container" id="add_new_contact_ov_container">
      <div class="add_newcontact_sloagen_container">
        <div class="ov_logo_section" id="ov_logo_section">
          <img class="ov_logo" src="./assets/img/logo-white.svg" alt="join logo">
        </div>
        <div class="ov_hl_section">
          <span class="ov_hl" id="Kind_Of_Dlg_pc">Place</span>
        </div>
        <div class="ov_slogan_section">
          <span class="ov_slogan">Tasks are better with a team!</span>
          <div class="ov_sloagen_seperator"></div>
        </div>
      </div>

      <div class="add_new_contact_entry_section" id="add_new_contact_entry_section">
        <div class="add_new_contact_avatar_section">
          <div class="add_new_contact_avatar" id="add_new_contact_avatar">
            <img class="ov_avatar" src="./assets/img/add_new_contact_ov_avatar.png" alt="add new contact avatar">
          </div>
        </div>

        <div class="add_new_contact_entry">
          <div class="overlay_of_btn_sec">
            <p class="overlay_of_btn" onclick="closeContactDialog()">X</p>
          </div>

          <div  class="add_new_contact_form_pc" >
          <form id="contact_form_pc" method = "GET"> <!--   <form onsubmit="handleContactFormSubmit(event)" id="contact_form_pc">-->
            <input id="name_input_pc" class="add_new_contact_input" type="text" placeholder="Name"  minlength="2" title="Please enter at least 2 characters">
              <div class="form_erro_pc" id="form_name_erro_pc"></div>
            
              <input id="mail_input_pc" class="add_new_contact_input" type="email" placeholder="Mail"  title="Please enter a valid email address">
              <div class="form_erro_pc" id="form_mail_erro_pc"></div>
            
              <input id="phone_input_pc" class="add_new_contact_input" type="tel" placeholder="Phone" pattern="[0-9+\\s\\-\\/]{7,}" title="Enter a valid phone number (min. 7 characters, numbers, +, /, or -)">
              <div class="form_erro_pc" id="form_phone_erro_pc"></div>
            
              <div class="add_new_contact_btn_section">
              <button type="button" class="cancel_btn" onclick="closeContactDialog()">
                <span class="cancel_btn_txt">Cancel X</span>
              </button>
              <button type="submit" class="create_btn" id="id_Edit_Btn_pc">
                <span id="id_Edit_Btn_Text_pc">PlaceHolder</span>
                <img class="create_btn_img" src="./assets/img/create_contact_btn.png" alt="create button">
              </button>
            </div>
          </form>
          </div>

        </div>
      </div>
    </div>
  `;
}


function getAddNewContactMobileTemplate() {
  return `
    <div class="add_new_contact_mobile_ov" id="add_new_contact_mobile_ov">
      <div class="mobile_contact_dialogbox">
        <div class="mobile_contact_dialog_header">
          <div class="close_mobile_contact_dialog_container">
            <div class="close_mobile_contact_dialog_btn_section" onclick="closeContactDialogMobile()">
              <p class="close_mobile_contact_dialog_btn">x</p>
            </div>
          </div>
          <div class="mobile_contact_dialog_header_text_section">
            <div class="ov_hl_section_mobile">
              <span class="ov_hl_mobile" id="Kind_Of_Dlg">Add Contact</span>
            </div>
            <div class="ov_slogan_section_mobile">
              <span class="ov_slogan_mobile">Tasks are better wiht a team!</span>
            </div>
            <div class="ov_sloagen_seperator"></div>
          </div>
        </div>

        <div class="mobile_contact_dialog_avatar_section">
          <div class="add_new_contact_avatar_mobile" id="add_new_contact_avatar_mobile">
            <img class="contact_mobile_dialog_avatar_icon" src="./assets/img/add_new_contact_ov_avatar.png" alt="add new contact avatar">
          </div>
        </div>

        <form id="contact_form_mobile" method = "GET"">
          <div class="mobile_contact_dialog_input_section">
            <input
              id="name_input"
              class="add_new_contact_input_mobile"
              type="text"
              placeholder="Name"
              minlength="2"
              title="Please enter at least 2 characters"
            >
            <div class="form_erro_mobile" id="form_name_erro_mobile"></div>

            <input
              id="mail_input"
              class="add_new_contact_input_mobile"
              type="email"
              placeholder="Mail"
              title="Please enter a valid email address"
            >
            <div class="form_erro_mobile" id="form_mail_erro_mobile"></div>

            <input
              id="phone_input"
              class="add_new_contact_input_mobile"
              type="tel"
              placeholder="Phone"
              pattern="[0-9+\\s\\-\\/]{7,}"
              title="Enter a valid phone number (min. 7 characters, numbers, +, /, or -)"
            >
            <div class="form_erro_mobile" id="form_phone_erro_mobile"></div>

            <button class="create_btn_mobile" type="submit" id="id_Edit_Btn"  >
              <span id="id_Edit_Btn_Text">Create</span>
              <img class="create_btn_img" src="./assets/img/create_contact_btn.png" alt="create button">
            </button>
          </div>
        </form>

      </div>
    </div>
  `;
}


function getGoBackTemplate(tablet_additional_div) {
  return `
            <div id="add_new_contact_ov_section" class="add_new_contact_ov"></div>
            <div id="tablate_view_card_container" class="tablate_view_card_container"></div>
            ${tablet_additional_div}
            <div class="add_new_contact_section" id="add_new_contact_section"></div>
            <div class="contacts_list" id="contacts_list">
                <div class="contacts_section">
                    <div class="contact_card_section" id="contact_card_section"></div>
                </div>
            </div>
            <div class="add_new_contact_Mobile_section">
                <div class="add_new_contact_Mobile_btn" id = "add_new_contact_Mobile_btn" onclick="openContactDialogMobile(-1)">
                    <img class="add_new_contact_mobile_icon" src="./assets/icons/contact/addcontact.png" alt="icon">
                </div>
            </div>
        `;  
}
