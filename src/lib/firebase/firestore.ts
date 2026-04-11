import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./config";

// Converte timestamps do Firestore para Date
export function convertTimestamps<T>(data: T): T {
  if (!data || typeof data !== "object") return data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const converted: any = { ...data };
  for (const key in converted) {
    const val = converted[key];
    if (val && typeof val === "object" && typeof val.toDate === "function") {
      converted[key] = val.toDate();
    }
  }
  return converted as T;
}

// Busca documento por ID
export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as T;
}

// Listener em tempo real para documento
export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null, error?: Error) => void
): () => void {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(
    docRef, 
    (docSnap) => {
      if (!docSnap.exists()) {
        callback(null);
        return;
      }
      callback(convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as T);
    },
    (err) => {
      console.error("Firestore onSnapshot Error:", err);
      callback(null, err as Error);
    }
  );
}

// Listener em tempo real para coleção com filtros
export function subscribeToCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  callback: (data: T[]) => void
): () => void {
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((doc) =>
      convertTimestamps({ id: doc.id, ...doc.data() }) as T
    );
    callback(items);
  });
}

// Re-exporta helpers do Firestore para uso nos hooks
export { doc, collection, query, where, orderBy, limit, onSnapshot, db };
