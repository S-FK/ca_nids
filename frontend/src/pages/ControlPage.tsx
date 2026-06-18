import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Square, Send, Zap, Activity, Clock, CheckCircle2, AlertCircle, FlaskConical, Cpu } from 'lucide-react'
import { useStore } from '../store/useStore'
import { clsx } from 'clsx'

const ATTACK_TYPES = ['DoS', 'Probe', 'R2L', 'U2R'] as const
type AttackType = typeof ATTACK_TYPES[number]

const TYPE_COLORS: Record<AttackType, string> = {
  DoS: '#ff4757', Probe: '#fbbf24', R2L: '#a78bfa', U2R: '#60a5fa',
}

async function apiControl(action: 'start' | 'stop') {
  await fetch('/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
}

async function apiMode(mode: 'xnids' | 'ca_xnids') {
  await fetch('/api/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
}

async function apiInject(type: 'normal' | 'attack', count: number, attack_type?: string) {
  await fetch('/api/inject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, count, attack_type }),
  })
}

function StatusCard() {
  const { connected, simRunning, pipelineStatus, totalPackets, packetsPerSec, totalAttacks } = useStore()

  return (
    <div className="glass p-6" style={{ background: 'rgba(10,15,22,0.9)' }}>
      <p className="mono-label mb-4">System Status</p>

      {/* Big status indicator */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              background: simRunning ? '#00ff88' : '#334155',
              boxShadow: simRunning ? '0 0 12px #00ff88' : 'none',
              animation: simRunning ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            }}
          />
          {simRunning && (
            <div className="absolute inset-0 w-4 h-4 rounded-full bg-neon-green"
              style={{ animation: 'pulse-ring 2s ease-out infinite' }} />
          )}
        </div>
        <div>
          <p className={clsx('text-2xl font-bold font-mono', simRunning ? 'grad-green' : 'text-ink-3')}>
            {simRunning ? 'MONITORING ACTIVE' : 'SYSTEM STOPPED'}
          </p>
          <p className="mono-label mt-0.5">{pipelineStatus}</p>
        </div>
      </div>

      {/* Auto-traffic note */}
      <p className="text-xs text-ink-3 mb-5 leading-relaxed px-1">
        When monitoring starts, the engine automatically streams packets from the KDD Cup 99 dataset at ~4 Hz
        and auto-injects attack bursts every ~25 packets — no manual injection required to see detections.
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Packets Processed', value: totalPackets.toLocaleString(), icon: Activity, color: '#60a5fa' },
          { label: 'Rate',              value: `${packetsPerSec} pkt/s`,       icon: Clock,    color: '#00ff88' },
          { label: 'Attacks Detected',  value: totalAttacks.toString(),         icon: AlertCircle, color: '#ff4757' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={13} style={{ color }} />
              <span className="mono-label">{label}</span>
            </div>
            <p className="text-2xl font-bold font-mono" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Control buttons */}
      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { apiControl('start'); useStore.getState().setSimRunning(true) }}
          disabled={simRunning || !connected}
          className={clsx(
            'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all',
            simRunning || !connected
              ? 'opacity-30 cursor-not-allowed bg-surface-2 text-ink-3'
              : 'text-surface-0 cursor-pointer'
          )}
          style={!(simRunning || !connected) ? {
            background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
            boxShadow: '0 0 20px rgba(0,255,136,0.3)',
          } : {}}
        >
          <Play size={16} />
          Start Monitoring
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { apiControl('stop'); useStore.getState().setSimRunning(false) }}
          disabled={!simRunning}
          className={clsx(
            'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all',
            !simRunning
              ? 'opacity-30 cursor-not-allowed bg-surface-2 text-ink-3'
              : 'cursor-pointer'
          )}
          style={simRunning ? {
            background: 'rgba(255,71,87,0.12)',
            border: '1px solid rgba(255,71,87,0.4)',
            color: '#ff4757',
          } : {}}
        >
          <Square size={16} />
          Stop Monitoring
        </motion.button>
      </div>
    </div>
  )
}

