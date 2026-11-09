import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { Capacitor } from "@capacitor/core";
import {
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const config = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"],
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"],
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"],
  appId: import.meta.env["VITE_FIREBASE_APP_ID"],
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"],
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"],
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"],
};

const requiredConfig = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export function isFirebaseConfigured() {
  return requiredConfig.every((key) => Boolean(import.meta.env[key]));
}

export function isFirebaseMutationsEnabled() {
  return import.meta.env["VITE_FIREBASE_MUTATIONS_ENABLED"] === "true";
}

export function getFirebaseSetupError() {
  const missing = requiredConfig.filter((key) => !import.meta.env[key]);
  return missing.length === 0
    ? null
    : `Firebase is not configured. Add ${missing.join(", ")} to .env; see the Firebase setup in README.md.`;
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error(getFirebaseSetupError() ?? "Firebase is not configured.");
  }
  if (!app) {
    app = getApps().find((firebaseApp) => firebaseApp.name === "[DEFAULT]") ?? initializeApp(config);
  }
  return app;
}

export function getFirebaseAuth() {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    auth = Capacitor.isNativePlatform()
      ? initializeAuth(firebaseApp, { persistence: indexedDBLocalPersistence })
      : getAuth(firebaseApp);
  }
  return auth;
}

export function getFirebaseDb() {
  if (!db) {
    const firebaseApp = getFirebaseApp();
    db =
      typeof window === "undefined"
        ? getFirestore(firebaseApp)
        : initializeFirestore(firebaseApp, {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            }),
          });
  }
  return db;
}

export function getFirebaseFunctions() {
  return getFunctions(getFirebaseApp(), "africa-south1");
}
