import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import type { PacketEntry } from '../store/useStore'
import { clsx } from 'clsx'
import { ShieldCheck, ShieldAlert, ChevronRight, Lock, Radio, Server, Cpu, Network, BarChart3 } from 'lucide-react'

const TYPE_COLORS: Record<string, string> = {
  DoS: '#EF4444', Probe: '#F59E0B', R2L: '#8B5CF6', U2R: '#3B82F6',
}
const GROUP_COLORS: Record<string, string> = {
  basic: '#3B82F6', content: '#8B5CF6', time_traffic: '#F59E0B', host_traffic: '#10B981',
}

// KDD99 feature groups (mirrors src/data_loader.py FEATURE_GROUPS)
const FEATURE_GROUPS: Record<string, string[]> = {
  basic: ['duration','protocol_type','service','flag','src_bytes','dst_bytes','land','wrong_fragment','urgent'],
  content: ['hot','num_failed_logins','logged_in','num_compromised','root_shell','su_attempted','num_root','num_file_creations','num_shells','num_access_files','num_outbound_cmds','is_host_login','is_guest_login'],
  time_traffic: ['count','srv_count','serror_rate','srv_serror_rate','rerror_rate','srv_rerror_rate','same_srv_rate','diff_srv_rate','srv_diff_host_rate'],
  host_traffic: ['dst_host_count','dst_host_srv_count','dst_host_same_srv_rate','dst_host_diff_srv_rate','dst_host_same_src_port_rate','dst_host_srv_diff_host_rate','dst_host_serror_rate','dst_host_srv_serror_rate','dst_host_rerror_rate','dst_host_srv_rerror_rate'],
}

const GROUP_ICONS = { basic: Network, content: Cpu, time_traffic: BarChart3, host_traffic: Server }
const GROUP_LABELS: Record<string, string> = {
  basic: 'Connection Header', content: 'Session Content', time_traffic: 'Traffic Statistics', host_traffic: 'Host Statistics',
}

function TierBadge({ tier }: { tier: string }) {
  const cls = tier === 'HIGH' ? 'badge-high' : tier === 'MEDIUM' ? 'badge-medium' : 'badge-low'
  return <span className={`badge ${cls}`}>{tier}</span>
}

function PacketRow({ pkt, isSelected, onClick }: {
  pkt: PacketEntry; isSelected: boolean; onClick: () => void
}) {
  const ts = pkt.timestamp ? new Date(pkt.timestamp).toISOString().slice(11, 23) : '—'
  const typeColor = pkt.attack_type ? (TYPE_COLORS[pkt.attack_type] ?? 'var(--text-primary)') : '#10B981'

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all border-b border-[rgba(var(--ink-rgb),0.05)] last:border-0',
        isSelected
          ? 'bg-[rgba(var(--ink-rgb),0.08)]'
          : pkt.is_attack
            ? 'hover:bg-[rgba(239,68,68,0.06)]'
            : 'hover:bg-[rgba(var(--ink-rgb),0.03)]',
      )}
    >
      <div className="flex-shrink-0 w-4 flex items-center justify-center">
        {pkt.is_attack
          ? <ShieldAlert size={13} style={{ color: '#EF4444' }} />
          : <ShieldCheck size={13} style={{ color: '#10B98160' }} />}
      </div>
      <span className="font-mono text-[11px] text-ink-3 flex-shrink-0 w-28">{ts}</span>
      <span className="font-mono text-xs font-bold flex-shrink-0 w-14" style={{ color: typeColor }}>
        {pkt.is_attack ? (pkt.attack_type ?? 'UNK') : 'normal'}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full rounded-full" style={{
            width: `${pkt.prob * 100}%`,
            background: pkt.is_attack ? 'linear-gradient(90deg,#EF4444,#F87171)' : 'linear-gradient(90deg,#10B98140,#10B98120)',
          }} />
        </div>
        <span className="font-mono text-[10px] text-ink-3 w-10 text-right">
          {(pkt.prob * 100).toFixed(1)}%
        </span>
      </div>
      {pkt.tier && <TierBadge tier={pkt.tier} />}
      {pkt.source === 'manual' && <span className="mono-label" style={{ color: '#3B82F6' }}>MANUAL</span>}
      {pkt.is_attack && (
        <ChevronRight size={12} className={clsx('text-ink-4 transition-transform flex-shrink-0', isSelected && 'rotate-90')} />
      )}
    </motion.div>
  )
}

