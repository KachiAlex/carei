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
      description: 'Use your fingerprint, face, or device PIN to unlock',
      useFallback: true,
      allowedBiometryTypes: [BiometryType.FINGERPRINT, BiometryType.FACE_AUTHENTICATION, BiometryType.DEVICE_CREDENTIAL],
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

export async function storeCredentialsWithBiometric(email: string, refreshToken: string): Promise<boolean> {
  const server = BIOMETRIC_SERVER
  const username = email.toLowerCase()

  // Clear any stale credentials first to avoid conflicts
  try {
    await NativeBiometric.deleteCredentials({ server })
    console.log('[CAREi bio] cleared stale credentials before store')
  } catch (err) {
    console.log('[CAREi bio] deleteCredentials before store failed (ok to ignore):', err)
  }

  // Try BIOMETRY_ANY first (recommended by plugin docs for most apps)
  // Then fall back to BIOMETRY_CURRENT_SET (invalidates key if biometrics change)
  for (const accessControl of [AccessControl.BIOMETRY_ANY, AccessControl.BIOMETRY_CURRENT_SET]) {
    try {
      console.log(`[CAREi bio] calling setCredentials with accessControl=${accessControl}`)
      await NativeBiometric.setCredentials({
        username,
        password: refreshToken,
        server,
        accessControl,
      })
      console.log(`[CAREi bio] setCredentials succeeded with accessControl=${accessControl}`)

      // Verify credentials were actually stored
      const check = await NativeBiometric.isCredentialsSaved({ server })
      console.log(`[CAREi bio] post-store verification: isSaved=${check.isSaved}`)
      if (check.isSaved) return true

      console.log(`[CAREi bio] setCredentials reported success but isCredentialsSaved=false, trying next accessControl`)
    } catch (err: any) {
      console.log(`[CAREi bio] setCredentials error with accessControl=${accessControl}:`, JSON.stringify(err))
      // Continue to next fallback
    }
  }

  // Last resort: store without biometric protection (we'll use verifyIdentity before getCredentials)
  try {
    console.log('[CAREi bio] falling back to setCredentials with NONE')
    await NativeBiometric.setCredentials({
      username,
      password: refreshToken,
      server,
      accessControl: AccessControl.NONE,
    })
    console.log('[CAREi bio] setCredentials succeeded with NONE')
    const check = await NativeBiometric.isCredentialsSaved({ server })
    console.log(`[CAREi bio] post-store verification (NONE): isSaved=${check.isSaved}`)
    return check.isSaved
  } catch (err: any) {
    console.log('[CAREi bio] setCredentials error with NONE:', JSON.stringify(err))
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
  // First try getSecureCredentials (works if stored with BIOMETRY_CURRENT_SET or BIOMETRY_ANY)
  try {
    console.log('[CAREi bio] calling getSecureCredentials')
    const result = await NativeBiometric.getSecureCredentials({
      server: BIOMETRIC_SERVER,
      reason: 'Authenticate to access CAREi',
      title: 'CAREi',
      subtitle: 'Biometric Authentication',
      description: 'Use your fingerprint, face, or device PIN to unlock',
    })
    console.log('[CAREi bio] getSecureCredentials result:', result)
    if (!result.username || !result.password) return null
    if (!validateEmail(result.username)) {
      console.log('[CAREi bio] clearing old-format credential')
      await deleteBiometricCredentials()
      return null
    }
    return { email: result.username.toLowerCase(), token: result.password }
  } catch (err) {
    console.log('[CAREi bio] getSecureCredentials error:', JSON.stringify(err))
  }

  // Fallback: getCredentials (no biometric prompt) + verifyIdentity
  try {
    console.log('[CAREi bio] falling back to getCredentials + verifyIdentity')
    const verified = await verifyBiometric('Authenticate to access CAREi')
    if (!verified) {
      console.log('[CAREi bio] verifyIdentity failed in fallback')
      return null
    }
    const result = await NativeBiometric.getCredentials({
      server: BIOMETRIC_SERVER,
    })
    console.log('[CAREi bio] getCredentials result:', result)
    if (!result.username || !result.password) return null
    if (!validateEmail(result.username)) {
      console.log('[CAREi bio] clearing old-format credential (fallback)')
      await deleteBiometricCredentials()
      return null
    }
    return { email: result.username.toLowerCase(), token: result.password }
  } catch (err) {
    console.log('[CAREi bio] getCredentials fallback error:', JSON.stringify(err))
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
