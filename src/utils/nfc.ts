/**
 * Utility for NFC tag scanning via @exxili/capacitor-nfc.
 * Android listens passively once a scan session is active; iOS uses a
 * CoreNFC reader session. Falls back to the legacy phonegap-nfc bridge
 * if present (older builds).
 */

import { Capacitor } from '@capacitor/core'
import { NFC } from '@exxili/capacitor-nfc'

export interface NFCScanResult {
  tagId: string;
  clientId: string;
}

export const isNfcAvailable = (): boolean => {
  return Capacitor.isNativePlatform() || (typeof window !== 'undefined' && 'nfc' in window)
};

let unsubscribeRead: (() => void) | null = null
let unsubscribeError: (() => void) | null = null

export const startNfcScan = (onSuccess: (result: NFCScanResult) => void, onError: (err: string) => void) => {
  // Capacitor plugin path (Android + iOS)
  if (Capacitor.isNativePlatform()) {
    void (async () => {
      try {
        const { supported } = await NFC.isSupported()
        if (!supported) {
          onError('NFC is not supported on this device.')
          return
        }

        unsubscribeRead?.()
        unsubscribeError?.()

        unsubscribeRead = NFC.onRead((data) => {
          const { messages, tagInfo } = data.uint8Array()
          let tagId = tagInfo?.uid || ''

          // Prefer an NDEF text payload if present
          const record = messages?.[0]?.records?.[0]
          const bytes = record?.payload
          if (bytes && bytes.length > 0) {
            // NDEF Text record: [status byte, lang code bytes, text bytes].
            // If the first byte looks like a status byte (control char), strip it.
            const langCodeLen = bytes[0] < 0x20 ? bytes[0] & 0x3f : -1
            const textBytes = langCodeLen >= 0 ? bytes.slice(1 + langCodeLen) : bytes
            const decoded = new TextDecoder().decode(textBytes)
            if (decoded.trim()) tagId = decoded.trim()
          }

          if (!tagId) {
            onError('Could not read tag ID')
            return
          }

          let clientId = tagId
          if (tagId.startsWith('CAREi:client:')) {
            clientId = tagId.replace('CAREi:client:', '')
          }

          onSuccess({ tagId, clientId })
        })

        unsubscribeError = NFC.onError((e) => {
          onError(`NFC error: ${e.error}`)
        })

        await NFC.startScan({ mode: 'auto' })
      } catch (err: any) {
        onError(`NFC error: ${err?.message || err}`)
      }
    })()
    return
  }

  // Legacy phonegap-nfc bridge (if an older build still exposes window.nfc)
  if ('nfc' in window) {
    const nfc = (window as any).nfc

    if ((window as any).device?.platform === 'iOS') {
      nfc.beginSession(
        () => console.log('[NFC] Session started'),
        (err: any) => onError(`Failed to start NFC session: ${err}`)
      )
    }

    nfc.addNdefListener(
      (nfcEvent: any) => {
        const tag = nfcEvent.tag
        let payload = ''

        if (tag.ndefMessage && tag.ndefMessage.length > 0) {
          const record = tag.ndefMessage[0]
          const payloadBytes = record.payload
          const encoding = (payloadBytes[0] & 0x80) === 0 ? 'utf-8' : 'utf-16'
          const langCodeLen = payloadBytes[0] & 0x3f
          const textBytes = payloadBytes.slice(1 + langCodeLen)
          payload = new TextDecoder(encoding).decode(new Uint8Array(textBytes))
        }

        const tagId = payload || nfc.bytesToHexString(tag.id)
        let clientId = tagId
        if (tagId.startsWith('CAREi:client:')) {
          clientId = tagId.replace('CAREi:client:', '')
        }

        onSuccess({ tagId, clientId })
      },
      () => console.log('[NFC] Listener added'),
      (err: any) => onError(`NFC Listener error: ${err}`)
    )
    return
  }

  onError('NFC is not supported on this device/browser.')
};

export const stopNfcScan = () => {
  if (Capacitor.isNativePlatform()) {
    unsubscribeRead?.()
    unsubscribeError?.()
    unsubscribeRead = null
    unsubscribeError = null
    void NFC.removeAllListeners('nfcTag').catch(() => {})
    void NFC.cancelScan().catch(() => {})
    return
  }

  if (typeof window !== 'undefined' && 'nfc' in window) {
    const nfc = (window as any).nfc
    nfc.removeNdefListener(() => console.log('[NFC] Listener removed'))
    if ((window as any).device?.platform === 'iOS') {
      nfc.invalidateSession(() => console.log('[NFC] Session invalidated'), () => {})
    }
  }
};
