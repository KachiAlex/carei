import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { isNfcAvailable, startNfcScan, stopNfcScan, type NFCScanResult } from '../utils/nfc'

const COLORS = {
  darkNavy: '#0F1D34',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  red: '#FF5A5F',
  amber: '#F6B73C',
  green: '#22C55E',
}

export interface TagScanResult {
  tagId: string
  clientId: string
  scannedAt: string
  method: 'qr' | 'manual' | 'nfc'
}

interface TagScanModalProps {
  open: boolean
  expectedClientId: string
  expectedClientName: string
  onScanSuccess: (result: TagScanResult) => void
  onClose: () => void
}

export default function TagScanModal({
  open,
  expectedClientId,
  expectedClientName,
  onScanSuccess,
  onClose,
}: TagScanModalProps) {
  const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'error' | 'unsupported'>('scanning')
  const [activeMethod, setActiveMethod] = useState<'qr' | 'nfc'>('qr')
  const [errorMessage, setErrorMessage] = useState('')
  const [manualTagId, setManualTagId] = useState('')
  const [nfcAvailable, setNfcAvailable] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerId = 'qr-scan-container'

  useEffect(() => {
    setNfcAvailable(isNfcAvailable())
  }, [])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null
    }
    stopNfcScan()
  }, [])

  const handleScanResult = useCallback(
    (decodedText: string, method: 'qr' | 'nfc' = 'qr') => {
      // Format: CAREi:client:<clientId> or just <clientId>
      let clientId = decodedText
      if (decodedText.startsWith('CAREi:client:')) {
        clientId = decodedText.replace('CAREi:client:', '')
      }

      if (clientId === expectedClientId) {
        setScanStatus('success')
        stopScanner()
        onScanSuccess({
          tagId: decodedText,
          clientId,
          scannedAt: new Date().toISOString(),
          method,
        })
      } else {
        setScanStatus('error')
        setErrorMessage(`Tag doesn't match this client. Expected ${expectedClientName}, scanned a different client tag.`)
        // Restart scanning after error
        setTimeout(() => setScanStatus('scanning'), 2500)
      }
    },
    [expectedClientId, expectedClientName, onScanSuccess, stopScanner]
  )

  const initiateNfc = useCallback(() => {
    setActiveMethod('nfc')
    setScanStatus('scanning')
    stopScanner() // Stop QR if running

    startNfcScan(
      (result: NFCScanResult) => {
        handleScanResult(result.tagId, 'nfc')
      },
      (err) => {
        setScanStatus('error')
        setErrorMessage(err)
        setTimeout(() => setScanStatus('scanning'), 3000)
      }
    )
  }, [handleScanResult, stopScanner])

  useEffect(() => {
    if (!open) return

    let mounted = true
    setScanStatus('scanning')
    setErrorMessage('')

    const startScanner = async () => {
      if (activeMethod !== 'qr') return
      
      try {
        const html5Qrcode = new Html5Qrcode(containerId, { verbose: false })
        scannerRef.current = html5Qrcode

        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (mounted) handleScanResult(decodedText, 'qr')
          },
          () => {}
        )
      } catch (err: any) {
        if (mounted) {
          // If QR fails and NFC is available, suggest NFC
          if (nfcAvailable) {
            setActiveMethod('nfc')
            initiateNfc()
          } else {
            setScanStatus('unsupported')
            setErrorMessage(
              err?.message?.includes('Permission')
                ? 'Camera permission denied. Allow camera access to scan QR tags, or enter the tag ID manually below.'
                : 'Camera not available. You can enter the tag ID manually below.'
            )
          }
        }
      }
    }

    // Small delay to ensure DOM element is rendered
    const timer = setTimeout(startScanner, 200)

    return () => {
      mounted = false
      clearTimeout(timer)
      stopScanner()
    }
  }, [open, handleScanResult, stopScanner, activeMethod, nfcAvailable, initiateNfc])

  const handleManualSubmit = () => {
    const tagId = manualTagId.trim()
    if (!tagId) return
    let clientId = tagId
    if (tagId.startsWith('CAREi:client:')) {
      clientId = tagId.replace('CAREi:client:', '')
    }
    if (clientId === expectedClientId) {
      setScanStatus('success')
      onScanSuccess({
        tagId,
        clientId,
        scannedAt: new Date().toISOString(),
        method: 'manual',
      })
    } else {
      setScanStatus('error')
      setErrorMessage('Tag ID does not match this client.')
      setTimeout(() => setScanStatus('scanning'), 2500)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 text-white" style={{ background: `linear-gradient(135deg, ${COLORS.darkNavy}, ${COLORS.navy})` }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Scan Location Tag</h3>
              <p className="text-xs text-white/60 mt-0.5">{expectedClientName}</p>
            </div>
            <button
              onClick={() => { stopScanner(); onClose() }}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-white border-none cursor-pointer hover:bg-white/20 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Scanner / Status */}
        <div className="p-5">
          {scanStatus === 'scanning' && activeMethod === 'qr' && (
            <>
              <div
                id={containerId}
                className="w-full rounded-xl overflow-hidden bg-slate-900 mb-3"
                style={{ minHeight: 250 }}
              />
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><path d="M3 8h5"/><rect width="5" height="5" x="16" y="3" rx="1"/><path d="M16 8h5"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M3 16v5"/><path d="M8 16v5"/><rect width="5" height="5" x="16" y="16" rx="1"/><path d="M16 16v5"/><path d="M21 16v5"/></svg>
                Point camera at the QR tag in the client's home
              </div>
              
              {nfcAvailable && (
                <button
                  onClick={initiateNfc}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 border-none cursor-pointer flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-8m-4 8V4m8 16V8"/></svg>
                  Switch to NFC Tap
                </button>
              )}
            </>
          )}

          {scanStatus === 'scanning' && activeMethod === 'nfc' && (
            <div className="flex flex-col items-center py-10">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-teal/10 flex items-center justify-center animate-pulse">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-8m-4 8V4m8 16V8"/></svg>
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-teal text-white flex items-center justify-center text-[10px] font-bold">NFC</div>
              </div>
              <div className="text-sm font-bold text-slate-800">Ready to Scan</div>
              <div className="text-xs text-slate-500 mt-2 text-center px-4">Tap your phone against the NFC tag</div>
              
              <button
                onClick={() => { stopNfcScan(); setActiveMethod('qr'); setScanStatus('scanning'); }}
                className="mt-6 px-4 py-2 rounded-lg text-xs font-semibold text-teal bg-teal/5 border border-teal/20 cursor-pointer"
              >
                Use Camera Instead
              </button>
            </div>
          )}

          {scanStatus === 'success' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(34,197,94,0.1)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <div className="text-sm font-bold text-slate-800">Tag Verified!</div>
              <div className="text-xs text-slate-500 mt-1">Location confirmed via tag scan</div>
            </div>
          )}

          {scanStatus === 'error' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,90,95,0.1)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </div>
              <div className="text-sm font-bold text-slate-800">Tag Mismatch</div>
              <div className="text-xs text-slate-500 mt-1 text-center px-4">{errorMessage}</div>
            </div>
          )}

          {scanStatus === 'unsupported' && (
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(246,183,60,0.1)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              </div>
              <div className="text-sm font-bold text-slate-800">Camera Unavailable</div>
              <div className="text-xs text-slate-500 mt-1 text-center px-4">{errorMessage}</div>
            </div>
          )}

          {/* Manual entry fallback */}
          {(scanStatus === 'unsupported' || scanStatus === 'scanning') && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500 mb-2">Manual Entry</div>
              <div className="flex gap-2">
                <input
                  value={manualTagId}
                  onChange={(e) => setManualTagId(e.target.value)}
                  placeholder="Enter tag ID..."
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit() }}
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualTagId.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                >
                  Verify
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
