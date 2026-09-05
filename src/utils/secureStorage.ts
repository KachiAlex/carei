// Encrypted storage abstraction using Web Crypto API.
// Falls back to localStorage on browsers without Crypto support.

const STORAGE_PREFIX = 'carei_secure_'
const MASTER_KEY_NAME = 'carei_master_key'

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const raw = localStorage.getItem(MASTER_KEY_NAME)
  if (raw) {
    const buf = hexToBuffer(raw)
    return crypto.subtle.importKey('raw', buf, 'AES-GCM', false, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const exported = await crypto.subtle.exportKey('raw', key)
  localStorage.setItem(MASTER_KEY_NAME, bufferToHex(new Uint8Array(exported)))
  return key
}

function bufferToHex(buf: Uint8Array): string {
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function decodeText(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf)
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (!crypto.subtle) {
    localStorage.setItem(STORAGE_PREFIX + key, value)
    return
  }
  const masterKey = await getOrCreateMasterKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, encodeText(value))
  const payload = JSON.stringify({
    iv: bufferToHex(iv),
    data: bufferToHex(new Uint8Array(encrypted)),
  })
  localStorage.setItem(STORAGE_PREFIX + key, payload)
}

export async function secureGet(key: string): Promise<string | null> {
  const raw = localStorage.getItem(STORAGE_PREFIX + key)
  if (!raw) return null
  if (!crypto.subtle) return raw
  try {
    const payload = JSON.parse(raw)
    const iv = hexToBuffer(payload.iv)
    const data = hexToBuffer(payload.data)
    const masterKey = await getOrCreateMasterKey()
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, data)
    return decodeText(decrypted)
  } catch {
    // If decryption fails (e.g. key rotated), return null
    return null
  }
}

export async function secureRemove(key: string): Promise<void> {
  localStorage.removeItem(STORAGE_PREFIX + key)
}

export async function secureWipe(): Promise<void> {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX))
  keys.forEach((k) => localStorage.removeItem(k))
  localStorage.removeItem(MASTER_KEY_NAME)
}

// Legacy migration: move plaintext tokens into encrypted storage
export async function migrateToSecureStorage(): Promise<void> {
  const token = localStorage.getItem('carei_token')
  if (token) {
    await secureSet('token', token)
    localStorage.removeItem('carei_token')
  }
  const user = localStorage.getItem('carei_user')
  if (user) {
    await secureSet('user', user)
    localStorage.removeItem('carei_user')
  }
}
