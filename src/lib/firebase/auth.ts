import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { auth } from "./config";

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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

async function ensureUserDocument(user: User, nameFallBack?: string, cpf?: string) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // Doc ainda não existe — cria do zero.
    const qrHmac = await generateClientHMAC(user.uid);
    const baseDoc: Record<string, unknown> = {
      uid: user.uid,
      email: user.email || "",
      name: user.displayName || nameFallBack || user.email?.split("@")[0] || "Usuário",
      role: "user",
      balance: 0,
      qr_hmac: qrHmac,
      is_temp: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    if (cpf) baseDoc.cpf = cpf;
    await setDoc(userRef, baseDoc);
    return;
  }

  // Doc já existe (provavelmente criado pelo trigger onUserCreate, que roda
  // ANTES desta função e não tem acesso ao CPF do formulário). Se o CPF foi
  // informado no cadastro mas o doc ainda não tem, atualiza só esse campo.
  // Evita que o user precise digitar CPF de novo na hora do PIX.
  const data = snap.data();
  if (cpf && !data?.cpf) {
    try {
      await updateDoc(userRef, {
        cpf,
        updated_at: serverTimestamp(),
      });
    } catch (err) {
      // Não bloqueia o login se o update falhar — o user vai precisar
      // informar o CPF na hora do PIX como fallback.
      console.warn("[ensureUserDocument] não foi possível salvar CPF:", err);
    }
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
  name: string,
  cpf?: string,
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName: name });
  await ensureUserDocument(result.user, name, cpf);
  return result.user;
}

/**
 * Detecta dispositivos móveis para escolher o fluxo de login Google adequado.
 * Em mobile usamos signInWithRedirect (popup é instável em iOS Safari, Android
 * Chrome em PWA, e bloqueado em alguns webviews).
 */
function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Erros que indicam que o popup não conseguiu abrir/funcionar e devemos
 * cair pra `signInWithRedirect` (que sempre funciona, mas navega a página).
 *
 * - popup-blocked: navegador bloqueou (ex.: Chrome desktop sem user-gesture suficiente)
 * - popup-closed-by-user: usuário fechou (ou o navegador fechou silenciosamente)
 * - cancelled-popup-request: outra tentativa foi disparada (geralmente sintoma de problema)
 * - operation-not-supported-in-this-environment: webview/PWA sem suporte a popup
 * - missing-or-invalid-nonce: alguns navegadores em modo privado
 */
const POPUP_FAILURE_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/missing-or-invalid-nonce",
  "auth/web-storage-unsupported",
]);

export async function signInWithGoogle(): Promise<User | null> {
  if (isMobile()) {
    // Mobile: vai direto pro redirect (popup é instável em iOS Safari, Android
    // Chrome em PWA, e bloqueado em alguns webviews).
    await signInWithRedirect(auth, googleProvider);
    return null; // a página será recarregada pelo provedor
  }
  // Desktop: tenta popup primeiro
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDocument(result.user);
    return result.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || "";
    if (POPUP_FAILURE_CODES.has(code)) {
      // Popup falhou (bloqueado, fechado, ou ambiente sem suporte) — cai pra redirect
      console.warn(`[signInWithGoogle] popup falhou com ${code}, usando redirect`);
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    // Outros erros (rede, conta desativada, etc.) sobem pra UI mostrar
    throw err;
  }
}

/**
 * Consome o resultado de um signInWithRedirect pendente (após o usuário
 * voltar do Google). Garante que o documento do usuário exista no Firestore.
 * Retorna o User se houve redirect bem-sucedido, ou null caso contrário.
 */
export async function consumeGoogleRedirect(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    await ensureUserDocument(result.user);
    return result.user;
  } catch (err) {
    console.error("Erro ao consumir redirect Google:", err);
    throw err;
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  auth.languageCode = "pt"; // Força idioma da interface de e-mail e página para Português
  await sendPasswordResetEmail(auth, email);
}

export function getFirebaseErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/operation-not-allowed": "Operação não permitida.",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "A senha está incorreta.",
    "auth/invalid-credential": "E-mail não encontrado ou senha incorreta.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/network-request-failed": "Erro de conexão. Verifique sua internet.",
    "auth/missing-email": "Informe um e-mail válido.",
  };
  return messages[code] || "Ocorreu um erro verifique os dados inseridos. (" + code + ")";
}
