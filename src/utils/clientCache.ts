/**
 * IndexedDB cache for Client and Visit data to support full offline viewing.
 */

const DB_NAME = 'carei-cache';
const DB_VERSION = 1;
const CLIENT_STORE = 'clients';
const VISIT_STORE = 'visits';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CLIENT_STORE)) db.createObjectStore(CLIENT_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(VISIT_STORE)) db.createObjectStore(VISIT_STORE, { keyPath: 'id' });
    };
  });
}

export async function cacheClient(client: any) {
  if (!client?.id) return;
  const db = await openDB();
  const tx = db.transaction(CLIENT_STORE, 'readwrite');
  tx.objectStore(CLIENT_STORE).put({ ...client, cachedAt: new Date().toISOString() });
  return new Promise<void>((resolve) => {
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}

export async function getCachedClient(clientId: string): Promise<any | null> {
  const db = await openDB();
  const tx = db.transaction(CLIENT_STORE, 'readonly');
  const req = tx.objectStore(CLIENT_STORE).get(clientId);
  return new Promise((resolve) => {
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); resolve(null); };
  });
}

export async function cacheVisit(visit: any) {
  if (!visit?.id) return;
  const db = await openDB();
  const tx = db.transaction(VISIT_STORE, 'readwrite');
  tx.objectStore(VISIT_STORE).put({ ...visit, cachedAt: new Date().toISOString() });
  return new Promise<void>((resolve) => {
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}

export async function getCachedVisit(visitId: string): Promise<any | null> {
  const db = await openDB();
  const tx = db.transaction(VISIT_STORE, 'readonly');
  const req = tx.objectStore(VISIT_STORE).get(visitId);
  return new Promise((resolve) => {
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); resolve(null); };
  });
}
