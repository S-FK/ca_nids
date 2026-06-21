import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import type { AttackEvent } from '../types'

export function AlertBanner() {
  const latestAttack = useStore((s) => s.latestAttack)
  const [visible, setVisible] = useState(false)
  const [shown, setShown] = useState<AttackEvent | null>(null)

  useEffect(() => {
    if (!latestAttack) return
    setShown(latestAttack)
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 6000)
    return () => clearTimeout(timer)
  }, [latestAttack])

  const topFeatures = shown?.features
    ?.slice()
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 2)
    .map((f) => f.name)
    .join(', ') ?? '—'

  const tierClass =
    shown?.tier === 'HIGH'   ? 'badge-high' :
    shown?.tier === 'MEDIUM' ? 'badge-medium' :
    'badge-low'

  return (
    <AnimatePresence>
      {visible && shown && (
        <motion.div
          key={shown.packet_id}
          initial={{ y: -10, opacity: 0, scaleY: 0.9 }}
          animate={{ y: 0, opacity: 1, scaleY: 1 }}
          exit={{ y: -10, opacity: 0, scaleY: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="absolute top-0 left-0 right-0 z-30 w-full glow-red overflow-hidden shadow-2xl"
          style={{
            background: 'rgba(254,242,242,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(239,68,68,0.25)',
            borderTop: '1px solid rgba(239,68,68,0.15)',
          }}
        >
          <div
            className="flex items-center gap-3 px-6 flex-wrap"
            style={{ minHeight: 44 }}
          >
            {/* Pulsing indicator */}
            <div className="relative flex-shrink-0">
              <div
                className="w-2 h-2 rounded-full bg-neon-red"
                style={{ animation: 'pulse-dot 0.8s ease-in-out infinite' }}
              />
              <div
                className="absolute inset-0 w-2 h-2 rounded-full bg-neon-red"
                style={{ animation: 'pulse-ring 0.8s ease-out infinite' }}
              />
            </div>

            {/* Warning label */}
            <span className="mono-label" style={{ color: '#EF4444' }}>
              ⚠ THREAT DETECTED
            </span>

            <span className="text-ink-3 mono-label">—</span>

            {/* Attack type */}
            <span className="font-mono text-sm font-bold text-neon-red">
              {shown.attack_type}
            </span>

            <span className="text-ink-3 text-xs font-mono">attack</span>

            <span className="text-ink-3 mono-label">|</span>

            <span className="font-mono text-xs text-ink-1">
              conf=
              <span className="text-neon-amber font-bold">
                {(shown.confidence * 100).toFixed(0)}%
              </span>
            </span>

            <span className={`badge ${tierClass}`}>{shown.tier}</span>

            <span className="text-ink-3 mono-label">|</span>

            <span className="mono-label">top features:</span>
            <span className="font-mono text-xs text-ink-0">{topFeatures}</span>

            {/* Dismiss */}
            <button
              onClick={() => setVisible(false)}
              className="ml-auto text-ink-3 hover:text-ink-1 transition-colors text-xs font-mono"
            >
              ✕
            </button>
          </div>

          {/* Animated progress bar (countdown) */}
          <motion.div
            className="h-px"
            style={{ background: 'linear-gradient(90deg, #EF4444, #F87171)' }}
            initial={{ scaleX: 1, transformOrigin: 'left' }}
            animate={{ scaleX: 0, transformOrigin: 'left' }}
            transition={{ duration: 6, ease: 'linear' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
