import { Shield, Play, Square, Sun, Moon } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { AttackEvent } from '../types'
import { useTheme } from '../theme/useTheme'

async function apiControl(action: 'start' | 'stop') {
  await fetch('/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
}

const TYPE_COLORS: Record<string, string> = {
  DoS:   '#EF4444',
  Probe: '#F59E0B',
  R2L:   '#8B5CF6',
  U2R:   '#3B82F6',
}

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="font-mono text-xs text-ink-2">
      {now.toISOString().slice(11, 19)}{' '}
      <span className="text-ink-3">UTC</span>
    </span>
  )
}

function PacketRate() {
  const totalPackets = useStore((s) => s.totalPackets)
  const prevRef = useRef(totalPackets)
  const [rate, setRate] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      const diff = totalPackets - prevRef.current
      setRate(diff)
      prevRef.current = totalPackets
    }, 1000)
    return () => clearInterval(id)
  }, [totalPackets])

  return (
    <span className="font-mono text-xs text-ink-2">
      <span className="text-neon-blue font-bold">{rate}</span>
      <span className="text-ink-3 ml-1">pkt/s</span>
    </span>
  )
}

function AttackTicker({ attacks }: { attacks: AttackEvent[] }) {
  const recent = attacks.slice(0, 5)

  if (recent.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse-dot" />
        <span className="mono-label text-neon-green">ALL CLEAR</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 overflow-hidden">
      <span className="mono-label mr-2 flex-shrink-0">RECENT:</span>
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {recent.map((ev, i) => (
          <motion.div
            key={ev.packet_id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: i === 0 ? 1 : 0.5 - i * 0.08, x: 0 }}
            className="flex items-center gap-1.5 flex-shrink-0"
          >
            <span
              className="font-mono text-xs font-bold"
              style={{ color: TYPE_COLORS[ev.attack_type] ?? '#0F172A' }}
            >
              {ev.attack_type}
            </span>
            {ev.confidence != null && (
              <span className="text-ink-3 text-xs font-mono">
                {(ev.confidence * 100).toFixed(0)}%
              </span>
            )}
            {i < recent.length - 1 && (
              <span className="text-ink-4 text-xs mx-1">·</span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function WSStatusDot({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: connected ? '#10B981' : '#EF4444',
            animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }}
        />
        {connected && (
          <div
            className="absolute inset-0 w-2 h-2 rounded-full"
            style={{
              background: '#10B981',
              animation: 'pulse-ring 2s ease-out infinite',
            }}
          />
        )}
      </div>
      <span
        className="mono-label"
        style={{ color: connected ? '#10B981' : '#EF4444' }}
      >
        {connected ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  )
}

export function Header() {
  const { connected, attacks, simRunning, detectionMode } = useStore()
  const { theme, toggleTheme } = useTheme()

  const toggleMonitoring = () => {
    if (simRunning) {
      apiControl('stop')
      useStore.getState().setSimRunning(false)
    } else {
      apiControl('start')
      useStore.getState().setSimRunning(true)
    }
  }

  return (
    <header
      className="sticky top-0 z-40 glass"
      style={{
        height: 56,
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(15,23,42,0.08)',
      }}
    >
      <div className="h-full flex items-center px-3 sm:px-5 gap-2 sm:gap-4 min-w-0">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg glow-green"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <Shield size={16} className="text-neon-green" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-bold text-sm tracking-tight text-ink-0">CA-xNIDS</span>
            <span className="mono-label" style={{ marginTop: 2 }}>
              Confidence-Aware Threat Intelligence
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden md:block w-px h-6 bg-surface-3 flex-shrink-0 mx-1" />

        {/* Center: Attack ticker */}
        <div className="hidden md:flex flex-1 min-w-0 items-center justify-center">
          <AttackTicker attacks={attacks} />
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto">
          {/* Mode badge */}
          <span
            className="hidden sm:inline font-mono text-xs font-bold px-2 py-0.5 rounded"
            style={{
              background: detectionMode === 'ca_xnids' ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.08)',
              border: `1px solid ${detectionMode === 'ca_xnids' ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.25)'}`,
              color: detectionMode === 'ca_xnids' ? '#10B981' : '#8B5CF6',
            }}
          >
            {detectionMode === 'ca_xnids' ? 'CA-xNIDS' : 'xNIDS'}
          </span>

          <div className="hidden lg:block w-px h-4 bg-surface-3" />
          <div className="hidden lg:block"><LiveClock /></div>
          <div className="hidden xl:block w-px h-4 bg-surface-3" />
          <div className="hidden xl:block"><PacketRate /></div>
          <div className="w-px h-4 bg-surface-3" />
          <WSStatusDot connected={connected} />
          <div className="w-px h-4 bg-surface-3" />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.08)', color: 'var(--text-secondary)' }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Global start/stop */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggleMonitoring}
            disabled={!connected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={
              simRunning
                ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444' }
                : { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }
            }
          >
            {simRunning ? <Square size={11} /> : <Play size={11} />}
            <span className="hidden sm:inline">{simRunning ? 'Stop' : 'Monitor'}</span>
          </motion.button>
        </div>
      </div>
    </header>
  )
}
