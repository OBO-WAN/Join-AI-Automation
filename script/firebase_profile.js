function joinProfileError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function requireJoinProfileSession(uid, generation = firebaseAuthGeneration) {
  const session = getStoredFirebaseAuth();
  if (generation !== firebaseAuthGeneration || typeof uid !== 'string' || !uid || session?.localId !== uid ||
      typeof session.idToken !== 'string' || !session.idToken) {
    throw joinProfileError('PROFILE_AUTH_REQUIRED', 'Please log in again.');
  }
  return session;
}

function normalizeJoinProfile(profile) {
  const firstname = profile?.firstname || profile?.firstName;
  const lastname = profile?.lastname || profile?.lastName;
  if (!profile || Array.isArray(profile) || typeof profile !== 'object' ||
      typeof firstname !== 'string' || !firstname.trim() ||
      typeof lastname !== 'string' || !lastname.trim()) {
    throw joinProfileError('PROFILE_INVALID', 'The existing profile needs review.');
  }
  return { ...profile, firstname, lastname };
}

// Private profile requests must never fall back to an unauthenticated write.
async function joinProfileRequest(uid, options = {}) {
  const generation = firebaseAuthGeneration;
  requireJoinProfileSession(uid, generation);
  const token = await getFirebaseIdToken();
  requireJoinProfileSession(uid, generation);
  if (!token) throw joinProfileError('PROFILE_AUTH_REQUIRED', 'Please log in again.');

  const url = new URL(`${FIREBASE_WEB_CONFIG.databaseURL}/user/${encodeURIComponent(uid)}.json`);
  url.searchParams.set('auth', token);
  const response = await fetch(url.toString(), { cache: 'no-store', ...options });
  requireJoinProfileSession(uid, generation);
  return response;
}

async function loadJoinUserProfile(uid) {
  const generation = firebaseAuthGeneration;
  const response = await joinProfileRequest(uid);
  if (!response.ok) {
    throw joinProfileError('PROFILE_READ_FAILED', 'Your profile could not be loaded.', response.status);
  }
  const profile = await response.json();
  requireJoinProfileSession(uid, generation);
  return profile === null ? null : normalizeJoinProfile(profile);
}

async function provisionJoinUserProfile(uid, profile) {
  const generation = firebaseAuthGeneration;
  const session = requireJoinProfileSession(uid);
  const data = {
    firstname: profile.firstname,
    lastname: profile.lastname,
    email: session.email,
    randomColor: profile.randomColor,
    initials: profile.initials,
  };
  normalizeJoinProfile(data);
  const response = await joinProfileRequest(uid, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': 'null_etag' },
    body: JSON.stringify(data),
  });

  // A previous attempt may have committed even when its response was lost.
  if (response.status === 412) {
    const existing = await loadJoinUserProfile(uid);
    requireJoinProfileSession(uid, generation);
    if (existing) return existing;
    throw joinProfileError('PROFILE_CONFLICT', 'Your profile changed. Please retry the profile check.');
  }
  if (!response.ok) {
    throw joinProfileError('PROFILE_WRITE_FAILED', 'Your profile could not be saved.', response.status);
  }
  const saved = await response.json();
  requireJoinProfileSession(uid, generation);
  return normalizeJoinProfile(saved);
}

window.loadJoinUserProfile = loadJoinUserProfile;
window.provisionJoinUserProfile = provisionJoinUserProfile;
