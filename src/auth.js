// Authentication module
import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from 'firebase/auth';

const googleProvider = new GoogleAuthProvider();

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred;
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function logOut() {
  return signOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}
