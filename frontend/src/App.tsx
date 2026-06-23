import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAttackStream } from './hooks/useAttackStream'
import { useStore } from './store/useStore'
import { Sidebar } from './layout/Sidebar'
import { Header } from './components/Header'
import { AlertBanner } from './components/AlertBanner'
import { ControlPage } from './pages/ControlPage'
import { AttacksPage } from './pages/AttacksPage'
import { DetectionPage } from './pages/DetectionPage'
import { DashboardPage } from './pages/DashboardPage'
import { ThreatsPage } from './pages/ThreatsPage'

function InitScreen() {
  const status = useStore((s) => s.pipelineStatus)
  const label =
    status === 'training'      ? 'Training LSTM DL-NIDS (first run — ~2 min)…' :
    status === 'loading_data'  ? 'Downloading KDD Cup 99 dataset…' :
    status === 'loading_model' ? 'Loading saved model weights…' :
    `Initialising: ${status}`

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center gap-8 z-50 bg-grid"
      style={{ background: 'var(--surface-base)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="relative w-28 h-28 flex items-center justify-center">
        <div className="absolute w-28 h-28 rounded-full border border-neon-green/10" style={{ animation: 'spin 12s linear infinite' }} />
        <div className="absolute w-20 h-20 rounded-full border border-neon-green/20" style={{ animation: 'spin 8s linear infinite reverse' }} />
        <svg viewBox="0 0 80 80" className="w-20 h-20 relative z-10">
          <defs>
            <filter id="ig"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#06B6D4"/>
            </linearGradient>
          </defs>
          <path d="M40 6 L66 16 L66 40 C66 54 54 64 40 70 C26 64 14 54 14 40 L14 16 Z"
            fill="none" stroke="url(#sg)" strokeWidth="2" strokeLinecap="round"
            strokeDasharray="180" filter="url(#ig)"
            style={{ animation: 'dash 2s linear infinite' }} />
          <text x="40" y="45" textAnchor="middle" fill="url(#sg)" fontSize="14"
            fontFamily="JetBrains Mono, monospace" fontWeight="700">CA</text>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-xl font-bold tracking-tight mb-1">
          <span className="grad-green">CA-xNIDS</span>
          <span className="text-ink-1 ml-2 font-normal text-sm">Threat Intelligence Platform</span>
        </p>
        <p className="mono-label mt-2">{label}</p>
      </div>
      <div className="w-72 h-px bg-surface-3 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#10B981,#06B6D4)', animation: 'indeterminate 1.6s ease-in-out infinite' }} />
      </div>
      <style>{`
        @keyframes dash{from{stroke-dashoffset:180}to{stroke-dashoffset:0}}
        @keyframes indeterminate{0%{width:0%;margin-left:0%}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}
      `}</style>
    </motion.div>
  )
}

function Shell() {
  useAttackStream()
  const { connected, pipelineStatus } = useStore()
  const isReady = connected && pipelineStatus !== 'connecting'

  return (
    <div className="flex h-screen overflow-hidden bg-grid">
      <AnimatePresence>{!isReady && <InitScreen key="init" />}</AnimatePresence>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <div className="relative flex-1 min-h-0">
          <AlertBanner />
          <main className="h-full overflow-y-auto">
            <Routes>
              <Route path="/"          element={<DashboardPage />} />
              <Route path="/control"   element={<ControlPage />} />
              <Route path="/attacks"   element={<AttacksPage />} />
              <Route path="/detection" element={<DetectionPage />} />
              <Route path="/threats"   element={<ThreatsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
