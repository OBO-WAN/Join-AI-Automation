let passwordResetBusy = false;
let passwordResetComplete = false;

const passwordResetConfirmation = 'If an account exists for this email, you will receive a password-reset link. Check your inbox and spam folder.';

function showPasswordResetStatus(message) {
  const status = document.getElementById('password_reset_status');
  status.textContent = message;
  status.classList.toggle('d-none', !message);
}

function clearPasswordResetFeedback() {
  if (passwordResetBusy) return;
  passwordResetComplete = false;
  document.getElementById('password_reset_button').disabled = false;
  document.getElementById('password_reset_email').removeAttribute('aria-invalid');
  showPasswordResetStatus('');
}

async function requestJoinPasswordReset(email) {
  let response;
  try {
    response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_CONFIG.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
      },
    );
  } catch (error) {
    throw new Error('The reset request could not be confirmed. Check your connection and inbox before trying again.');
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('The reset request could not be confirmed. Check your inbox before trying again.');
  }

  const code = typeof data?.error?.message === 'string' ? data.error.message : '';
  // Keep the result identical for unknown and existing accounts.
  if (!response.ok && !['EMAIL_NOT_FOUND', 'USER_DISABLED'].includes(code)) {
    if (response.status === 429 || code.startsWith('TOO_MANY_ATTEMPTS')) {
      throw new Error('Too many requests. Please wait a while before trying again.');
    }
    if (code === 'INVALID_EMAIL') throw new Error('Please enter a valid email address.');
    throw new Error('Password reset is temporarily unavailable. Please try again later.');
  }
}

async function handlePasswordReset(event) {
  event?.preventDefault();
  if (passwordResetBusy || passwordResetComplete) return false;

  const input = document.getElementById('password_reset_email');
  const button = document.getElementById('password_reset_button');
  const email = input.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    input.setAttribute('aria-invalid', 'true');
    showPasswordResetStatus('Please enter a valid email address.');
    input.focus();
    return false;
  }

  passwordResetBusy = true;
  button.disabled = true;
  button.textContent = 'Sending…';
  input.readOnly = true;
  input.removeAttribute('aria-invalid');
  showPasswordResetStatus('');
  try {
    await requestJoinPasswordReset(email);
    passwordResetComplete = true;
    showPasswordResetStatus(passwordResetConfirmation);
    return true;
  } catch (error) {
    showPasswordResetStatus(error.message);
    return false;
  } finally {
    passwordResetBusy = false;
    button.disabled = passwordResetComplete;
    button.textContent = 'Send me the email';
    input.readOnly = false;
  }
}
