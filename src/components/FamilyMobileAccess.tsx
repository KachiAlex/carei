import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useFamilyNotifications } from '../utils/familyNotifications'
import { Smartphone, Bell, Download, QrCode, Share2, Check, X } from 'lucide-react'

interface FamilyMobileAccessProps {
  clientId: string
  clientName: string
}

export default function FamilyMobileAccess({ clientId, clientName }: FamilyMobileAccessProps) {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const { isSupported, permission, requestPermission } = useFamilyNotifications()
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  useEffect(() => {
    // Check if running as native app
    const native = typeof (window as any).Capacitor !== 'undefined'
    setIsNative(native)

    // Check if PWA is installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setShowInstallPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstallPWA = async () => {
    const promptEvent = (window as any).deferredPrompt
    if (promptEvent) {
      promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setShowInstallPrompt(false)
      }
    }
  }

  const handleEnableNotifications = async () => {
    const granted = await requestPermission()
    setNotificationsEnabled(granted)
  }

  const generateFamilyQRUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/family/login?client=${clientId}&invite=true`
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Smartphone className="text-teal" size={20} />
        Mobile Access
      </h2>

      {/* Installation Status */}
      <div className="mb-6">
        {isNative ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
            <Check className="text-green-600" size={20} />
            <div>
              <p className="font-medium text-green-800">Native App Installed</p>
              <p className="text-sm text-green-600">You're using the CAREi mobile app</p>
            </div>
          </div>
        ) : isInstalled ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
            <Check className="text-green-600" size={20} />
            <div>
              <p className="font-medium text-green-800">App Installed</p>
              <p className="text-sm text-green-600">CAREi is installed on your device</p>
            </div>
          </div>
        ) : showInstallPrompt ? (
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Download className="text-blue-600" size={20} />
              <div>
                <p className="font-medium text-blue-800">Install App</p>
                <p className="text-sm text-blue-600">Add CAREi to your home screen</p>
              </div>
            </div>
            <button
              onClick={handleInstallPWA}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Install
            </button>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              To install: Open your browser menu (⋮) and select "Add to Home Screen"
            </p>
          </div>
        )}
      </div>

      {/* Push Notifications */}
      {isSupported && (
        <div className="mb-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="text-amber-500" size={20} />
              <div>
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-600">
                  {notificationsEnabled 
                    ? 'Notifications enabled' 
                    : 'Get alerts for visits, messages, and tasks'}
                </p>
              </div>
            </div>
            {notificationsEnabled ? (
              <Check className="text-green-500" size={20} />
            ) : (
              <button
                onClick={handleEnableNotifications}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium"
              >
                Enable
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Access QR Code */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Family Access</h3>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center border border-gray-200">
            <QrCode size={40} className="text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">
              Share this link with family members for quick access to {clientName}'s care information
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateFamilyQRUrl())
                }}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                <Share2 size={14} />
                Copy Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Features */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Mobile Features</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-teal/10 rounded-full flex items-center justify-center">
              <Bell size={16} className="text-teal" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Instant Alerts</p>
              <p className="text-xs text-gray-500">Visit updates & messages</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-teal/10 rounded-full flex items-center justify-center">
              <Smartphone size={16} className="text-teal" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Offline Access</p>
              <p className="text-xs text-gray-500">View data without internet</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-teal/10 rounded-full flex items-center justify-center">
              <Check size={16} className="text-teal" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Task Checklists</p>
              <p className="text-xs text-gray-500">Complete care tasks on-the-go</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-teal/10 rounded-full flex items-center justify-center">
              <Share2 size={16} className="text-teal" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Quick Share</p>
              <p className="text-xs text-gray-500">Share updates with family</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
