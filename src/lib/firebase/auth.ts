import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./config";

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

const googleProvider = new GoogleAuthProvider();

// Simples hash para HMAC fallback. (Em prod pesada seria crypto, aqui no client basta um bypass básico para o QRCode offline ter integridade)
async function generateClientHMAC(uid: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(uid + "_igrejacashless_free");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureUserDocument(user: User, nameFallBack?: string) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    const qrHmac = await generateClientHMAC(user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      name: user.displayName || nameFallBack || user.email?.split("@")[0] || "Usuário",
      role: "user",
      balance: 0,
      qr_hmac: qrHmac,
      is_temp: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(result.user);
  return result.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName: name });
  await ensureUserDocument(result.user, name);
  return result.user;
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDocument(result.user);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function getFirebaseErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/operation-not-allowed": "Operação não permitida.",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/network-request-failed": "Erro de conexão. Verifique sua internet.",
  };
  return messages[code] || "Ocorreu um erro. Tente novamente.";
}
