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
let firebaseAuthGeneration = 0;
let firebaseRefreshRequest = null;

function firebaseAuthError(code, message) {
  return Object.assign(new Error(message), { code });
}

function validFirebaseSession(session) {
  return session && !Array.isArray(session) &&
    [session.localId, session.idToken, session.refreshToken].every(
      (value) => typeof value === "string" && value.trim(),
    ) && typeof session.email === "string" && Number.isFinite(session.expiresAt);
}

function getStoredFirebaseAuth() {
  const sessionValue = sessionStorage.getItem(FIREBASE_AUTH_STORAGE_KEY);
  const localValue = localStorage.getItem(FIREBASE_AUTH_STORAGE_KEY);
  const raw = sessionValue || localValue;
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (!validFirebaseSession(session)) throw new Error("Invalid session shape");
    return session;
  } catch (error) {
    console.warn("Invalid stored Firebase auth session");
    clearFirebaseAuthStorage();
    return null;
  }
}

function clearFirebaseAuthStorage() {
  // Invalidate pending login/refresh work before removing its credentials.
  firebaseAuthGeneration++;
  firebaseRefreshRequest = null;
  sessionStorage.removeItem(FIREBASE_AUTH_STORAGE_KEY);
  localStorage.removeItem(FIREBASE_AUTH_STORAGE_KEY);
  localStorage.removeItem("isGuest");
  clearJoinAuthIdentity();
}

function clearJoinAuthIdentity() {
  for (const key of ["loggedInUserId", "userEmail", "firstName", "lastName", "userInitials", "loggedIn", "activePage"]) {
    sessionStorage.removeItem(key);
  }
  sessionStorage.setItem("isUser", "false");
  sessionStorage.setItem("linksSidebarBoolienKey", "false");
  window.showButtonLinksSidebar = false;
  document.querySelectorAll?.(".name").forEach((element) => { element.textContent = "guest"; });
  if (typeof window.setUserInitials === "function") window.setUserInitials();
}

function storeFirebaseAuth(authData, remember = false) {
  const session = {
    idToken: authData.idToken,
    refreshToken: authData.refreshToken,
    localId: authData.localId || authData.user_id || "",
    email: authData.email || "",
    expiresAt: Date.now() + Number(authData.expiresIn ?? authData.expires_in ?? 3600) * 1000,
  };
  if (!validFirebaseSession(session)) {
    throw firebaseAuthError("AUTH_INVALID_RESPONSE", "Authentication returned an invalid session. Please retry logging in.");
  }

  clearFirebaseAuthStorage();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(FIREBASE_AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

function firebaseAuthSnapshot() {
  const session = getStoredFirebaseAuth();
  const storage = sessionStorage.getItem(FIREBASE_AUTH_STORAGE_KEY) ? sessionStorage : localStorage;
  return { session, storage, raw: storage.getItem(FIREBASE_AUTH_STORAGE_KEY), generation: firebaseAuthGeneration };
}

function requireFirebaseAuthSnapshot(snapshot) {
  const storage = sessionStorage.getItem(FIREBASE_AUTH_STORAGE_KEY) ? sessionStorage : localStorage;
  if (snapshot.generation !== firebaseAuthGeneration || storage !== snapshot.storage ||
      snapshot.raw !== storage.getItem(FIREBASE_AUTH_STORAGE_KEY)) {
    throw firebaseAuthError("AUTH_SESSION_CHANGED", "Your session changed. Please retry or log in again.");
  }
}

function refreshFirebaseIdToken(session) {
  const snapshot = firebaseAuthSnapshot();
  if (!snapshot.session || snapshot.session.localId !== session?.localId ||
      snapshot.session.idToken !== session.idToken || snapshot.session.refreshToken !== session.refreshToken) {
    return Promise.reject(firebaseAuthError("AUTH_SESSION_CHANGED", "Your session changed. Please log in again."));
  }
  if (firebaseRefreshRequest?.snapshot.raw === snapshot.raw &&
      firebaseRefreshRequest.snapshot.storage === snapshot.storage &&
      firebaseRefreshRequest.snapshot.generation === snapshot.generation) {
    return firebaseRefreshRequest.promise;
  }

  const request = { snapshot, promise: null };
  request.promise = performFirebaseTokenRefresh(snapshot).finally(() => {
    if (firebaseRefreshRequest === request) firebaseRefreshRequest = null;
  });
  firebaseRefreshRequest = request;
  return request.promise;
}

async function performFirebaseTokenRefresh(snapshot) {
  const unavailable = () => firebaseAuthError("AUTH_REFRESH_FAILED", "Your session could not be refreshed. Please retry.");
  let response;
  try {
    response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_WEB_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: snapshot.session.refreshToken }),
      },
    );
  } catch (error) {
    requireFirebaseAuthSnapshot(snapshot);
    throw unavailable();
  }
  requireFirebaseAuthSnapshot(snapshot);
  let data;
  try {
    data = await response.json();
  } catch (error) {
    requireFirebaseAuthSnapshot(snapshot);
    throw unavailable();
  }
  requireFirebaseAuthSnapshot(snapshot);
  if (!response.ok) {
    const permanentErrors = ["TOKEN_EXPIRED", "USER_DISABLED", "USER_NOT_FOUND", "INVALID_REFRESH_TOKEN", "MISSING_REFRESH_TOKEN"];
    if (response.status >= 400 && response.status < 500 && response.status !== 429 &&
        permanentErrors.includes(data?.error?.message)) {
      clearFirebaseAuthStorage();
      throw firebaseAuthError("AUTH_SESSION_EXPIRED", "Your session expired. Please log in again.");
    }
    throw unavailable();
  }

  const expiresIn = Number(data?.expires_in);
  const refreshed = {
    idToken: data?.id_token, refreshToken: data?.refresh_token, localId: data?.user_id,
    email: snapshot.session.email, expiresAt: Date.now() + expiresIn * 1000,
  };
  if (!validFirebaseSession(refreshed) || refreshed.localId !== snapshot.session.localId || !(expiresIn > 0)) {
    throw unavailable();
  }
  // Keep the original persistence choice and UI identity. A refresh is not a new login.
  snapshot.storage.setItem(FIREBASE_AUTH_STORAGE_KEY, JSON.stringify(refreshed));
  return refreshed;
}

