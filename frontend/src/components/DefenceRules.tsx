import { useStore } from '../store/useStore'
import { Terminal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AttackEvent } from '../types'

const TIER_COLORS: Record<string, string> = {
  HIGH:   '#10B981',
  MEDIUM: '#F59E0B',
  LOW:    '#EF4444',
}

const TYPE_COLORS: Record<string, string> = {
  DoS:   '#EF4444',
  Probe: '#F59E0B',
  R2L:   '#8B5CF6',
  U2R:   '#3B82F6',
}

function TierBadgeInline({ tier }: { tier: string }) {
  const badgeClass =
    tier === 'HIGH'   ? 'badge-high' :
    tier === 'MEDIUM' ? 'badge-medium' :
    'badge-low'
  return <span className={`badge ${badgeClass}`}>{tier}</span>
}

function RuleBlock({ ev }: { ev: AttackEvent }) {
  const tierColor = TIER_COLORS[ev.tier] ?? '#475569'
  const typeColor = TYPE_COLORS[ev.attack_type] ?? '#0F172A'
  const ts = new Date(ev.timestamp).toISOString().slice(11, 19)

  return (
    <motion.div
      layout
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mb-3 last:mb-0"
      style={{
        borderLeft: `2px solid ${tierColor}40`,
        paddingLeft: 12,
      }}
    >
      {/* Header line */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="font-mono text-xs" style={{ color: '#10B981' }}>
          [{ts}]
        </span>
        <TierBadgeInline tier={ev.tier} />
        <span className="font-mono text-xs font-bold" style={{ color: typeColor }}>
          {ev.attack_type}
        </span>
        <span className="font-mono text-xs text-ink-3">
          {ev.tier === 'HIGH'   ? '→ auto-deployed' :
           ev.tier === 'MEDIUM' ? '→ awaiting review' :
                                  '→ manual analysis'}
        </span>
        <span className="font-mono text-xs text-ink-3">
          conf=<span style={{ color: tierColor }}>{(ev.confidence * 100).toFixed(0)}%</span>
        </span>
      </div>

      {/* iptables rule */}
      {ev.tier !== 'LOW' && ev.iptables_rule && (
        <div className="font-mono text-xs mb-0.5">
          <span className="text-neon-blue">$ iptables: </span>
          <span className="text-ink-1 break-all">{ev.iptables_rule}</span>
        </div>
      )}

      {/* openflow rule (HIGH only) */}
      {ev.tier === 'HIGH' && ev.openflow_rule && (
        <div className="font-mono text-xs mb-0.5">
          <span className="text-neon-purple">$ openflow: </span>
          <span className="text-ink-1 break-all">{ev.openflow_rule}</span>
        </div>
      )}

      {/* LOW confidence: blocked, manual review */}
      {ev.tier === 'LOW' && (
        <div className="font-mono text-xs">
          <span className="text-ink-3"># BLOCKED — </span>
          <span className="text-neon-red">manual review required</span>
          <span className="text-ink-3"> (confidence too low: {(ev.confidence * 100).toFixed(0)}%)</span>
        </div>
      )}
    </motion.div>
  )
}

export function DefenceRules() {
  const attacks = useStore((s) => s.attacks)
  const shown = attacks.slice(0, 8)

  return (
    <div
      className="glass flex flex-col"
      style={{ maxHeight: 260, background: '#F8FAFC' }}
    >
      {/* Terminal title bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
        style={{
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          background: 'rgba(255,255,255,0.6)',
          borderRadius: '12px 12px 0 0',
        }}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5 mr-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#EF4444' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F59E0B' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#10B981' }} />
        </div>
        <Terminal size={12} className="text-ink-3" />
        <span className="mono-label">Defence Rule Engine</span>
        <span className="ml-auto mono-label text-ink-4">
          CA-xNIDS confidence-gated output
        </span>
      </div>

      {/* Terminal body */}
      <div
        className="overflow-auto flex-1 p-4 font-mono"
        style={{ background: '#F8FAFC' }}
      >
        {/* Prompt prefix */}
        <div className="flex items-center gap-1 mb-3">
          <span className="text-neon-green text-xs">ca-xnids</span>
          <span className="text-ink-3 text-xs">@soc-engine</span>
          <span className="text-ink-1 text-xs">:~$</span>
          <span className="text-ink-2 text-xs ml-1">tail -f /var/log/defence-rules.log</span>
        </div>

        {/* Rule blocks */}
        <AnimatePresence initial={false}>
          {shown.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs"
            >
              <span className="text-ink-3">$ </span>
              <span className="text-ink-2">Monitoring network traffic…</span>
              <span
                className="text-neon-green ml-1"
                style={{ animation: 'pulse-dot 1s ease-in-out infinite' }}
              >
                ▋
              </span>
            </motion.div>
          ) : (
            shown.map((ev) => <RuleBlock key={ev.packet_id} ev={ev} />)
          )}
        </AnimatePresence>

        {/* Blinking cursor */}
        {shown.length > 0 && (
          <div className="text-xs mt-2">
            <span className="text-ink-3">$ </span>
            <span
              className="text-neon-green"
              style={{ animation: 'pulse-dot 1s ease-in-out infinite' }}
            >
              ▋
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
