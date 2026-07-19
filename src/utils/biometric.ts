import { NativeBiometric, AccessControl } from '@capgo/capacitor-native-biometric'

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

// ─── Biometric prompt only (no credential retrieval) ───

export async function verifyBiometric(reason = 'Authenticate to access CAREi'): Promise<boolean> {
  try {
    console.log(TAG, 'verifyIdentity start')
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'CAREi',
      subtitle: 'Biometric Authentication',
      description: 'Use your fingerprint, face, or device PIN to unlock',
      useFallback: true,
    })
    console.log(TAG, 'verifyIdentity success')
    return true
  } catch (err) {
    console.log(TAG, 'verifyIdentity error:', err)
    return false
  }
}

// ─── Store credentials ───
// Uses BIOMETRY_CURRENT_SET: credentials are tied to the current biometric
// enrolment. This is the plugin's native, tested pattern on Android.

export async function storeCredentialsWithBiometric(email: string, refreshToken: string): Promise<boolean> {
  const username = email.toLowerCase()
  console.log(TAG, 'storeCredentials for', username)

  // Clear any existing credentials first
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {
    // ignore — nothing to delete
  }

  // Try BIOMETRY_ANY first (recommended for most apps), then CURRENT_SET
  for (const accessControl of [AccessControl.BIOMETRY_ANY, AccessControl.BIOMETRY_CURRENT_SET]) {
    try {
      console.log(TAG, 'setCredentials accessControl:', accessControl)
      await NativeBiometric.setCredentials({
        username,
        password: refreshToken,
        server: SERVER,
        accessControl,
      })
      console.log(TAG, 'setCredentials success with', accessControl)
      return true
    } catch (err: any) {
      console.log(TAG, 'setCredentials failed with', accessControl, ':', err)
    }
  }

  console.log(TAG, 'setCredentials failed all access controls')
  return false
}

// ─── Retrieve credentials ───
// getSecureCredentials shows the biometric prompt and returns the credential.
// This is the native, tested retrieval path for the plugin.

export async function getCredentialsWithBiometric(): Promise<BiometricCredentials | null> {
  console.log(TAG, 'getCredentials start')
  try {
    const result = await NativeBiometric.getSecureCredentials({
      server: SERVER,
      reason: 'Authenticate to access CAREi',
      title: 'CAREi',
      subtitle: 'Biometric Authentication',
      description: 'Use your fingerprint, face, or device PIN to unlock',
    })
    console.log(TAG, 'getSecureCredentials result:', result ? 'has data' : 'empty')
    if (!result.username || !result.password) return null

    const email = result.username.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log(TAG, 'invalid email format in stored credentials, clearing')
      await deleteBiometricCredentials()
      return null
    }

    return { email, token: result.password }
  } catch (err) {
    console.log(TAG, 'getSecureCredentials error:', err)
    return null
  }
}

// ─── Check if credentials exist (no prompt) ───
// Rely on the localStorage flag we keep in sync when enabling/disabling.
// Avoid calling native credential-checking APIs on app launch; they can crash.

export async function hasStoredBiometricCredentials(): Promise<boolean> {
  return getBiometricEnabled()
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
