import { NativeBiometric } from '@capgo/capacitor-native-biometric'

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const result = await NativeBiometric.isAvailable()
    return result.isAvailable
  } catch {
    return false
  }
}

export async function verifyBiometric(reason = 'Authenticate to access CAREi'): Promise<boolean> {
  try {
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'CAREi',
      subtitle: 'Biometric Authentication',
      description: 'Use your fingerprint or face to unlock',
    })
    return true
  } catch {
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