// ── Packet Inspector ───────────────────────────────────────────────────────────

function PacketInspector({ pkt }: { pkt: PacketEntry }) {
  const rf = pkt.raw_features ?? {}
  const importantNames = new Set((pkt.features ?? []).map((f) => f.name))

  return (
    <motion.div key={`inspector-${pkt.packet_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto p-5 space-y-4">
      {/* Packet identity row */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(var(--ink-rgb),0.03)', border: '1px solid rgba(var(--ink-rgb),0.08)' }}>
        <div className="flex items-center gap-3 mb-3">
          {pkt.is_attack
            ? <ShieldAlert size={16} style={{ color: TYPE_COLORS[pkt.attack_type ?? ''] ?? '#EF4444' }} />
            : <ShieldCheck size={16} style={{ color: '#10B981' }} />}
          <span className="font-mono text-sm font-bold text-ink-0">
            Packet #{pkt.packet_id}
          </span>
          <span className="font-mono text-xs text-ink-3 ml-auto">
            {new Date(pkt.timestamp).toISOString().slice(0, 23).replace('T', ' ')} UTC
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Classification', value: pkt.is_attack ? (pkt.attack_type ?? 'ATTACK') : 'NORMAL', color: pkt.is_attack ? (TYPE_COLORS[pkt.attack_type ?? ''] ?? '#EF4444') : '#10B981' },
            { label: 'Anomaly Prob', value: `${(pkt.prob * 100).toFixed(2)}%`, color: pkt.is_attack ? '#EF4444' : '#10B981' },
            { label: 'Source', value: pkt.source === 'manual' ? 'INJECTED' : 'AUTO-SIM', color: pkt.source === 'manual' ? '#3B82F6' : 'var(--text-tertiary)' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="mono-label mb-0.5">{label}</p>
              <p className="font-mono text-sm font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature groups */}
      {(Object.entries(FEATURE_GROUPS) as [string, string[]][]).map(([group, names]) => {
        const Icon = GROUP_ICONS[group as keyof typeof GROUP_ICONS] ?? Network
        const gc = GROUP_COLORS[group] ?? 'var(--text-tertiary)'
        const groupFeatures = names.filter((n) => rf[n] !== undefined)
        if (groupFeatures.length === 0) return null

        return (
          <div key={group} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(var(--ink-rgb),0.08)' }}>
            {/* Group header */}
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: `${gc}12`, borderBottom: '1px solid rgba(var(--ink-rgb),0.06)' }}>
              <Icon size={13} style={{ color: gc }} />
              <span className="font-mono text-xs font-bold" style={{ color: gc }}>{GROUP_LABELS[group]}</span>
              <span className="mono-label ml-auto">{groupFeatures.length} features</span>
            </div>

            {/* Feature rows */}
            <div className="divide-y divide-[rgba(var(--ink-rgb),0.04)]">
              {groupFeatures.map((name) => {
                const val = rf[name] ?? 0
                const isKey = importantNames.has(name)
                const absVal = Math.abs(val)
                const barPct = Math.min(absVal / 3, 1) * 100

                return (
                  <div key={name} className={clsx(
                    'flex items-center gap-3 px-4 py-2 transition-colors',
                    isKey && 'bg-[rgba(239,68,68,0.04)]'
                  )}>
                    {/* Key indicator */}
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: isKey ? '#EF4444' : 'rgba(var(--ink-rgb),0.1)' }} />

                    {/* Feature name */}
                    <span className={clsx(
                      'font-mono text-xs w-44 flex-shrink-0',
                      isKey ? 'text-ink-0 font-semibold' : 'text-ink-2'
                    )}>
                      {name}
                    </span>

                    {/* Value bar */}
                    <div className="flex-1 h-1 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${barPct}%`, background: isKey ? '#EF4444' : gc + '60' }} />
                    </div>

                    {/* Raw value */}
                    <span className={clsx(
                      'font-mono text-[11px] w-14 text-right flex-shrink-0',
                      isKey ? 'text-neon-red font-bold' : 'text-ink-3'
                    )}>
                      {val.toFixed(3)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="mono-label text-center pb-2">Values are StandardScaler-normalized (σ units from mean)</p>
    </motion.div>
  )
}

// ── Analysis Panel ─────────────────────────────────────────────────────────────

