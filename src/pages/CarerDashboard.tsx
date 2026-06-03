import { useLocation } from 'wouter'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
}

export default function CarerDashboard() {
  const [, setLocation] = useLocation()

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
    >
      <div className="px-6 py-5 flex items-center justify-between">
        <h1 className="font-serif text-white text-xl">Today's Care</h1>
        <button
          onClick={() => setLocation('/')}
          className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer"
        >
          Log out
        </button>
      </div>
      <div className="flex-1 px-6 pb-6">
        <p className="text-white/50 text-sm">No visits scheduled yet.</p>
      </div>
    </div>
  )
}
