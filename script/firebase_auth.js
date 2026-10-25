const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyCAgXTll6jHi9ahzJgbnxRVUV5u6oLbvtw",
  authDomain: "join-ai-automation.firebaseapp.com",
  databaseURL: "https://join-ai-automation-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "join-ai-automation",
  storageBucket: "join-ai-automation.firebasestorage.app",
  messagingSenderId: "884896656879",
  appId: "1:884896656879:web:68efebc7944d25e36ada1a",
  measurementId: "G-X3V7YDHK3N",
};

const FIREBASE_AUTH_STORAGE_KEY = "joinFirebaseAuth";

function getStoredFirebaseAuth() {
  const sessionValue = sessionStorage.getItem(FIREBASE_AUTH_STORAGE_KEY);
  const localValue = localStorage.getItem(FIREBASE_AUTH_STORAGE_KEY);
  const raw = sessionValue || localValue;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Invalid stored Firebase auth session", error);
    clearFirebaseAuthStorage();
    return null;
  }
}

function clearFirebaseAuthStorage() {
  sessionStorage.removeItem(FIREBASE_AUTH_STORAGE_KEY);
  localStorage.removeItem(FIREBASE_AUTH_STORAGE_KEY);
}

function storeFirebaseAuth(authData, remember = false) {
  const session = {
    idToken: authData.idToken,
    refreshToken: authData.refreshToken,
    localId: authData.localId || authData.user_id || "",
    email: authData.email || "",
    expiresAt: Date.now() + Number(authData.expiresIn || authData.expires_in || 3600) * 1000,
  };

  clearFirebaseAuthStorage();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(FIREBASE_AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

async function refreshFirebaseIdToken(session) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
  });

  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_WEB_CONFIG.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!response.ok) {
    clearFirebaseAuthStorage();
    throw new Error("Firebase session expired. Please log in again.");
  }

  const data = await response.json();
  const remember = Boolean(localStorage.getItem(FIREBASE_AUTH_STORAGE_KEY));
  return storeFirebaseAuth(
    {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      localId: data.user_id,
      email: session.email,
      expiresIn: data.expires_in,
    },
    remember,
  );
}

async function getFirebaseIdToken() {
  let session = getStoredFirebaseAuth();
  if (!session?.idToken) return null;

  if (Number(session.expiresAt) - Date.now() > 60_000) {
    return session.idToken;
  }

  session = await refreshFirebaseIdToken(session);
  return session.idToken;
}

async function authenticatedFirebaseFetch(url, options = {}) {
  const token = await getFirebaseIdToken();
  if (!token) return fetch(url, options);

  const requestUrl = new URL(url, window.location.href);
  requestUrl.searchParams.set("auth", token);
  return fetch(requestUrl.toString(), options);
}

async function firebaseEmailPasswordRequest(endpoint, email, password) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${FIREBASE_WEB_CONFIG.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Firebase authentication failed");
  }
  return data;
}

async function firebaseSignIn(email, password, remember = false) {
  const data = await firebaseEmailPasswordRequest("signInWithPassword", email, password);
  return storeFirebaseAuth(data, remember);
}

async function firebaseSignUp(email, password) {
  const data = await firebaseEmailPasswordRequest("signUp", email, password);
  return storeFirebaseAuth(data, false);
}

function firebaseAuthLogout() {
  clearFirebaseAuthStorage();
  sessionStorage.removeItem("loggedInUserId");
  sessionStorage.removeItem("userEmail");
  sessionStorage.removeItem("firstName");
  sessionStorage.removeItem("lastName");
  sessionStorage.removeItem("userInitials");
  sessionStorage.setItem("isUser", "false");
}

async function hydrateAuthenticatedUserProfile(session) {
  const profile = await window.loadJoinUserProfile(session.localId);
  requireJoinProfileSession(session.localId);
  applyJoinProfileToSession(profile);
  return profile;
}

function applyJoinProfileToSession(profile) {
  const firstName = profile?.firstname || profile?.firstName || "";
  const lastName = profile?.lastname || profile?.lastName || "";

  sessionStorage.setItem("firstName", firstName);
  sessionStorage.setItem("lastName", lastName);
  sessionStorage.setItem("userInitials", profile?.initials || "");
}

function applyJoinAuthIdentity(session) {
  sessionStorage.setItem("isUser", "true");
  sessionStorage.setItem("loggedInUserId", session.localId);
  sessionStorage.setItem("userEmail", session.email);
  localStorage.removeItem("isGuest");
  applyJoinProfileToSession(null);
}

function showJoinLoginStatus(message, retry = false) {
  const status = document.getElementById("login_status");
  if (status) {
    status.textContent = message;
    status.classList.toggle("d-none", !message);
  }
  document.getElementById("body_log_in")?.classList.toggle("auth-status-visible", Boolean(message));
  document.getElementById("retry_profile_button")?.classList.toggle("d-none", !retry);
}

let joinLoginBusy = false;

function setJoinLoginBusy(busy) {
  joinLoginBusy = busy;
  const button = document.getElementById("login_button");
  if (button) button.disabled = busy;
  const retry = document.getElementById("retry_profile_button");
  if (retry) retry.disabled = busy;
}

async function finishJoinLogin(session) {
  try {
    const profile = await hydrateAuthenticatedUserProfile(session);
    requireJoinProfileSession(session.localId);
    window.location.href = profile ? "summary.html" : "sign_up.html?completeProfile=1";
    return true;
  } catch (error) {
    console.warn("Could not load JOIN profile", error);
    const signedIn = Boolean(getStoredFirebaseAuth()?.localId);
    const message = signedIn
      ? "You are signed in, but your JOIN profile could not be loaded. Please retry."
      : "Your session is unavailable. Please log in again.";
    showJoinLoginStatus(message, signedIn);
    return false;
  }
}

async function retryJoinLoginProfile() {
  if (joinLoginBusy) return false;
  const session = getStoredFirebaseAuth();
  if (!session?.localId) {
    showJoinLoginStatus("Please log in again.");
    return false;
  }
  setJoinLoginBusy(true);
  try {
    applyJoinAuthIdentity(session);
    return await finishJoinLogin(session);
  } finally {
    setJoinLoginBusy(false);
  }
}

async function handleFirebaseLogin() {
  if (joinLoginBusy) return false;
  const emailInput = document.getElementById("email_log_in");
  const passwordInput = document.getElementById("password_log_in");
  if (!emailInput || !passwordInput) return false;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const remember = Boolean(document.getElementById("rememberMe")?.checked);

  if (!validateEmailLogin(emailInput) || !validatePasswordLogin(passwordInput)) {
    return false;
  }

  setJoinLoginBusy(true);
  showJoinLoginStatus("");
  try {
    const session = await firebaseSignIn(email, password, remember);
    applyJoinAuthIdentity(session);
    return await finishJoinLogin(session);
  } catch (error) {
    console.warn("Firebase login failed", error);
    if (typeof showLoginError === "function") showLoginError();
    else if (typeof showLoginOverlayErrorOnly === "function") showLoginOverlayErrorOnly();
    return false;
  } finally {
    setJoinLoginBusy(false);
  }
}

window.FIREBASE_WEB_CONFIG = FIREBASE_WEB_CONFIG;
window.authenticatedFirebaseFetch = authenticatedFirebaseFetch;
window.firebaseSignIn = firebaseSignIn;
window.firebaseSignUp = firebaseSignUp;
window.firebaseAuthLogout = firebaseAuthLogout;
window.firebaseAuthIsSignedIn = () => Boolean(getStoredFirebaseAuth());
window.handleFirebaseLogin = handleFirebaseLogin;
