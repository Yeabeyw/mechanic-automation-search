import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from 'firebase/functions';
import type { AuditEntry, SecurityPolicy, User } from './types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
export const auth = getAuth(app);
const functions = getFunctions(app, 'africa-south1');

if (import.meta.env.DEV) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Typed callables: the response shapes match functions/src/index.ts.
export async function listUserRoles() {
  const fn = httpsCallable<Record<string, never>, { users: User[] }>(functions, 'listUserRoles');
  return fn({});
}

export async function setUserRole(targetUid: string, role: string, action: 'grant' | 'revoke') {
  const fn = httpsCallable<
    { targetUid: string; role: string; action: 'grant' | 'revoke' },
    { success: boolean }
  >(functions, 'setUserRole');
  return fn({ targetUid, role, action });
}

export async function getSecurityPolicy() {
  const fn = httpsCallable<Record<string, never>, SecurityPolicy>(functions, 'getSecurityPolicy');
  return fn({});
}

export type AuditLogParams = {
  limit?: number;
  startAfter?: number;
  filterActor?: string | undefined;
  filterAction?: string | undefined;
  filterResult?: string | undefined;
};

export async function listAuditLog(params: AuditLogParams = {}) {
  const fn = httpsCallable<AuditLogParams, { entries: AuditEntry[] }>(functions, 'listAuditLog');
  return fn(params);
}
