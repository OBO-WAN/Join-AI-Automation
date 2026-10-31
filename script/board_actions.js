let boardTaskDeletePending = false;

function taskDeleteError(message) {
  return Object.assign(new Error(message), { userMessage: message });
}

/** Delete one task only after confirmation and an authenticated acknowledgement. */
async function deleteTaskFromBoardPopup(taskId) {
  if (boardTaskDeletePending) return false;
  boardTaskDeletePending = true;
  let deleted = false;
  try {
    if (typeof taskId !== 'string' || !taskId || /[.#$\[\]/\u0000-\u001f\u007f]/.test(taskId)) {
      throw taskDeleteError('This task could not be identified. Please refresh the Board.');
    }
    const session = getStoredFirebaseAuth();
    const generation = firebaseAuthGeneration;
    if (!session?.localId) throw taskDeleteError('Please log in before deleting a task.');

    const confirmed = await showConfirmation('Are you sure you want to delete this task?');
    if (!confirmed) return false;
    if (generation !== firebaseAuthGeneration || getStoredFirebaseAuth()?.localId !== session.localId) {
      throw taskDeleteError('Your session changed. Please reopen the task and try again.');
    }

    const response = await window.authenticatedFirebaseFetch(
      `${BASE_URL}tasks/${encodeURIComponent(taskId)}.json`, { method: 'DELETE' },
    );
    if (!response.ok) {
      throw taskDeleteError(response.status === 401 || response.status === 403
        ? 'Task deletion was denied. Please log in again or check your access.'
        : 'The task could not be deleted. Please try again.');
    }
    deleted = true;
    if (generation !== firebaseAuthGeneration || getStoredFirebaseAuth()?.localId !== session.localId) {
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
    window.alert(message);
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
