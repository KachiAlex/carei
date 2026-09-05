import { useState, useRef } from 'react'
import { useLocation } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { triggerHaptic, HAPTIC_PATTERNS } from '../utils/haptic'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  lavender: '#A78BFA',
  amber: '#FBBF24',
  red: '#FF5A5F',
}

const ONBOARDING_KEY = 'carei_onboarding_complete'

interface Slide {
  id: number
  bgGradient: string
  accent: string
  icon: React.ReactNode
  title: string
  subtitle: string
  description: string
  illustration: React.ReactNode
}

const slides: Slide[] = [
  {
    id: 0,
    bgGradient: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, #0d1b3a 60%, #102542 100%)`,
    accent: COLORS.teal,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    ),
    title: 'Speak Your Notes',
    subtitle: 'Voice-Powered Documentation',
    description: 'Just talk. CAREi transcribes, structures, and files your care notes automatically — so you spend less time writing and more time caring.',
    illustration: <VoiceIllustration />,
  },
  {
    id: 1,
    bgGradient: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, #1a1535 60%, #2a1a4a 100%)`,
    accent: COLORS.lavender,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m19 11-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3l8.5 8.5 8-8Z" />
        <path d="m5 11 3 3" />
        <path d="m2 14 3 3" />
        <path d="m11 5 3 3" />
      </svg>
    ),
    title: 'Safe Medication',
    subtitle: 'Digital MAR with Double-Check',
    description: 'Photo-verified medication administration with automatic allergy checks, dose warnings, and two-person sign-off for controlled drugs.',
    illustration: <MedicationIllustration />,
  },
  {
    id: 2,
    bgGradient: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, #0d2230 60%, #103040 100%)`,
    accent: COLORS.amber,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
    title: 'Protected & Connected',
    subtitle: 'Lone Worker SOS & Live Dashboard',
    description: 'One-tap emergency alerts with live GPS. Managers see every visit, every medication, and every alert in real time — keeping everyone safe.',
    illustration: <SafetyIllustration />,
  },
]

function VoiceIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Concentric pulse rings */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 120 + i * 60,
            height: 120 + i * 60,
            border: `1.5px solid ${COLORS.teal}${Math.round((1 - i * 0.22) * 60).toString(16).padStart(2, '0')}`,
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.3, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
        />
      ))}
      {/* Center mic */}
      <motion.div
        className="relative z-10 w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`,
          boxShadow: `0 12px 40px ${COLORS.teal}50, inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={COLORS.darkNavy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      </motion.div>
      {/* Floating waveform bars */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1.5">
        {[40, 65, 30, 80, 50, 70, 35, 60, 45].map((h, i) => (
          <motion.div
            key={i}
            className="w-1.5 rounded-full"
            style={{ background: `linear-gradient(to top, ${COLORS.teal}, ${COLORS.teal2})` }}
            animate={{ height: [h * 0.4, h, h * 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  )
}

function MedicationIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Floating pill cards */}
      <motion.div
        className="absolute left-6 top-10 rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
        animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${COLORS.lavender}25` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.lavender} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
            <path d="m8.5 8.5 7 7" />
          </svg>
        </div>
        <div>
          <div className="text-white text-xs font-semibold">Paracetamol</div>
          <div className="text-white/40 text-[10px]">500mg · 14:00</div>
        </div>
      </motion.div>

      <motion.div
        className="absolute right-4 top-16 rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
        animate={{ y: [0, 8, 0], rotate: [2, -2, 2] }}
        transition={{ duration: 4.5, repeat: Infinity, delay: 0.5, ease: 'easeInOut' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${COLORS.teal}25` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
            <path d="m8.5 8.5 7 7" />
          </svg>
        </div>
        <div>
          <div className="text-white text-xs font-semibold">Insulin</div>
          <div className="text-white/40 text-[10px]">10 units · 12:30</div>
        </div>
      </motion.div>

      {/* Center checkmark badge */}
      <motion.div
        className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${COLORS.lavender}, #8B5CF6)`,
          boxShadow: `0 12px 40px ${COLORS.lavender}50, inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </motion.div>

      {/* Allergy warning chip */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 flex items-center gap-2"
        style={{ background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}30` }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
        <span className="text-xs font-semibold" style={{ color: COLORS.red }}>Allergy Check Active</span>
      </motion.div>
    </div>
  )
}

function SafetyIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Radar sweep */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <motion.div
            key={i}
            className="absolute origin-bottom"
            style={{
              width: 2,
              height: 130,
              background: `linear-gradient(to top, ${COLORS.amber}30, transparent)`,
              transformOrigin: 'bottom center',
              transform: `rotate(${angle}deg) translateY(-50%)`,
            }}
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Pulse rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 80 + i * 50,
            height: 80 + i * 50,
            border: `1.5px solid ${COLORS.amber}${Math.round((1 - i * 0.3) * 50).toString(16).padStart(2, '0')}`,
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5, ease: 'easeInOut' }}
        />
      ))}

      {/* Center SOS button */}
      <motion.div
        className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${COLORS.amber}, #F59E0B)`,
          boxShadow: `0 12px 40px ${COLORS.amber}50, inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-white font-bold text-sm tracking-wider">SOS</span>
      </motion.div>

      {/* GPS pin */}
      <motion.div
        className="absolute top-8 right-8 rounded-full px-3 py-1.5 flex items-center gap-1.5"
        style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="text-white/70 text-[10px] font-medium">Live GPS</span>
      </motion.div>

      {/* Manager dashboard mini-card */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2.5 flex items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 3, repeat: Infinity, delay: 0.5, ease: 'easeInOut' }}
      >
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
          <span className="w-2 h-2 rounded-full" style={{ background: COLORS.amber }} />
          <span className="w-2 h-2 rounded-full" style={{ background: COLORS.teal }} />
        </div>
        <span className="text-white/70 text-[10px] font-medium">Manager Live Dashboard</span>
      </motion.div>
    </div>
  )
}

export default function OnboardingScreen() {
  const [, setLocation] = useLocation()
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)
  const touchStartX = useRef(0)

  const slide = slides[current]

  const handleNext = () => {
    triggerHaptic(HAPTIC_PATTERNS.tap)
    if (current < slides.length - 1) {
      setDirection(1)
      setCurrent(current + 1)
    } else {
      handleFinish()
    }
  }

  const handlePrev = () => {
    triggerHaptic(HAPTIC_PATTERNS.tap)
    if (current > 0) {
      setDirection(-1)
      setCurrent(current - 1)
    }
  }

  const handleSkip = () => {
    triggerHaptic(HAPTIC_PATTERNS.tap)
    handleFinish()
  }

  const handleFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setLocation('/login')
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext()
      } else {
        handlePrev()
      }
    }
  }

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans relative overflow-hidden"
      style={{ background: slide.bgGradient }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Ambient background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-40 -left-40 w-[400px] h-[400px] rounded-full blur-[100px]"
          style={{ background: `radial-gradient(circle, ${slide.accent}20 0%, transparent 70%)` }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-[350px] h-[350px] rounded-full blur-[90px]"
          style={{ background: `radial-gradient(circle, ${slide.accent}15 0%, transparent 70%)` }}
          animate={{ x: [0, -20, 0], y: [0, -15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Top bar: Skip + progress dots */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-8 pb-2">
        {/* Progress dots */}
        <div className="flex gap-2">
          {slides.map((s, i) => (
            <motion.div
              key={s.id}
              className="rounded-full"
              animate={{
                width: i === current ? 28 : 8,
                backgroundColor: i === current ? slide.accent : 'rgba(255,255,255,0.2)',
              }}
              transition={{ duration: 0.3 }}
              style={{ height: 8 }}
            />
          ))}
        </div>

        {current < slides.length - 1 ? (
          <button
            onClick={handleSkip}
            className="text-white/50 hover:text-white text-sm font-medium transition-colors bg-transparent border-none cursor-pointer"
          >
            Skip
          </button>
        ) : (
          <div className="w-12" />
        )}
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex-1 flex flex-col">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex-1 flex flex-col items-center justify-between px-6 py-4"
          >
            {/* Illustration area */}
            <div className="w-full flex-1 flex items-center justify-center min-h-[280px] max-h-[380px]">
              {slide.illustration}
            </div>

            {/* Text content */}
            <div className="w-full max-w-sm flex flex-col items-center text-center pb-8">
              {/* Icon badge */}
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: `linear-gradient(135deg, ${slide.accent}25, ${slide.accent}10)`,
                  border: `1px solid ${slide.accent}30`,
                  color: slide.accent,
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
              >
                {slide.icon}
              </motion.div>

              {/* Subtitle */}
              <motion.div
                className="text-[11px] font-bold uppercase tracking-widest mb-2"
                style={{ color: slide.accent }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {slide.subtitle}
              </motion.div>

              {/* Title */}
              <motion.h2
                className="font-serif text-white font-bold text-2xl mb-3 leading-tight"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {slide.title}
              </motion.h2>

              {/* Description */}
              <motion.p
                className="text-white/50 text-sm leading-relaxed max-w-xs"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {slide.description}
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div className="relative z-10 px-6 pb-10 pt-2">
        <motion.button
          onClick={handleNext}
          whileTap={{ scale: 0.97 }}
          className="w-full max-w-sm mx-auto py-4 rounded-2xl border-none font-bold text-base cursor-pointer flex items-center justify-center gap-2 transition-all"
          style={{
            background: `linear-gradient(135deg, ${slide.accent}, ${slide.accent}dd)`,
            color: COLORS.darkNavy,
            boxShadow: `0 8px 28px ${slide.accent}40`,
          }}
        >
          {current < slides.length - 1 ? (
            <>
              Continue
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          ) : (
            <>
              Get Started
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </motion.button>

        {/* Page indicator text */}
        <div className="text-center mt-4 text-white/30 text-xs">
          {current + 1} of {slides.length}
        </div>
      </div>
    </div>
  )
}

export { ONBOARDING_KEY }