function NormalTrafficCard() {
  const { addInjectionLog } = useStore()
  const [loading, setLoading] = useState(false)

  const inject = async (count: number) => {
    setLoading(true)
    await apiInject('normal', count)
    addInjectionLog(`Injected ${count} normal packet${count > 1 ? 's' : ''}`, count)
    setLoading(false)
  }

  return (
    <div className="glass p-6 card-accent-blue" style={{ background: 'rgba(10,15,22,0.9)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Activity size={16} className="text-neon-blue" />
        <p className="text-sm font-semibold text-ink-0">Normal Traffic</p>
      </div>
      <p className="text-xs text-ink-2 mb-5 leading-relaxed">
        Inject benign network packets into the detection pipeline. These should pass through without triggering alerts.
      </p>

      <div className="flex flex-wrap gap-2">
        {[1, 5, 10, 25, 50].map((n) => (
          <motion.button
            key={n}
            whileTap={{ scale: 0.95 }}
            onClick={() => inject(n)}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-mono font-semibold transition-all"
            style={{
              background: 'rgba(96,165,250,0.1)',
              border: '1px solid rgba(96,165,250,0.25)',
              color: '#60a5fa',
            }}
          >
            ×{n}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function MaliciousRequestCard() {
  const { addInjectionLog } = useStore()
  const [type, setType] = useState<AttackType>('DoS')
  const [count, setCount] = useState(3)
  const [loading, setLoading] = useState(false)
  const [fired, setFired] = useState(false)

  const inject = async () => {
    setLoading(true)
    await apiInject('attack', count, type)
    addInjectionLog(`Injected ${count} ${type} attack packet${count > 1 ? 's' : ''}`, count)
    setLoading(false)
    setFired(true)
    setTimeout(() => setFired(false), 1500)
  }

  const color = TYPE_COLORS[type]

  return (
    <div className="glass p-6 card-accent-red" style={{ background: 'rgba(10,15,22,0.9)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Zap size={16} style={{ color }} />
        <p className="text-sm font-semibold text-ink-0">Malicious Request</p>
      </div>
      <p className="text-xs text-ink-2 mb-5 leading-relaxed">
        Inject attack traffic directly into the detection pipeline. The LSTM will detect and xNIDS will explain it.
      </p>

      <div className="space-y-4">
        {/* Attack type selector */}
        <div>
          <p className="mono-label mb-2">Attack Type</p>
          <div className="flex gap-2 flex-wrap">
            {ATTACK_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all"
                style={{
                  background: type === t ? `${TYPE_COLORS[t]}20` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${type === t ? TYPE_COLORS[t] + '60' : 'rgba(255,255,255,0.06)'}`,
                  color: type === t ? TYPE_COLORS[t] : '#475569',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Count slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="mono-label">Packet Count</p>
            <span className="font-mono text-sm font-bold" style={{ color }}>{count}</span>
          </div>
          <input
            type="range" min={1} max={20} value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: color }}
          />
        </div>

        {/* Inject button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={inject}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{
            background: fired ? `${color}30` : `${color}15`,
            border: `1px solid ${color}40`,
            color,
            boxShadow: fired ? `0 0 20px ${color}30` : 'none',
          }}
        >
          <Send size={14} />
          {fired ? 'Injected!' : `Inject ${count} × ${type} Attack`}
        </motion.button>
      </div>
    </div>
  )
}

function DetectionModeCard() {
  const { detectionMode, setDetectionMode } = useStore()

  const select = async (mode: 'xnids' | 'ca_xnids') => {
    setDetectionMode(mode)
    await apiMode(mode)
  }

  return (
    <div className="glass p-6" style={{ background: 'rgba(10,15,22,0.9)' }}>
      <p className="mono-label mb-1">Detection Mode</p>
      <p className="text-xs text-ink-3 mb-5 leading-relaxed">
        Choose which explanation method is used when an attack is detected.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* xNIDS — paper method */}
        <button
          onClick={() => select('xnids')}
          className="text-left p-4 rounded-xl transition-all"
          style={{
            background: detectionMode === 'xnids' ? 'rgba(167,139,250,0.10)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${detectionMode === 'xnids' ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.07)'}`,
            boxShadow: detectionMode === 'xnids' ? '0 0 16px rgba(167,139,250,0.12)' : 'none',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical size={14} style={{ color: detectionMode === 'xnids' ? '#a78bfa' : '#475569' }} />
            <span className="font-mono text-sm font-bold" style={{ color: detectionMode === 'xnids' ? '#a78bfa' : '#94a3b8' }}>
              xNIDS
            </span>
            <span className="ml-auto text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
              Paper
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: detectionMode === 'xnids' ? '#94a3b8' : '#475569' }}>
            Single-run LIME explanation. No confidence score. Rules always auto-deployed.
          </p>
        </button>

        {/* CA-xNIDS — our improvement */}
        <button
          onClick={() => select('ca_xnids')}
          className="text-left p-4 rounded-xl transition-all"
          style={{
            background: detectionMode === 'ca_xnids' ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${detectionMode === 'ca_xnids' ? 'rgba(0,255,136,0.35)' : 'rgba(255,255,255,0.07)'}`,
            boxShadow: detectionMode === 'ca_xnids' ? '0 0 16px rgba(0,255,136,0.10)' : 'none',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={14} style={{ color: detectionMode === 'ca_xnids' ? '#00ff88' : '#475569' }} />
            <span className="font-mono text-sm font-bold" style={{ color: detectionMode === 'ca_xnids' ? '#00ff88' : '#94a3b8' }}>
              CA-xNIDS
            </span>
            <span className="ml-auto text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(0,255,136,0.08)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.2)' }}>
              Ours
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: detectionMode === 'ca_xnids' ? '#94a3b8' : '#475569' }}>
            Bootstrap-sampled LIME with confidence score &amp; tiered rule deployment (HIGH/MEDIUM/LOW).
          </p>
        </button>
      </div>
    </div>
  )
}

function InjectionLog() {
  const log = useStore((s) => s.injectionLog)

  return (
    <div className="glass flex flex-col" style={{ background: 'rgba(10,15,22,0.9)', minHeight: 220 }}>
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(255,255,255,0.06)]"
        style={{ background: 'rgba(15,22,33,0.6)', borderRadius: '12px 12px 0 0' }}>
        <div className="flex items-center gap-1.5 mr-2">
          {['#ff4757','#fbbf24','#00ff88'].map(c => (
            <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <CheckCircle2 size={12} className="text-ink-3" />
        <span className="mono-label">Injection Log</span>
        <span className="ml-auto mono-label">{log.length} entries</span>
      </div>

      <div className="flex-1 overflow-auto p-4 font-mono">
        <div className="text-xs mb-3">
          <span className="text-neon-green">ca-xnids</span>
          <span className="text-ink-3">@control</span>
          <span className="text-ink-1">:~$</span>
          <span className="text-ink-2 ml-1">tail -f /var/log/injections.log</span>
        </div>

        <AnimatePresence initial={false}>
          {log.length === 0 ? (
            <div className="text-xs text-ink-3">No injections yet. Use controls above to send packets.</div>
          ) : (
            log.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 mb-1.5 text-xs"
              >
                <span className="text-neon-green font-mono">[{entry.timestamp}]</span>
                <span className="text-ink-1">→</span>
                <span className="text-ink-0">{entry.label}</span>
              </motion.div>
            ))
          )}
        </AnimatePresence>

        <div className="text-xs mt-2">
          <span className="text-ink-3">$ </span>
          <span className="text-neon-green" style={{ animation: 'pulse-dot 1s ease-in-out infinite' }}>▋</span>
        </div>
      </div>
    </div>
  )
}

export function ControlPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-0 mb-0.5">Control Center</h1>
        <p className="text-sm text-ink-2">Start or stop the monitoring engine and inject test traffic on demand.</p>
      </div>

      <StatusCard />

      <DetectionModeCard />

      <div className="grid grid-cols-2 gap-4">
        <NormalTrafficCard />
        <MaliciousRequestCard />
      </div>

      <InjectionLog />
    </div>
  )
}
