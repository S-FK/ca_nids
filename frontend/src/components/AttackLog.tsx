import { useStore } from '../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import type { AttackEvent } from '../types'

const TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  DoS:   { color: '#ff4757', bg: 'rgba(255,71,87,0.12)' },
  Probe: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  R2L:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  U2R:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === 'HIGH')   return <span className="badge badge-high">HIGH</span>
  if (tier === 'MEDIUM') return <span className="badge badge-medium">MED</span>
  return <span className="badge badge-low">LOW</span>
}

function ActionCell({ tier }: { tier: string }) {
  if (tier === 'HIGH') return (
    <span className="font-mono text-xs text-neon-green flex items-center gap-1">
      <span>✓</span> Deployed
    </span>
  )
  if (tier === 'MEDIUM') return (
    <span className="font-mono text-xs text-neon-amber flex items-center gap-1">
      <span>⚠</span> Review
    </span>
  )
  return (
    <span className="font-mono text-xs text-ink-3 flex items-center gap-1">
      <span>—</span> Manual
    </span>
  )
}

function LogRow({ ev, isNew }: { ev: AttackEvent; isNew: boolean }) {
  const ts = new Date(ev.timestamp).toISOString().slice(11, 19)
  const typeCfg = TYPE_CONFIG[ev.attack_type] ?? { color: '#e2e8f0', bg: 'rgba(255,255,255,0.05)' }
  const topFeature = ev.features?.[0]?.name ?? '—'

  return (
    <motion.tr
      initial={isNew ? { opacity: 0, backgroundColor: 'rgba(255,71,87,0.08)' } : false}
      animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="border-b group"
      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
    >
      {/* Time */}
      <td className="py-2 px-3 whitespace-nowrap">
        <span className="font-mono text-xs text-ink-3">{ts}</span>
      </td>

      {/* Type */}
      <td className="py-2 px-3">
        <span
          className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
          style={{ color: typeCfg.color, background: typeCfg.bg }}
        >
          {ev.attack_type ?? '—'}
        </span>
      </td>

      {/* Probability */}
      <td className="py-2 px-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div
            className="h-1 rounded-full"
            style={{
              width: 32,
              background: '#0f1621',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${ev.prob * 100}%`,
                background: ev.prob > 0.5 ? '#ff4757' : '#00ff88',
              }}
            />
          </div>
          <span className="font-mono text-xs text-ink-1">
            {(ev.prob * 100).toFixed(1)}%
          </span>
        </div>
      </td>

      {/* Tier badge */}
      <td className="py-2 px-3">
        <TierBadge tier={ev.tier} />
      </td>

      {/* Scope */}
      <td className="py-2 px-3">
        <span className="font-mono text-xs text-ink-2">{ev.scope ?? '—'}</span>
      </td>

      {/* Action */}
      <td className="py-2 px-3">
        <ActionCell tier={ev.tier} />
      </td>

      {/* Top feature */}
      <td className="py-2 px-3 max-w-[160px]">
        <span
          className="font-mono text-xs text-ink-3 truncate block"
          title={ev.features?.slice(0, 2).map((f) => f.name).join(', ')}
        >
          {topFeature}
        </span>
      </td>
    </motion.tr>
  )
}

const HEADERS = ['TIME', 'TYPE', 'PROB', 'TIER', 'SCOPE', 'ACTION', 'TOP FEATURE']

export function AttackLog() {
  const attacks = useStore((s) => s.attacks)
  const latestId = attacks[0]?.packet_id
  const shown = attacks.slice(0, 20)

  return (
    <div
      className="glass flex flex-col"
      style={{ maxHeight: 280, background: 'rgba(10,15,22,0.8)' }}
    >
      {/* Title row */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-red animate-pulse-dot" />
          <span className="mono-label">Incident Log</span>
        </div>
        <span className="mono-label">
          <span className="text-ink-1">{attacks.length}</span> events
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1">
        {attacks.length === 0 ? (
          <div className="flex items-center justify-center h-16 gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse-dot" />
            <span className="mono-label">Monitoring… no attacks detected</span>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10" style={{ background: '#060a0f' }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    className="py-2 px-3 text-left"
                  >
                    <span className="mono-label">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {shown.map((ev, i) => (
                  <LogRow
                    key={ev.packet_id}
                    ev={ev}
                    isNew={i === 0 && ev.packet_id === latestId}
                  />
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
