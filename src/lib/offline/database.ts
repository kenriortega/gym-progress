const DB_NAME = "gym-progress";
const DB_VERSION = 4;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("cola")) db.createObjectStore("cola", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sesion")) db.createObjectStore("sesion");
      if (!db.objectStoreNames.contains("planes")) db.createObjectStore("planes", { keyPath: "userId" });
      if (!db.objectStoreNames.contains("offline-meta")) db.createObjectStore("offline-meta");
      if (!db.objectStoreNames.contains("entrenamientos")) {
        db.createObjectStore("entrenamientos", { keyPath: ["userId", "workoutId"] }).createIndex("userId", "userId");
      }
      if (!db.objectStoreNames.contains("mutaciones")) {
        db.createObjectStore("mutaciones", { keyPath: ["userId", "id"] }).createIndex("userId", "userId");
      }
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Cierra las otras pestañas de Gym Progress para actualizar el almacenamiento local."));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) db.close();
      else resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Solo confirma después del commit, incluidos errores de cuota o de disco. */
export async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  operation: (tx: IDBTransaction, result: (value: T) => void) => void,
): Promise<T> {
  if (typeof indexedDB === "undefined") throw new Error("El almacenamiento local no está disponible.");
  const db = await abrir();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, mode);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    let value: T;
    let failure: unknown;
    tx.addEventListener("offline-error", (event) => { failure = (event as CustomEvent).detail; });
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = () => {
      db.close();
      reject(failure ?? tx.error ?? new Error("No se pudo guardar en el dispositivo."));
    };
    try {
      operation(tx, (next) => { value = next; });
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

export function abortTransaction(tx: IDBTransaction, error: unknown) {
  tx.dispatchEvent(new CustomEvent("offline-error", { detail: error }));
  tx.abort();
}
