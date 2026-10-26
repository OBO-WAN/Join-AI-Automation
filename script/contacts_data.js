// Firebase keys stay with records when the contact list is sorted for display.
// Symbols are copied by object spread but never included in JSON sent to Firebase.
const joinContactIdentity = Symbol('Firebase contact identity');
let joinContactWriteBusy = false;

function requireContactSession(identity) {
  const session = getStoredFirebaseAuth();
  if (!session?.localId || (identity && (identity.uid !== session.localId ||
      identity.generation !== firebaseAuthGeneration))) {
    throw new Error('Please log in again to access contacts.');
  }
  return { uid: session.localId, generation: firebaseAuthGeneration };
}

async function contactRequest(key, options, identity) {
  requireContactSession(identity);
  const suffix = key === undefined ? '' : '/' + encodeURIComponent(key);
  const response = await authenticatedFirebaseFetch(
    FIREBASE_WEB_CONFIG.databaseURL + '/contacts' + suffix + '.json',
    { cache: 'no-store', ...options },
  );
  requireContactSession(identity);
  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? 'Contacts access was denied. Please log in again.'
      : 'Contacts could not be loaded or saved. Please try again.');
  }
  return response;
}

async function readJoinContacts() {
  const identity = requireContactSession();
  const response = await contactRequest(undefined, {}, identity);
  const data = await response.json();
  requireContactSession(identity);
  if (data === null) return [];
  if (typeof data !== 'object') throw new Error('The contacts data needs review.');
  return Object.entries(data).filter(([, value]) => value !== null).map(([key, value]) => {
    if (typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string') {
      throw new Error('The contacts data needs review.');
    }
    return { ...value, [joinContactIdentity]: { ...identity, key } };
  });
}

async function saveJoinContact(contact) {
  if (joinContactWriteBusy) return null;
  const identity = contact[joinContactIdentity] || requireContactSession();
  requireContactSession(identity);
  joinContactWriteBusy = true;
  try {
    const response = await contactRequest(identity.key, {
      method: identity.key === undefined ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    }, identity);
    const result = await response.json();
    requireContactSession(identity);
    const key = identity.key ?? result?.name;
    if (typeof key !== 'string' || !key) {
      throw new Error('The save could not be confirmed. Reload contacts before trying again.');
    }
    return { ...contact, [joinContactIdentity]: { ...identity, key } };
  } finally {
    joinContactWriteBusy = false;
  }
}

async function removeJoinContact(contact) {
  if (joinContactWriteBusy) return false;
  const identity = contact?.[joinContactIdentity];
  if (!identity?.key) throw new Error('Reload contacts before deleting this record.');
  requireContactSession(identity);
  joinContactWriteBusy = true;
  try {
    await contactRequest(identity.key, { method: 'DELETE' }, identity);
    return true;
  } finally {
    joinContactWriteBusy = false;
  }
}

function showContactError(error) {
  window.alert(error.message || 'Contacts could not be saved. Please try again.');
}
