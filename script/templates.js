function getKanbanTemplate(taskIndex) {
    return `                <div class="task_container">
                    <div class="task">
                        <div class="task_category user_story">User Story</div>

                        <div class="task_information">
                            <p class="task_title">Contact Form & Imprint</p>
                            <p class="task_details">Create a contact form and imprint page...</p>
                        </div>

                        <div class="progress_container">
                            <div class="progress-bar" style="width: 50%;"></div>
                            <p class="subtasks_progress">1/2 Subtasks</p>
                        </div>

                        <div class="user_priority_container">
                            <div class="user_initials">XY</div>
                            <img src="./assets/icons/priority/priority_medium.png" class="priority_medium">
                        </div>

                    </div>
                </div>

`
}