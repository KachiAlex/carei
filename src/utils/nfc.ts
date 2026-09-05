/**
 * Utility for NFC scanning using phonegap-nfc via Capacitor bridge.
 * Handles iOS-specific session starting and cross-platform NDEF reading.
 */

export interface NFCScanResult {
  tagId: string;
  clientId: string;
}

export const isNfcAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'nfc' in window;
};

export const startNfcScan = (onSuccess: (result: NFCScanResult) => void, onError: (err: string) => void) => {
  if (!isNfcAvailable()) {
    onError('NFC is not supported on this device/browser.');
    return;
  }

  const nfc = (window as any).nfc;

  // On iOS, we must explicitly start a scan session which shows a native system overlay
  if ((window as any).device?.platform === 'iOS') {
    nfc.beginSession(
      () => console.log('[NFC] Session started'),
      (err: any) => onError(`Failed to start NFC session: ${err}`)
    );
  }

  // Register the listener for NDEF tags
  nfc.addNdefListener(
    (nfcEvent: any) => {
      const tag = nfcEvent.tag;
      let payload = '';

      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        const record = tag.ndefMessage[0];
        // Convert Uint8Array to string, skipping the language code (usually first 3 bytes for Text records)
        const payloadBytes = record.payload;
        // Text record: [status byte, ...lang code, ...text]
        // Simple implementation assuming text record
        const encoding = (payloadBytes[0] & 0x80) === 0 ? 'utf-8' : 'utf-16';
        const langCodeLen = payloadBytes[0] & 0x3F;
        const textBytes = payloadBytes.slice(1 + langCodeLen);
        payload = new TextDecoder(encoding).decode(new Uint8Array(textBytes));
      }

      // If no NDEF data, use the Tag ID (Serial Number)
      const tagId = payload || nfc.bytesToHexString(tag.id);
      
      let clientId = tagId;
      if (tagId.startsWith('CAREi:client:')) {
        clientId = tagId.replace('CAREi:client:', '');
      }

      onSuccess({ tagId, clientId });
      
      // On iOS, session automatically closes after one successful scan
    },
    () => console.log('[NFC] Listener added'),
    (err: any) => onError(`NFC Listener error: ${err}`)
  );
};

export const stopNfcScan = () => {
  if (isNfcAvailable()) {
    const nfc = (window as any).nfc;
    nfc.removeNdefListener(() => console.log('[NFC] Listener removed'));
    
    if ((window as any).device?.platform === 'iOS') {
      nfc.invalidateSession(() => console.log('[NFC] Session invalidated'), () => {});
    }
  }
};
