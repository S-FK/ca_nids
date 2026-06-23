import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Radio, Lock, Crown, TriangleAlert, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'

async function apiInject(type: 'normal' | 'attack', count: number, attack_type?: string) {
  await fetch('/api/inject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, count, attack_type }),
  })
}

const ATTACK_CONFIG = {
  DoS: {
    icon: Zap,
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    title: 'DoS Attack',
    subtitle: 'Denial of Service',
    description: 'Floods the target with traffic to exhaust resources and cause service disruption. Exploits bandwidth and connection limits.',
    techniques: ['SYN Flood (Neptune)', 'ICMP Flood (Smurf)', 'UDP Flood (Back)', 'Teardrop Fragmentation', 'Land Attack'],
    defaultCount: 8,
  },
  Probe: {
    icon: Radio,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    title: 'Network Probe',
    subtitle: 'Reconnaissance',
    description: 'Systematically scans network hosts and services to discover vulnerabilities, open ports, and topology information.',
    techniques: ['Port Sweep (Portsweep)', 'IP Sweep (Ipsweep)', 'Vulnerability Scan (Satan)', 'Nmap Fingerprinting', 'OS Detection'],
    defaultCount: 5,
  },
  R2L: {
    icon: Lock,
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    title: 'R2L Attack',
    subtitle: 'Remote to Local',
    description: 'Exploits network service vulnerabilities to gain local machine access from a remote machine. Targets authentication weaknesses.',
    techniques: ['FTP Write Exploit', 'Password Guessing', 'IMAP Buffer Overflow', 'Phf CGI Exploit', 'Warezmaster'],
    defaultCount: 3,
  },
  U2R: {
    icon: Crown,
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    title: 'U2R Attack',
    subtitle: 'Privilege Escalation',
    description: 'Exploits system vulnerabilities to gain root/superuser privileges from a normal user account. Most dangerous attack class.',
    techniques: ['Buffer Overflow', 'Loadmodule Exploit', 'Perl Script Attack', 'Rootkit Installation', 'Kernel Exploit'],
    defaultCount: 2,
  },
} as const

type AttackType = keyof typeof ATTACK_CONFIG

function AttackCard({ type }: { type: AttackType }) {
  const cfg = ATTACK_CONFIG[type]
  const Icon = cfg.icon
  const [count, setCount] = useState<number>(cfg.defaultCount)
  const [loading, setLoading] = useState(false)
  const [fired, setFired] = useState(false)
  const { addInjectionLog } = useStore()

  const launch = async () => {
    setLoading(true)
    await apiInject('attack', count, type)
    addInjectionLog(`Launched ${type} attack (${count} pkts)`, count)
    setLoading(false)
    setFired(true)
    setTimeout(() => setFired(false), 2000)
  }

  return (
    <motion.div
      layout
      className="glass flex flex-col"
      style={{
        background: fired ? cfg.bg : 'var(--surface-card-translucent)',
        border: `1px solid ${fired ? cfg.color + '50' : 'rgba(var(--ink-rgb),0.08)'}`,
        transition: 'background 0.4s, border 0.4s',
        boxShadow: fired ? `0 0 24px ${cfg.color}20` : 'none',
        borderLeft: `2px solid ${cfg.color}`,
      }}
    >
      {/* Header */}
      <div className="p-5 border-b border-[rgba(var(--ink-rgb),0.06)]">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <Icon size={18} style={{ color: cfg.color }} />
          </div>
          <div>
            <h3 className="font-bold text-ink-0 text-base">{cfg.title}</h3>
            <p className="mono-label" style={{ color: cfg.color }}>{cfg.subtitle}</p>
          </div>
        </div>

        <p className="text-xs text-ink-2 mt-3 leading-relaxed">{cfg.description}</p>
      </div>

      {/* Techniques */}
      <div className="p-5 border-b border-[rgba(var(--ink-rgb),0.06)] flex-1">
        <p className="mono-label mb-3">Known Techniques</p>
        <ul className="space-y-1.5">
          {cfg.techniques.map((t) => (
            <li key={t} className="flex items-center gap-2 text-xs text-ink-2">
              <ChevronRight size={10} style={{ color: cfg.color }} />
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Controls */}
      <div className="p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="mono-label">Burst Size</p>
            <span className="font-mono text-sm font-bold" style={{ color: cfg.color }}>{count} pkts</span>
          </div>
          <input
            type="range" min={1} max={20} value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: cfg.color }}
          />
          <div className="flex justify-between mt-1">
            <span className="mono-label">1</span>
            <span className="mono-label">20</span>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={launch}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
          style={{
            background: fired ? `${cfg.color}30` : `${cfg.color}15`,
            border: `1px solid ${cfg.color}${fired ? '60' : '35'}`,
            color: cfg.color,
            boxShadow: fired ? `0 0 16px ${cfg.color}30` : 'none',
          }}
        >
          {fired ? (
            <><TriangleAlert size={14} /> Launched!</>
          ) : (
            <><Icon size={14} /> Launch {type} Attack</>
          )}
        </motion.button>
      </div>
    </motion.div>
  )
}