function AnalysisPanel({ pkt }: { pkt: PacketEntry }) {
  const typeColor = pkt.attack_type ? (TYPE_COLORS[pkt.attack_type] ?? 'var(--text-primary)') : 'var(--text-primary)'
  const tierColor = pkt.tier === 'HIGH' ? '#10B981' : pkt.tier === 'MEDIUM' ? '#F59E0B' : '#EF4444'
  const sorted = [...(pkt.features ?? [])].sort((a, b) => b.importance - a.importance).slice(0, 8)
  const maxImp = sorted[0]?.importance ?? 1

  return (
    <motion.div key={`analysis-${pkt.packet_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto">
      <div className="p-5 border-b border-[rgba(var(--ink-rgb),0.08)]" style={{ background: `${typeColor}08` }}>
        <div className="flex items-center gap-3 mb-1">
          <ShieldAlert size={18} style={{ color: typeColor }} />
          <span className="font-bold text-lg" style={{ color: typeColor }}>{pkt.attack_type}</span>
          {pkt.tier && <TierBadge tier={pkt.tier} />}
        </div>
        <p className="mono-label">Packet #{pkt.packet_id} · {new Date(pkt.timestamp).toISOString().slice(11,23)}</p>
        <div className="flex items-center gap-6 mt-4">
          <div>
            <p className="mono-label mb-0.5">Anomaly Probability</p>
            <p className="text-2xl font-bold font-mono" style={{ color: typeColor }}>{(pkt.prob * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="mono-label mb-0.5">CA-xNIDS Confidence</p>
            <p className="text-2xl font-bold font-mono" style={{ color: tierColor }}>
              {pkt.confidence != null ? `${(pkt.confidence * 100).toFixed(0)}%` : '—'}
            </p>
          </div>
          {pkt.scope && (
            <div>
              <p className="mono-label mb-0.5">Rule Scope</p>
              <p className="text-sm font-mono text-ink-1 mt-1">{pkt.scope}</p>
            </div>
          )}
        </div>
      </div>

      {sorted.length > 0 && (
        <div className="p-5 border-b border-[rgba(var(--ink-rgb),0.08)]">
          <p className="mono-label mb-4">xNIDS Feature Attribution</p>
          <div className="space-y-3">
            {sorted.map((f, i) => {
              const gc = GROUP_COLORS[f.group] ?? 'var(--text-tertiary)'
              const pct = (f.importance / maxImp) * 100
              return (
                <div key={f.name} className="flex items-center gap-3">
                  <span className="mono-label w-4 text-ink-4 text-right">{i + 1}</span>
                  <span className="font-mono text-xs text-ink-1 w-28 truncate" title={f.name}>{f.name}</span>
                  <div className="flex-1 relative h-1.5">
                    <div className="absolute inset-0 rounded-full bg-surface-2" />
                    <motion.div className="absolute top-0 left-0 h-full rounded-full"
                      style={{ background: gc }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.04 }} />
                  </div>
                  <span className="font-mono text-[10px] w-10 text-right" style={{ color: gc }}>
                    {(f.importance * 100).toFixed(1)}%
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: gc }} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="p-5">
        <p className="mono-label mb-3">Generated Defence Rule</p>
        {pkt.tier === 'LOW' ? (
          <div className="rounded-xl p-4 text-xs font-mono"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-neon-red font-bold mb-1">Rule Not Generated</p>
            <p className="text-ink-2">CA-xNIDS confidence ({((pkt.confidence ?? 0) * 100).toFixed(0)}%) below deployment threshold. Manual investigation required.</p>
          </div>
        ) : (
          <div className="space-y-2 text-xs font-mono">
            {pkt.iptables_rule && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <span className="text-neon-blue">$ iptables: </span>
                <span className="text-ink-1 break-all">{pkt.iptables_rule}</span>
              </div>
            )}
            {pkt.tier === 'HIGH' && pkt.openflow_rule && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <span className="text-neon-purple">$ openflow: </span>
                <span className="text-ink-1 break-all">{pkt.openflow_rule}</span>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <span className="mono-label">Status:</span>
              {pkt.tier === 'HIGH'
                ? <span className="mono-label text-neon-green">✓ Auto-deployed</span>
                : <span className="mono-label text-neon-amber">⚠ Awaiting operator review</span>}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type PanelTab = 'analysis' | 'inspector'

export function DetectionPage() {
  const packets    = useStore((s) => s.packets)
  const simRunning = useStore((s) => s.simRunning)
  const [selected, setSelected] = useState<PacketEntry | null>(null)
  const [panelTab, setPanelTab] = useState<PanelTab>('analysis')
  const [live, setLive]         = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-select latest attack only when live
  const prevLengthRef = useRef(0)
  if (packets.length !== prevLengthRef.current) {
    prevLengthRef.current = packets.length
    if (live) {
      const latest = packets.find((p) => p.is_attack)
      if (latest && latest.packet_id !== selected?.packet_id) {
        setSelected(latest)
      }
    }
  }

  const stats = {
    total:   packets.length,
    attacks: packets.filter((p) => p.is_attack).length,
    normal:  packets.filter((p) => !p.is_attack).length,
  }

  const handleRowClick = (pkt: PacketEntry) => {
    if (!pkt.is_attack) return
    setSelected(pkt)
    setLive(false)   // user manually selected — pause auto-select
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-[rgba(var(--ink-rgb),0.08)] flex items-center gap-6 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-ink-0">Live Detection Feed</h1>
          <p className="mono-label mt-0.5">Real-time packet analysis with xNIDS explanation</p>
        </div>
        <div className="flex items-center gap-4 ml-auto text-xs font-mono">
          <span className="text-ink-3">Total <span className="text-ink-1">{stats.total}</span></span>
          <span className="text-neon-green">Normal <span>{stats.normal}</span></span>
          <span style={{ color: '#EF4444' }}>Attacks <span className="font-bold">{stats.attacks}</span></span>

          {/* Live / Lock toggle */}
          <button
            onClick={() => setLive((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={live
              ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }
              : { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#3B82F6' }
            }
          >
            {live ? <Radio size={11} /> : <Lock size={11} />}
            {live ? 'Live' : 'Locked'}
          </button>

          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: simRunning ? '#10B981' : '#EF4444',
                       animation: simRunning ? 'pulse-dot 2s ease-in-out infinite' : 'none' }} />
            <span style={{ color: simRunning ? '#10B981' : '#EF4444' }}>
              {simRunning ? 'MONITORING' : 'STOPPED'}
            </span>
          </div>
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 min-h-0">
        {/* Left: packet stream */}
        <div className="flex flex-col border-r border-[rgba(var(--ink-rgb),0.08)] overflow-hidden" style={{ width: '40%', flexShrink: 0 }}>
          <div className="px-4 py-2 border-b border-[rgba(var(--ink-rgb),0.08)] flex items-center gap-3"
            style={{ background: 'var(--surface-card-translucent-2)', flexShrink: 0 }}>
            <div className="w-4" />
            <span className="mono-label w-28">Timestamp</span>
            <span className="mono-label w-14">Type</span>
            <span className="mono-label flex-1">Probability</span>
            <span className="mono-label w-16">Conf.</span>
          </div>

          <div className="flex-1 overflow-y-auto" ref={listRef}>
            {packets.length === 0 ? (
              <div className="flex items-center justify-center h-full text-ink-3 text-sm">
                No packets yet — start monitoring or inject traffic.
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {packets.map((pkt) => (
                  <PacketRow
                    key={pkt.packet_id}
                    pkt={pkt}
                    isSelected={selected?.packet_id === pkt.packet_id}
                    onClick={() => handleRowClick(pkt)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Right: tab panel */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {selected ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-[rgba(var(--ink-rgb),0.08)] flex-shrink-0"
                style={{ background: 'rgba(10,15,22,0.6)' }}>
                {([
                  { id: 'analysis', label: 'xNIDS Analysis', icon: ShieldAlert },
                  { id: 'inspector', label: 'Packet Inspector', icon: Network },
                ] as { id: PanelTab; label: string; icon: typeof ShieldAlert }[]).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPanelTab(id)}
                    className={clsx(
                      'flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all',
                      panelTab === id
                        ? 'border-neon-green text-neon-green'
                        : 'border-transparent text-ink-3 hover:text-ink-1'
                    )}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                  {panelTab === 'analysis' ? (
                    <motion.div key="analysis" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                      <AnalysisPanel pkt={selected} />
                    </motion.div>
                  ) : (
                    <motion.div key="inspector" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                      <PacketInspector pkt={selected} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-ink-3">
              <ShieldAlert size={32} className="opacity-20" />
              <p className="text-sm">Click an attack packet to inspect it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
