export function triggerHaptic(pattern: number | number[] = 50) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

export const HAPTIC_PATTERNS = {
  confirm: [30, 50, 30],
  sos: [100, 100, 100, 100, 300],
  clockOut: [40, 80, 40],
  success: 200,
  error: [100, 50, 100],
  tap: 20,
}
