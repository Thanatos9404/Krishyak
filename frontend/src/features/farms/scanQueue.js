// Leaf photos taken without a connection wait here, on this phone only, until
// the farmer is online again. Kept apart from the notes outbox because photos
// are large; cleared when the farmer signs out.
const DATABASE = "krishyak-scan-queue-v1";
export const MAX_WAITING = 5;

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("photos", { keyPath: ["owner", "id"] });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Offline storage is unavailable."));
  });
}
async function run(mode, action) {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("photos", mode);
    let result;
    tx.oncomplete = () => {
      database.close();
      resolve(result);
    };
    tx.onerror = tx.onabort = () => {
      database.close();
      reject(new Error("Offline storage could not be updated."));
    };
    const request = action(tx.objectStore("photos"));
    if (request)
      request.onsuccess = () => {
        result = request.result;
      };
  });
}
const range = (owner) => IDBKeyRange.bound([owner, ""], [owner, "￿"]);

export const waitingScans = (owner) =>
  run("readonly", (store) => store.getAll(range(owner)));

export async function queueScan(owner, { plot_id, crop, photo }) {
  if ((await waitingScans(owner)).length >= MAX_WAITING)
    throw new Error(
      "Five photos are already waiting. Connect to check them first.",
    );
  const id = crypto.randomUUID();
  await run("readwrite", (store) =>
    store.add({
      owner,
      id,
      plot_id,
      crop,
      photo,
      queued_at: new Date().toISOString(),
    }),
  );
  return id;
}
export const removeScan = (owner, id) =>
  run("readwrite", (store) => store.delete([owner, id]));

// On a shared phone, photos left by an earlier account are removed as soon as
// someone else signs in.
export async function keepOnlyScansOf(owner) {
  try {
    await run("readwrite", (store) => {
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        if (item.value.owner !== owner) item.delete();
        item.continue();
      };
    });
  } catch {
    /* Nothing was stored. */
  }
}

export async function clearScans(owner) {
  try {
    await run("readwrite", (store) => store.delete(range(owner)));
  } catch {
    /* Nothing was stored. */
  }
}
