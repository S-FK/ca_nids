import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import type { PacketEntry } from '../store/useStore'
import { clsx } from 'clsx'
import { ShieldAlert, ChevronDown, ChevronUp, Filter } from 'lucide-react'

const TYPE_COLORS: Record<string, string> = {
  DoS: '#EF4444', Probe: '#F59E0B', R2L: '#8B5CF6', U2R: '#3B82F6',
}
const TYPE_BG: Record<string, string> = {
  DoS: 'rgba(239,68,68,0.08)', Probe: 'rgba(245,158,11,0.08)',
  R2L: 'rgba(139,92,246,0.08)', U2R: 'rgba(59,130,246,0.08)',
}
const GROUP_COLORS: Record<string, string> = {
  basic: '#3B82F6', content: '#8B5CF6', time_traffic: '#F59E0B', host_traffic: '#10B981',
}

const ATTACK_TYPES = ['DoS', 'Probe', 'R2L', 'U2R'] as const

function TierBadge({ tier }: { tier: string }) {
  const cls = tier === 'HIGH' ? 'badge-high' : tier === 'MEDIUM' ? 'badge-medium' : 'badge-low'
  return <span className={`badge ${cls}`}>{tier}</span>
}

function ThreatCard({ pkt }: { pkt: PacketEntry }) {
  const [expanded, setExpanded] = useState(false)
  const typeColor = TYPE_COLORS[pkt.attack_type ?? ''] ?? '#EF4444'
  const typeBg    = TYPE_BG[pkt.attack_type ?? ''] ?? 'rgba(239,68,68,0.06)'
  const ts        = new Date(pkt.timestamp).toISOString().slice(0, 23).replace('T', ' ')
  const tierColor = pkt.tier === 'HIGH' ? '#10B981' : pkt.tier === 'MEDIUM' ? '#F59E0B' : '#EF4444'
  const topFeats  = (pkt.features ?? []).slice(0, 3).map((f) => f.name)
  const sorted    = [...(pkt.features ?? [])].sort((a, b) => b.importance - a.importance).slice(0, 8)
  const maxImp    = sorted[0]?.importance ?? 1

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="glass overflow-hidden"
      style={{
        background: 'var(--surface-card-translucent)',
        borderLeft: `2px solid ${typeColor}`,
      }}
    >
      {/* Summary row */}
      <div
        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-[rgba(var(--ink-rgb),0.03)]"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Type badge */}
        <span className="font-mono text-xs font-bold px-2 py-1 rounded flex-shrink-0"
          style={{ color: typeColor, background: typeBg }}>
          {pkt.attack_type ?? 'UNK'}
        </span>

        {/* Packet ID + time */}
        <div className="flex-shrink-0">
          <p className="font-mono text-xs font-bold text-ink-0">#{pkt.packet_id}</p>
          <p className="font-mono text-[10px] text-ink-3">{ts} UTC</p>
        </div>

        {/* Prob bar */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pkt.prob * 100}%`, background: `linear-gradient(90deg, ${typeColor}, ${typeColor}80)` }} />
          </div>
          <span className="font-mono text-xs font-bold flex-shrink-0" style={{ color: typeColor }}>
            {(pkt.prob * 100).toFixed(1)}%
          </span>
        </div>

        {/* Confidence */}
        {pkt.confidence != null && (
          <span className="font-mono text-xs flex-shrink-0" style={{ color: tierColor }}>
            conf {(pkt.confidence * 100).toFixed(0)}%
          </span>
        )}

        {/* Tier */}
        {pkt.tier && <TierBadge tier={pkt.tier} />}

        {/* Source */}
        {pkt.source === 'manual' && (
          <span className="mono-label flex-shrink-0" style={{ color: '#3B82F6' }}>MANUAL</span>
        )}

        {/* Top features preview */}
        {topFeats.length > 0 && (
          <span className="font-mono text-[11px] text-ink-3 truncate hidden lg:block max-w-[200px]">
            {topFeats.join(', ')}
          </span>
        )}

        {/* Expand toggle */}
        <div className="flex-shrink-0 text-ink-4">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-[rgba(var(--ink-rgb),0.08)] grid grid-cols-2 gap-6 pt-4">
              {/* Feature importance */}
              <div>
                <p className="mono-label mb-3">Feature Attribution</p>
                {sorted.length > 0 ? (
                  <div className="space-y-2.5">
                    {sorted.map((f, i) => {
                      const gc = GROUP_COLORS[f.group] ?? 'var(--text-tertiary)'
                      const pct = (f.importance / maxImp) * 100
                      return (
                        <div key={f.name} className="flex items-center gap-2">
                          <span className="mono-label w-4 text-ink-4 text-right">{i + 1}</span>
                          <span className="font-mono text-xs text-ink-1 w-32 truncate" title={f.name}>{f.name}</span>
                          <div className="flex-1 relative h-1.5">
                            <div className="absolute inset-0 rounded-full bg-surface-2" />
                            <motion.div className="absolute top-0 left-0 h-full rounded-full"
                              style={{ background: gc }}
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.4, delay: i * 0.03 }} />
                          </div>
                          <span className="font-mono text-[10px] w-9 text-right" style={{ color: gc }}>
                            {(f.importance * 100).toFixed(1)}%
                          </span>
                          {f.std > 0 && (
                            <span className="font-mono text-[9px] text-ink-4 w-10">±{(f.std * 100).toFixed(1)}%</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-ink-3">No feature attribution data</p>
                )}
              </div>

              {/* Defence rule */}
              <div>
                <p className="mono-label mb-3">Defence Rule</p>
                <div className="space-y-2 text-xs font-mono">
                  {pkt.tier === 'LOW' ? (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p className="text-neon-red font-bold mb-1">Rule Not Generated</p>
                      <p className="text-ink-2">
                        Confidence {pkt.confidence != null ? `${(pkt.confidence * 100).toFixed(0)}%` : '?'} below threshold.
                        Manual investigation required.
                      </p>
                    </div>
                  ) : (
                    <>
                      {pkt.iptables_rule && (
                        <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                          <p className="text-neon-blue mb-1">iptables</p>
                          <p className="text-ink-1 break-all leading-relaxed">{pkt.iptables_rule}</p>
                        </div>
                      )}
                      {pkt.openflow_rule && (
                        <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                          <p className="text-neon-purple mb-1">OpenFlow</p>
                          <p className="text-ink-1 break-all leading-relaxed">{pkt.openflow_rule}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="mono-label">Status:</span>
                        {pkt.tier === 'HIGH'
                          ? <span className="mono-label text-neon-green">✓ Auto-deployed</span>
                          : <span className="mono-label text-neon-amber">⚠ Awaiting review</span>}
                        {pkt.scope && <span className="mono-label ml-2 text-ink-3">scope: {pkt.scope}</span>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function ThreatsPage() {
  const packets        = useStore((s) => s.packets)
  const totalAttacks   = useStore((s) => s.totalAttacks)
  const attackTypeCounts = useStore((s) => s.attackTypeCounts)
  const [filter, setFilter] = useState<string | null>(null)

  const threats = packets.filter((p) => p.is_attack && (filter === null || p.attack_type === filter))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[rgba(var(--ink-rgb),0.08)] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-ink-0 flex items-center gap-2">
              <ShieldAlert size={18} style={{ color: '#EF4444' }} />
              Threat Log
            </h1>
            <p className="mono-label mt-0.5">All detected malicious packets with explanations and defence rules</p>
          </div>

          {/* Total counter */}
          <div className="text-right">
            <p className="text-3xl font-bold font-mono" style={{ color: totalAttacks > 0 ? '#EF4444' : 'var(--text-tertiary)' }}>
              {totalAttacks}
            </p>
            <p className="mono-label">total threats</p>
          </div>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-3 mt-4">
          <Filter size={12} className="text-ink-3" />
          <span className="mono-label">Filter:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter(null)}
              className="px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all"
              style={{
                background: filter === null ? 'var(--color-primary-50)' : 'rgba(var(--ink-rgb),0.03)',
                border: `1px solid ${filter === null ? 'var(--color-primary-500)' : 'rgba(var(--ink-rgb),0.08)'}`,
                color: filter === null ? 'var(--color-primary-700)' : 'var(--text-secondary)',
              }}
            >
              ALL ({totalAttacks})
            </button>
            {ATTACK_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(filter === t ? null : t)}
                className="px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all"
                style={{
                  background: filter === t ? `${TYPE_BG[t]}` : 'rgba(var(--ink-rgb),0.03)',
                  border: `1px solid ${filter === t ? TYPE_COLORS[t] + '50' : 'rgba(var(--ink-rgb),0.08)'}`,
                  color: filter === t ? TYPE_COLORS[t] : 'var(--text-tertiary)',
                }}
              >
                {t} ({attackTypeCounts[t] ?? 0})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Threat list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {threats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-ink-3">
            <ShieldAlert size={40} className="opacity-15" />
            <p className="text-sm">
              {totalAttacks === 0
                ? 'No threats detected yet — start monitoring to see attack detections here.'
                : 'No threats match the current filter.'}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {threats.map((pkt) => (
              <ThreatCard key={pkt.packet_id} pkt={pkt} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
