/**
 * Cola de cambios que sobrevive a cerrar la app.
 *
 * El reintento que trae Next vive en memoria: si el sistema mata la app con
 * series sin enviar, se pierden. Esto las guarda en el móvil (IndexedDB) y las
 * reenvía en orden cuando vuelve la conexión.
 *
 * Cada operación lleva un id generado aquí, así que reenviarla no duplica nada.
 */

export type QueuedMutation = {
  id: string;
  kind: "addSet";
  workoutId: string;
  workoutExerciseId: string;
  setId: string;
  weight: number;
  reps: number;
  createdAt: number;
};

const DB_NAME = "gym-progress";
const DB_VERSION = 2;
const STORE = "cola";
const STORE_SNAPSHOT = "sesion";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(DB_NAME, DB_VERSION);
    peticion.onupgradeneeded = () => {
      const db = peticion.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOT)) {
        db.createObjectStore(STORE_SNAPSHOT);
      }
    };
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

function transaccion<T>(
  modo: IDBTransactionMode,
  operacion: (store: IDBObjectStore) => IDBRequest<T>,
  almacen: string = STORE,
): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(almacen, modo);
        const peticion = operacion(tx.objectStore(almacen));
        peticion.onsuccess = () => resolve(peticion.result);
        peticion.onerror = () => reject(peticion.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/** IndexedDB puede no existir: ventana privada, almacenamiento bloqueado… */
export function hayAlmacenamiento(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

export async function encolar(mutacion: QueuedMutation): Promise<void> {
  if (!hayAlmacenamiento()) return;
  await transaccion("readwrite", (store) => store.put(mutacion));
}

export async function pendientes(): Promise<QueuedMutation[]> {
  if (!hayAlmacenamiento()) return [];
  try {
    const todas = await transaccion<QueuedMutation[]>("readonly", (store) =>
      store.getAll() as IDBRequest<QueuedMutation[]>,
    );
    return todas.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function descartar(id: string): Promise<void> {
  if (!hayAlmacenamiento()) return;
  await transaccion("readwrite", (store) => store.delete(id));
}

export async function contar(): Promise<number> {
  return (await pendientes()).length;
}

/**
 * Envía la cola en orden. Se para en el primer fallo de red para no romper la
 * secuencia; un rechazo del servidor sí descarta la operación, porque
 * reintentarla daría el mismo error para siempre.
 */
export async function sincronizar(): Promise<{ enviadas: number; quedan: number }> {
  const cola = await pendientes();
  let enviadas = 0;

  for (const mutacion of cola) {
    try {
      const respuesta = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutacion),
      });

      if (respuesta.ok) {
        await descartar(mutacion.id);
        enviadas += 1;
        continue;
      }

      if (respuesta.status >= 400 && respuesta.status < 500) {
        // El servidor la rechaza: reintentarla no va a cambiar nada.
        await descartar(mutacion.id);
        continue;
      }

      break; // error del servidor: se reintenta más tarde
    } catch {
      break; // sin red
    }
  }

  return { enviadas, quedan: (await pendientes()).length };
}

/** Guarda la sesión activa para poder pintarla sin conexión. */
export async function guardarSesion(snapshot: unknown): Promise<void> {
  if (!hayAlmacenamiento()) return;
  try {
    await transaccion("readwrite", (store) => store.put(snapshot, "activa"), STORE_SNAPSHOT);
  } catch {
    // Almacenamiento lleno o bloqueado: seguimos sin copia local.
  }
}

export async function leerSesion<T>(): Promise<T | null> {
  if (!hayAlmacenamiento()) return null;
  try {
    const valor = await transaccion<T | undefined>(
      "readonly",
      (store) => store.get("activa") as IDBRequest<T | undefined>,
      STORE_SNAPSHOT,
    );
    return valor ?? null;
  } catch {
    return null;
  }
}

export async function borrarSesion(): Promise<void> {
  if (!hayAlmacenamiento()) return;
  try {
    await transaccion("readwrite", (store) => store.delete("activa"), STORE_SNAPSHOT);
  } catch {
    // nada que hacer
  }
}
