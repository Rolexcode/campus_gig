import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  Firestore,
  getFirestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
];

export const firebaseConfigurationMessage =
  "Firebase is not configured yet. Add the CampusGig Firebase web app values to .env.local, then restart the development server.";

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let servicesPromise: Promise<FirebaseServices> | null = null;
let emulatorsConnected = false;

function shouldUseFirebaseEmulators() {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
}

export function isFirebaseConfigured() {
  return requiredConfig.every(Boolean);
}

export function getFirebaseServices(): Promise<FirebaseServices> {
  if (!isFirebaseConfigured()) {
    return Promise.reject(new Error(firebaseConfigurationMessage));
  }

  if (!servicesPromise) {
    servicesPromise = (async () => {
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
      if (shouldUseFirebaseEmulators() && !emulatorsConnected) {
        connectAuthEmulator(
          auth,
          process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ??
            "http://127.0.0.1:9099",
          { disableWarnings: true },
        );
        connectFirestoreEmulator(
          db,
          process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1",
          Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT ?? "8080"),
        );
        emulatorsConnected = true;
      }
      await setPersistence(auth, browserLocalPersistence);
      return { app, auth, db };
    })();
  }

  return servicesPromise;
}
