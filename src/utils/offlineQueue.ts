const DB_NAME = 'carei-offline'
const DB_VERSION = 1
const STORE = 'queue'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

interface QueueItem {
  id?: number
  type: 'visit' | 'sos' | 'medication' | 'handover' | 'medication-log' | 'voice-memo'
  payload: unknown
  createdAt: string
  retries: number
}

export async function enqueue(item: Omit<QueueItem, 'id' | 'retries' | 'createdAt'>) {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  store.add({ ...item, createdAt: new Date().toISOString(), retries: 0 })
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getQueue(): Promise<QueueItem[]> {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const req = store.getAll()
  return new Promise((resolve, reject) => {
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function removeFromQueue(id: number) {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  store.delete(id)
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function retryItem(id: number) {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const req = store.get(id)
  return new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      if (req.result) {
        req.result.retries = (req.result.retries || 0) + 1
        store.put(req.result)
      }
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}