function CoordinatedAttack() {
  const [selected, setSelected] = useState<Set<AttackType>>(new Set(['DoS', 'Probe']))
  const [totalPkts, setTotalPkts] = useState(12)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { addInjectionLog } = useStore()

  const toggle = (t: AttackType) =>
    setSelected((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n })

  const launch = async () => {
    if (selected.size === 0) return
    setLoading(true)
    const perType = Math.ceil(totalPkts / selected.size)
    for (const t of selected) {
      await apiInject('attack', perType, t)
    }
    addInjectionLog(`Coordinated attack: [${[...selected].join(', ')}] × ${totalPkts} pkts`, totalPkts)
    setLoading(false)
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }

  return (
    <div
      className="glass p-6"
      style={{
        background: done ? 'rgba(239,68,68,0.06)' : 'var(--surface-card-translucent)',
        border: done ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(var(--ink-rgb),0.08)',
        transition: 'all 0.4s',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <TriangleAlert size={16} className="text-neon-red" />
        <h3 className="font-bold text-ink-0">Coordinated Multi-Vector Attack</h3>
        <span className="badge badge-low ml-auto">Advanced</span>
      </div>
      <p className="text-xs text-ink-2 mb-5">
        Simulate a real-world botnet scenario — launch multiple attack types simultaneously to overwhelm detection systems and create confusion.
      </p>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="mono-label mb-3">Select Attack Vectors</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(ATTACK_CONFIG) as AttackType[]).map((t) => {
              const cfg = ATTACK_CONFIG[t]
              const active = selected.has(t)
              return (
                <button
                  key={t}
                  onClick={() => toggle(t)}
                  className="flex items-center gap-2 p-3 rounded-xl text-sm font-bold font-mono transition-all"
                  style={{
                    background: active ? `${cfg.color}15` : 'rgba(var(--ink-rgb),0.03)',
                    border: `1px solid ${active ? cfg.color + '40' : 'rgba(var(--ink-rgb),0.08)'}`,
                    color: active ? cfg.color : 'var(--text-tertiary)',
                  }}
                >
                  <cfg.icon size={13} />
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex justify-between mb-2">
              <p className="mono-label">Total Packets</p>
              <span className="font-mono text-sm font-bold text-neon-red">{totalPkts}</span>
            </div>
            <input type="range" min={4} max={40} value={totalPkts}
              onChange={(e) => setTotalPkts(Number(e.target.value))}
              className="w-full" style={{ accentColor: '#EF4444' }} />
          </div>

          <div className="text-xs text-ink-3 font-mono space-y-1">
            <p>Vectors: <span className="text-ink-1">{selected.size}</span></p>
            <p>Per vector: <span className="text-ink-1">~{Math.ceil(totalPkts / Math.max(selected.size, 1))} pkts</span></p>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={launch}
            disabled={loading || selected.size === 0}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: done ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#EF4444',
              opacity: selected.size === 0 ? 0.4 : 1,
              boxShadow: done ? '0 0 24px rgba(239,68,68,0.3)' : 'none',
            }}
          >
            <TriangleAlert size={14} />
            {done ? 'Attack Launched!' : `Execute Coordinated Attack`}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

export function AttacksPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-0 mb-0.5">Attack Studio</h1>
        <p className="text-sm text-ink-2">Simulate specific attack types to test detection capabilities and evaluate CA-xNIDS explanations.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {(Object.keys(ATTACK_CONFIG) as AttackType[]).map((t) => (
          <AttackCard key={t} type={t} />
        ))}
      </div>

      <CoordinatedAttack />
    </div>
  )
}
