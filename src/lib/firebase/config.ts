import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicializa o app Firebase (evita duplicação em hot-reload)
// Guarda contra build-time rendering onde env vars não existem
function initFirebase(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return initializeApp(firebaseConfig);
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;

// Só inicializa se estiver no browser e com credenciais configuradas
if (typeof window !== "undefined" && firebaseConfig.apiKey) {
  try {
    app = initFirebase();
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app, process.env.NEXT_PUBLIC_FIREBASE_REGION || "southamerica-east1");

    // Conecta aos emuladores em dev SE EXPLICITAMENTE CONFIGURADO
    if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (!win.__FIREBASE_EMULATORS_CONNECTED__) {
        try {
          connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
          connectFirestoreEmulator(db, "localhost", 8080);
          connectFunctionsEmulator(functions, "localhost", 5001);
          win.__FIREBASE_EMULATORS_CONNECTED__ = true;
          console.log("[Firebase] Conectado aos Emuladores Locais");
        } catch {
          // Fallback
        }
      }
    }
  } catch (error) {
    console.warn("[Firebase] Erro ao inicializar:", error);
    app = {} as FirebaseApp;
    auth = {} as Auth;
    db = {} as Firestore;
    functions = {} as Functions;
  }
} else {
  if (typeof window !== "undefined" && !firebaseConfig.apiKey) {
    console.warn(
      "[Firebase] API Key não configurada. Crie o arquivo .env.local com as credenciais do Firebase.\n" +
      "Copie .env.local.example como base."
    );
  }
  // SSR/Build ou sem credenciais: cria stubs
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
  functions = {} as Functions;
}

export { app, auth, db, functions };
