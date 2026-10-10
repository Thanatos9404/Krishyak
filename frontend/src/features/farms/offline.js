// Private offline records are keyed by the last authenticated owner. Auth tokens
// never enter IndexedDB. Logout deletes that owner's cache and outbox.
const DATABASE = "krishyak-field-v2";
const blockedOwners = new Set();
export const activateOwner = (owner) => blockedOwners.delete(owner);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("records", {
        keyPath: ["owner", "key"],
      });
      request.result.createObjectStore("outbox", {
        keyPath: ["owner", "operation_id"],
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Offline storage is unavailable."));
  });
}

async function transaction(store, mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode);
    let result;
    tx.oncomplete = () => {
      database.close();
      resolve(result);
    };
    tx.onerror = tx.onabort = () => {
      database.close();
      reject(new Error("Offline storage could not be updated."));
    };
    try {
      const request = action(tx.objectStore(store));
      if (request)
        request.onsuccess = () => {
          result = request.result;
        };
    } catch {
      tx.abort();
    }
  });
}

export const saveRecord = (owner, key, data) =>
  transaction("records", "readwrite", (store) => {
    if (blockedOwners.has(owner)) return;
    return store.put({ owner, key, data, saved_at: new Date().toISOString() });
  });
export async function readRecord(owner, key) {
  const record = await transaction("records", "readonly", (store) =>
    store.get([owner, key]),
  );
  if (record && Date.now() - Date.parse(record.saved_at) > 7 * 86400000) {
    await transaction("records", "readwrite", (store) =>
      store.delete([owner, key]),
    );
    return null;
  }
  return record;
}
export async function queueOperation(owner, operation) {
  if (JSON.stringify(operation).length > 10000)
    throw new Error("This observation is too large for offline storage.");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const count = store.count(
      IDBKeyRange.bound([owner, ""], [owner, "\uffff"]),
    );
    count.onsuccess = () => {
      if (count.result >= 100 || blockedOwners.has(owner)) {
        tx.abort();
        return;
      }
      store.add({ ...operation, owner, queued_at: new Date().toISOString() });
    };
    tx.oncomplete = () => {
      database.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      database.close();
      reject(
        new Error(
          "Offline queue is full or this operation is already saved. Review pending observations.",
        ),
      );
    };
  });
}
export const removeOperation = (owner, id) =>
  transaction("outbox", "readwrite", (store) => store.delete([owner, id]));
export const pendingOperations = (owner) =>
  transaction("outbox", "readonly", (store) =>
    store.getAll(IDBKeyRange.bound([owner, ""], [owner, "\uffff"])),
  );

export async function clearOwner(owner, block = false) {
  if (block) blockedOwners.add(owner);
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = database.transaction(["records", "outbox"], "readwrite");
    for (const name of ["records", "outbox"]) {
      const cursor = tx
        .objectStore(name)
        .openCursor(IDBKeyRange.bound([owner, ""], [owner, "\uffff"]));
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (item) {
          item.delete();
          item.continue();
        }
      };
    }
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () =>
      reject(new Error("Offline data could not be cleared."));
  }).finally(() => database.close());
}

export async function synchronize(owner, send) {
  const operations = await pendingOperations(owner);
  for (const operation of operations) {
    try {
      if (blockedOwners.has(owner))
        throw new Error(
          "This account was signed out. Reconnect and sign in before synchronizing.",
        );
      await send(operation.path, { method: "POST", body: operation.body });
      await removeOperation(owner, operation.operation_id);
    } catch (error) {
      // A rejected/conflicting operation stays reviewable; don't quietly drop it
      // or send later items under another authenticated account.
      return {
        sent: operations.indexOf(operation),
        pending: operations.length - operations.indexOf(operation),
        error,
      };
    }
  }
  return { sent: operations.length, pending: 0 };
}
