import { db } from "../utils/admin";
import { Errors } from "../utils/errors";

/**
 * Rate limiter simples baseado no Firestore.
 * Verifica se o IP/UID ultrapassou o limite de requisições no último minuto.
 *
 * Para produção com alto volume, considerar migrar para Redis.
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests = 20,
  windowMs = 60_000
): Promise<void> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const docId = `rate_${identifier.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const ref = db.collection("_rate_limits").doc(docId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      tx.set(ref, {
        timestamps: [now],
        updated_at: new Date(),
      });
      return;
    }

    const data = snap.data()!;
    const timestamps: number[] = (data.timestamps || []).filter(
      (t: number) => t > windowStart
    );

    if (timestamps.length >= maxRequests) {
      throw Errors.RATE_LIMITED();
    }

    timestamps.push(now);

    tx.update(ref, {
      timestamps,
      updated_at: new Date(),
    });
  });
}
