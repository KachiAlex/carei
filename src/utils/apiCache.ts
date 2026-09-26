/**
 * Path-keyed IndexedDB cache for GET responses.
 * Lets every read endpoint serve its last-known-good data when the
 * device is offline — stale data beats an empty screen for carers.
 */

const DB_NAME = 'carei-api-cache'
const DB_VERSION = 1
const STORE = 'responses'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
  })
}

export async function setApiCache(key: string, data: unknown): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ key, data, cachedAt: new Date().toISOString() })
    return new Promise((resolve) => {
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    })
  } catch {
    // Cache write failure must never break a request
  }
}

export async function getApiCache(key: string): Promise<{ data: unknown; cachedAt: string } | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    return new Promise((resolve) => {
      req.onsuccess = () => { db.close(); resolve(req.result || null) }
      req.onerror = () => { db.close(); resolve(null) }
    })
  } catch {
    return null
  }
}

export async function clearApiCache(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    return new Promise((resolve) => {
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    })
  } catch {
    // ignore
  }
}