async function getFirebaseIdToken() {
  const generation = firebaseAuthGeneration;
  let session = getStoredFirebaseAuth();
  if (!session?.idToken) return null;

  if (Number(session.expiresAt) - Date.now() > 60_000) {
    return session.idToken;
  }

  session = await refreshFirebaseIdToken(session);
  const current = getStoredFirebaseAuth();
  if (generation !== firebaseAuthGeneration || current?.idToken !== session.idToken || current?.localId !== session.localId) {
    throw firebaseAuthError("AUTH_SESSION_CHANGED", "Your session changed. Please log in again.");
  }
  return session.idToken;
}

async function authenticatedFirebaseFetch(url, options = {}) {
  const generation = firebaseAuthGeneration;
  const token = await getFirebaseIdToken();
  if (generation !== firebaseAuthGeneration || (token && getStoredFirebaseAuth()?.idToken !== token)) {
    throw firebaseAuthError("AUTH_SESSION_CHANGED", "Your session changed. Please retry or log in again.");
  }
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
  return firebaseAuthenticate("signInWithPassword", email, password, remember);
}

async function firebaseSignUp(email, password) {
  return firebaseAuthenticate("signUp", email, password, false);
}

async function firebaseAuthenticate(endpoint, email, password, remember) {
  // A deliberate login takes precedence over a refresh of the previous session.
  firebaseAuthGeneration++;
  firebaseRefreshRequest = null;
  const snapshot = firebaseAuthSnapshot();
  let data;
  try {
    data = await firebaseEmailPasswordRequest(endpoint, email, password);
  } catch (error) {
    requireFirebaseAuthSnapshot(snapshot);
    throw error;
  }
  requireFirebaseAuthSnapshot(snapshot);
  if (!(Number(data?.expiresIn) > 0)) {
    throw firebaseAuthError("AUTH_INVALID_RESPONSE", "Authentication returned an invalid session. Please retry logging in.");
  }
  return storeFirebaseAuth(data, remember);
}

function firebaseAuthLogout() {
  clearFirebaseAuthStorage();
}

function logOut() {
  firebaseAuthLogout();
  window.location.href = "login.html";
}

async function hydrateAuthenticatedUserProfile(session) {
  const generation = firebaseAuthGeneration;
  requireJoinProfileSession(session.localId, generation);
  const profile = await window.loadJoinUserProfile(session.localId);
  requireJoinProfileSession(session.localId, generation);
  applyJoinProfileToSession(profile);
  return profile;
}

function applyJoinProfileToSession(profile) {
  const firstName = profile?.firstname || profile?.firstName || "";
  const lastName = profile?.lastname || profile?.lastName || "";

  sessionStorage.setItem("firstName", firstName);
  sessionStorage.setItem("lastName", lastName);
  sessionStorage.setItem("userInitials", profile?.initials || "");
  if (typeof window.setUserInitials === "function") window.setUserInitials();
}

function applyJoinAuthIdentity(session) {
  const current = getStoredFirebaseAuth();
  if (!current || current.localId !== session.localId) {
    throw firebaseAuthError("AUTH_SESSION_CHANGED", "Your session changed. Please log in again.");
  }
  sessionStorage.setItem("isUser", "true");
  sessionStorage.setItem("loggedInUserId", current.localId);
  sessionStorage.setItem("userEmail", current.email);
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
    if (error.code === "AUTH_SESSION_CHANGED") showJoinLoginStatus(error.message);
    else if (typeof showLoginError === "function") showLoginError();
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

window.addEventListener?.("storage", (event) => {
  if (event.storageArea !== localStorage || (event.key !== FIREBASE_AUTH_STORAGE_KEY && event.key !== null) ||
      sessionStorage.getItem(FIREBASE_AUTH_STORAGE_KEY)) return;
  firebaseAuthGeneration++;
  firebaseRefreshRequest = null;
  const current = getStoredFirebaseAuth();
  if (!current || current.localId !== sessionStorage.getItem("loggedInUserId")) clearJoinAuthIdentity();
});

{
  const session = getStoredFirebaseAuth();
  if (!session || session.localId !== sessionStorage.getItem("loggedInUserId")) clearJoinAuthIdentity();
}
