let boardTaskDeletePending = false;

function taskDeleteError(message) {
  return Object.assign(new Error(message), { userMessage: message });
}

function taskDeleteIdentity() {
  const session = getStoredFirebaseAuth();
  return {
    uid: session?.localId || null,
    guest: !session && localStorage.getItem('isGuest') === 'true',
    generation: firebaseAuthGeneration,
  };
}

function taskDeleteIdentityMatches(identity) {
  const current = taskDeleteIdentity();
  return current.uid === identity.uid && current.guest === identity.guest &&
    current.generation === identity.generation;
}

function showTaskDeleteMessage(message, taskId) {
  const overlay = document.getElementById('overlay');
  const insideDetail = overlay?.dataset.openTaskId === taskId &&
    !overlay.classList.contains('d-none');
  for (const id of ['task_action_status', 'board_action_status']) {
    const status = document.getElementById(id);
    if (!status) continue;
    const selected = id === (insideDetail ? 'task_action_status' : 'board_action_status');
    status.textContent = selected ? message : '';
    status.classList.toggle('d-none', !selected || !message);
  }
}

/** Delete one task after confirmation and Firebase acknowledgement, including Guest mode. */
async function deleteTaskFromBoardPopup(taskId) {
  if (boardTaskDeletePending) return false;
  boardTaskDeletePending = true;
  showTaskDeleteMessage('', taskId);
  let deleted = false;
  try {
    if (typeof taskId !== 'string' || !taskId || /[.#$\[\]/\u0000-\u001f\u007f]/.test(taskId)) {
      throw taskDeleteError('This task could not be identified. Please refresh the Board.');
    }
    const identity = taskDeleteIdentity();
    if (!identity.uid && !identity.guest) {
      throw taskDeleteError('Please choose Guest Log in or log in before deleting a task.');
    }

    const confirmed = await showConfirmation('Are you sure you want to delete this task?');
    if (!confirmed) return false;
    if (!taskDeleteIdentityMatches(identity)) {
      throw taskDeleteError('Your session changed. Please reopen the task and try again.');
    }

    const response = await window.authenticatedFirebaseFetch(
      `${BASE_URL}tasks/${encodeURIComponent(taskId)}.json`, { method: 'DELETE' },
    );
    if (!response.ok) {
      throw taskDeleteError(response.status === 401 || response.status === 403
        ? identity.guest
          ? 'Guest task deletion is currently unavailable. Please contact the site owner.'
          : 'Task deletion was denied. Please log in again or check your access.'
        : 'The task could not be deleted. Please try again.');
    }
    deleted = true;
    if (!taskDeleteIdentityMatches(identity)) {
      return true;
    }

    // Invalidate older reads so an in-flight snapshot cannot restore the deleted card.
    taskLoadRequest++;
    tasks = tasks.filter((task) => String(task.id) !== taskId);
    const overlay = document.getElementById('overlay');
    if (overlay?.dataset.openTaskId === taskId) {
      closeOverlay();
      delete overlay.dataset.openTaskId;
    }
    renderCurrentTasks();
    await loadTasksFromFirebase();
    return true;
  } catch (error) {
    const message = deleted
      ? 'The task was deleted, but the Board could not refresh. Please refresh the page.'
      : error.userMessage || 'The task could not be deleted. Check your connection and try again.';
    showTaskDeleteMessage(message, taskId);
    console.error('Task delete failed:', error);
    return deleted;
  } finally {
    boardTaskDeletePending = false;
  }
}

/** Preserve the Board's existing Escape action alongside its detail actions. */
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') closeOverlay();
});
