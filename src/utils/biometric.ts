import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric'

const SERVER = 'carei.app'
const TAG = '[CAREi bio]'

// ─── Types ───

export interface BiometricAvailability {
  available: boolean
  biometryType?: string
  errorCode?: number
  errorMessage?: string
}

export interface BiometricCredentials {
  email: string
  token: string
}

// ─── Availability ───

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const result = await NativeBiometric.isAvailable({ useFallback: true })
    console.log(TAG, 'isAvailable:', result)
    return {
      available: result.isAvailable,
      biometryType: (result as any).biometryType,
      errorCode: (result as any).errorCode,
    }
  } catch (err: any) {
    console.log(TAG, 'isAvailable error:', err)
    return { available: false, errorMessage: err?.message || String(err) }
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  return (await getBiometricAvailability()).available
}

// ─── Enabled flag (localStorage) ───

export function getBiometricEnabled(): boolean {
  return localStorage.getItem('carei_biometric_enabled') === 'true'
}

export function setBiometricEnabled(enabled: boolean): void {
  if (enabled) localStorage.setItem('carei_biometric_enabled', 'true')
  else localStorage.removeItem('carei_biometric_enabled')
}

// ─── Biometric prompt ───

export async function verifyBiometric(reason = 'Authenticate to access CAREi'): Promise<boolean> {
  try {
    console.log(TAG, 'verifyIdentity start')
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'CAREi',
      subtitle: 'Biometric Authentication',
      description: 'Use your fingerprint, face, or device PIN to unlock',
      useFallback: true,
      allowedBiometryTypes: [BiometryType.FINGERPRINT, BiometryType.FACE_AUTHENTICATION, BiometryType.DEVICE_CREDENTIAL],
    })
    console.log(TAG, 'verifyIdentity success')
    return true
  } catch (err) {
    console.log(TAG, 'verifyIdentity error:', err)
    return false
  }
}

// ─── Store credentials ───
// Uses AccessControl.NONE so no biometric prompt is needed to store.
// Biometric protection is enforced at retrieval time via verifyIdentity.

export async function storeCredentialsWithBiometric(email: string, refreshToken: string): Promise<boolean> {
  const username = email.toLowerCase()
  console.log(TAG, 'storeCredentials for', username)

  // Clear any existing credentials first
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {
    // ignore — nothing to delete
  }

  // Store with NONE — no biometric prompt required for storage
  try {
    await NativeBiometric.setCredentials({
      username,
      password: refreshToken,
      server: SERVER,
    })
    console.log(TAG, 'setCredentials success')
  } catch (err: any) {
    console.log(TAG, 'setCredentials error:', err)
    return false
  }

  // Verify storage worked
  try {
    const check = await NativeBiometric.isCredentialsSaved({ server: SERVER })
    console.log(TAG, 'post-store check isSaved:', check.isSaved)
    return check.isSaved
  } catch (err) {
    console.log(TAG, 'isCredentialsSaved error after store:', err)
    // setCredentials didn't throw, so assume it worked
    return true
  }
}

// ─── Retrieve credentials ───
// Shows biometric prompt, then retrieves stored credentials.

export async function getCredentialsWithBiometric(): Promise<BiometricCredentials | null> {
  console.log(TAG, 'getCredentials start')

  // Step 1: Biometric prompt
  const verified = await verifyBiometric('Authenticate to access CAREi')
  if (!verified) {
    console.log(TAG, 'biometric verification failed or cancelled')
    return null
  }

  // Step 2: Retrieve credentials (no prompt — already verified)
  try {
    const result = await NativeBiometric.getCredentials({ server: SERVER })
    console.log(TAG, 'getCredentials result:', result ? 'has data' : 'empty')
    if (!result.username || !result.password) return null

    const email = result.username.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log(TAG, 'invalid email format in stored credentials, clearing')
      await deleteBiometricCredentials()
      return null
    }

    return { email, token: result.password }
  } catch (err) {
    console.log(TAG, 'getCredentials error:', err)
    return null
  }
}

// ─── Check if credentials exist (no prompt) ───

export async function hasStoredBiometricCredentials(): Promise<boolean> {
  try {
    const result = await NativeBiometric.isCredentialsSaved({ server: SERVER })
    console.log(TAG, 'hasCredentials:', result.isSaved)
    return result.isSaved
  } catch (err) {
    console.log(TAG, 'hasCredentials error:', err)
    return false
  }
}

// ─── Delete credentials ───

export async function deleteBiometricCredentials(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER })
    console.log(TAG, 'deleteCredentials success')
  } catch (err) {
    console.log(TAG, 'deleteCredentials error:', err)
  }
}
