import { NativeBiometric, AccessControl, BiometryType } from '@capgo/capacitor-native-biometric'

const BIOMETRIC_SERVER = 'carei.app'

export interface BiometricAvailability {
  available: boolean
  biometryType?: string
  authenticationStrength?: string
  errorCode?: number
  errorMessage?: string
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const result = await NativeBiometric.isAvailable({ useFallback: true })
    console.log('[CAREi bio] isAvailable result:', result)
    return {
      available: result.isAvailable,
      biometryType: (result as any).biometryType,
      authenticationStrength: (result as any).authenticationStrength,
      errorCode: (result as any).errorCode,
    }
  } catch (err: any) {
    console.log('[CAREi bio] isAvailable error:', err)
    return {
      available: false,
      errorMessage: err?.message || String(err),
    }
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const result = await getBiometricAvailability()
  return result.available
}

export async function verifyBiometric(reason = 'Authenticate to access CAREi'): Promise<boolean> {
  try {
    console.log('[CAREi bio] calling verifyIdentity')
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'CAREi',
      subtitle: 'Biometric Authentication',
      description: 'Use your fingerprint or face to unlock',
      allowedBiometryTypes: [BiometryType.FINGERPRINT, BiometryType.FACE_AUTHENTICATION],
    })
    console.log('[CAREi bio] verifyIdentity succeeded')
    return true
  } catch (err) {
    console.log('[CAREi bio] verifyIdentity error:', err)
    return false
  }
}

export function getBiometricEnabled(): boolean {
  return localStorage.getItem('carei_biometric_enabled') === 'true'
}

export function setBiometricEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem('carei_biometric_enabled', 'true')
  } else {
    localStorage.removeItem('carei_biometric_enabled')
  }
}

export async function storeCredentialsWithBiometric(email: string, token: string): Promise<boolean> {
  try {
    console.log('[CAREi bio] calling setCredentials with BIOMETRY_ANY')
    await NativeBiometric.setCredentials({
      username: email.toLowerCase(),
      password: token,
      server: BIOMETRIC_SERVER,
      accessControl: AccessControl.BIOMETRY_ANY,
    })
    console.log('[CAREi bio] setCredentials succeeded')
    return true
  } catch (err) {
    console.log('[CAREi bio] setCredentials error:', err)
    return false
  }
}

export interface BiometricCredentials {
  email: string
  token: string
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function getCredentialsWithBiometric(): Promise<BiometricCredentials | null> {
  try {
    console.log('[CAREi bio] calling getSecureCredentials')
    const result = await NativeBiometric.getSecureCredentials({
      server: BIOMETRIC_SERVER,
      reason: 'Authenticate to access CAREi',
      title: 'CAREi',
      subtitle: 'Biometric Authentication',
      description: 'Use your fingerprint or face to unlock',
    })
    console.log('[CAREi bio] getSecureCredentials result:', result)
    if (!result.username || !result.password) return null
    if (!validateEmail(result.username)) {
      // Old-format credential (username was a placeholder); clear it
      console.log('[CAREi bio] clearing old-format credential')
      await deleteBiometricCredentials()
      return null
    }
    return { email: result.username.toLowerCase(), token: result.password }
  } catch (err) {
    console.log('[CAREi bio] getSecureCredentials error:', err)
    return null
  }
}

export async function hasStoredBiometricCredentials(): Promise<boolean> {
  try {
    console.log('[CAREi bio] calling isCredentialsSaved')
    const result = await NativeBiometric.isCredentialsSaved({
      server: BIOMETRIC_SERVER,
    })
    console.log('[CAREi bio] isCredentialsSaved result:', result)
    return result.isSaved
  } catch (err) {
    console.log('[CAREi bio] isCredentialsSaved error:', err)
    return false
  }
}

export async function deleteBiometricCredentials(): Promise<void> {
  try {
    console.log('[CAREi bio] calling deleteCredentials')
    await NativeBiometric.deleteCredentials({
      server: BIOMETRIC_SERVER,
    })
    console.log('[CAREi bio] deleteCredentials succeeded')
  } catch (err) {
    console.log('[CAREi bio] deleteCredentials error:', err)
  }
}
