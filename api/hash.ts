import crypto from 'crypto'

const SCRYPT_KEYLEN = 32
const SCRYPT_COST = 16384 // N = 2^14
const SCRYPT_BLOCKSIZE = 8
const SCRYPT_PARALLELISM = 1

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCKSIZE,
      p: SCRYPT_PARALLELISM,
    }, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

export async function hashCredential(credential: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(credential, salt)
  return `${salt}:${derivedKey.toString('hex')}`
}

export async function verifyCredential(credential: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const derivedKey = await scryptAsync(credential, salt)
  return derivedKey.toString('hex') === hash
}

// Detect legacy SHA-256 hash (64 hex chars, no salt prefix)
export function isLegacySHA256(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash)
}
