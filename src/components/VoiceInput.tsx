import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  language?: string
  disabled?: boolean
  className?: string
}

export default function VoiceInput({ 
  onTranscript, 
  language = 'en-US', 
  disabled = false,
  className = ''
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  
  const recognitionRef = useRef<any>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Check if browser supports speech recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      
      if (!SpeechRecognition) {
        setIsSupported(false)
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = language

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      recognition.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        const fullTranscript = (transcript + finalTranscript + interimTranscript).trim()
        setTranscript(fullTranscript)
        
        // Auto-stop after 2 seconds of silence
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          stopListening()
        }, 2000)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setError(getErrorMessage(event.error))
        setIsListening(false)
        setIsProcessing(false)
      }

      recognition.onend = () => {
        setIsListening(false)
        setIsProcessing(false)
        
        if (transcript.trim()) {
          onTranscript(transcript.trim())
          setTranscript('')
        }
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [language, onTranscript])

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'no-speech':
        return 'No speech detected. Please try again.'
      case 'audio-capture':
        return 'Microphone access denied. Please check your permissions.'
      case 'not-allowed':
        return 'Microphone access denied. Please allow microphone access.'
      case 'network':
        return 'Network error. Please check your connection.'
      default:
        return 'Speech recognition error. Please try again.'
    }
  }

  const startListening = () => {
    if (!recognitionRef.current || disabled) return
    
    setError(null)
    setTranscript('')
    setIsProcessing(true)
    
    try {
      recognitionRef.current.start()
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      setError('Failed to start speech recognition')
      setIsProcessing(false)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  if (!isSupported) {
    return (
      <div className={`p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <MicOff size={16} />
          Speech recognition is not supported in this browser
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Voice Input Button */}
      <button
        onClick={toggleListening}
        disabled={disabled || isProcessing}
        className={`w-full p-4 rounded-xl font-medium transition-all flex items-center justify-center gap-3 ${
          isListening 
            ? 'bg-red-500 text-white hover:bg-red-600' 
            : 'bg-teal text-navy hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
      >
        {isProcessing ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isListening ? (
          <MicOff size={20} />
        ) : (
          <Mic size={20} />
        )}
        
        <span>
          {isProcessing ? 'Initializing...' : isListening ? 'Stop Recording' : 'Start Voice Input'}
        </span>
        
        {isListening && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-75" />
            <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-150" />
          </div>
        )}
      </button>

      {/* Live Transcript */}
      {transcript && (
        <div className="p-3 bg-white/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 size={16} className="text-teal" />
            <span className="text-white text-sm font-medium">Live Transcript:</span>
          </div>
          <p className="text-white/80 text-sm">{transcript}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <MicOff size={16} />
            {error}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isListening && !error && (
        <div className="text-white/50 text-xs text-center">
          Click the microphone button and speak clearly. Tap to stop when finished.
        </div>
      )}
    </div>
  )
}

// Hook for voice input in form fields
export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')

  const startVoiceInput = (callback: (text: string) => void) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)
    
    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      
      if (finalTranscript) {
        callback(finalTranscript)
        setIsListening(false)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  return {
    isListening,
    transcript,
    startVoiceInput
  }
}
