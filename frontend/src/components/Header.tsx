import { Shield, Play, Square } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { AttackEvent } from '../types'

async function apiControl(action: 'start' | 'stop') {
  await fetch('/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
}

const TYPE_COLORS: Record<string, string> = {
  DoS:   '#ff4757',
  Probe: '#fbbf24',
  R2L:   '#a78bfa',
  U2R:   '#60a5fa',
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
              style={{ color: TYPE_COLORS[ev.attack_type] ?? '#e2e8f0' }}
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
            background: connected ? '#00ff88' : '#ff4757',
            animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }}
        />
        {connected && (
          <div
            className="absolute inset-0 w-2 h-2 rounded-full"
            style={{
              background: '#00ff88',
              animation: 'pulse-ring 2s ease-out infinite',
            }}
          />
        )}
      </div>
      <span
        className="mono-label"
        style={{ color: connected ? '#00ff88' : '#ff4757' }}
      >
        {connected ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  )
}

export function Header() {
  const { connected, attacks, simRunning, detectionMode } = useStore()

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
        background: 'rgba(6,10,15,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="h-full flex items-center px-5 gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg glow-green"
            style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}
          >
            <Shield size={16} className="text-neon-green" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm tracking-tight text-ink-0">CA-xNIDS</span>
            <span className="mono-label" style={{ marginTop: 2 }}>
              Confidence-Aware Threat Intelligence
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-surface-3 flex-shrink-0 mx-1" />

        {/* Center: Attack ticker */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <AttackTicker attacks={attacks} />
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Mode badge */}
          <span
            className="font-mono text-xs font-bold px-2 py-0.5 rounded"
            style={{
              background: detectionMode === 'ca_xnids' ? 'rgba(0,255,136,0.08)' : 'rgba(167,139,250,0.08)',
              border: `1px solid ${detectionMode === 'ca_xnids' ? 'rgba(0,255,136,0.25)' : 'rgba(167,139,250,0.25)'}`,
              color: detectionMode === 'ca_xnids' ? '#00ff88' : '#a78bfa',
            }}
          >
            {detectionMode === 'ca_xnids' ? 'CA-xNIDS' : 'xNIDS'}
          </span>

          <div className="w-px h-4 bg-surface-3" />
          <LiveClock />
          <div className="w-px h-4 bg-surface-3" />
          <PacketRate />
          <div className="w-px h-4 bg-surface-3" />
          <WSStatusDot connected={connected} />
          <div className="w-px h-4 bg-surface-3" />

          {/* Global start/stop */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggleMonitoring}
            disabled={!connected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={
              simRunning
                ? { background: 'rgba(255,71,87,0.12)', border: '1px solid rgba(255,71,87,0.35)', color: '#ff4757' }
                : { background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88' }
            }
          >
            {simRunning ? <Square size={11} /> : <Play size={11} />}
            {simRunning ? 'Stop' : 'Monitor'}
          </motion.button>
        </div>
      </div>
    </header>
  )
}
