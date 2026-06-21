import { useStore } from '../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import type { Feature } from '../types'

const GROUP_CONFIG: Record<string, { color: string; label: string; gradStart: string; gradEnd: string }> = {
  basic:        { color: '#3B82F6', label: 'basic',        gradStart: '#3B82F6', gradEnd: '#6366F1' },
  content:      { color: '#8B5CF6', label: 'content',      gradStart: '#8B5CF6', gradEnd: '#C4B5FD' },
  time_traffic: { color: '#F59E0B', label: 'time/traffic', gradStart: '#F59E0B', gradEnd: '#D97706' },
  host_traffic: { color: '#10B981', label: 'host/traffic', gradStart: '#10B981', gradEnd: '#06B6D4' },
}

const TYPE_COLORS: Record<string, string> = {
  DoS:   '#EF4444',
  Probe: '#F59E0B',
  R2L:   '#8B5CF6',
  U2R:   '#3B82F6',
}

interface BarRowProps {
  feature: Feature
  rank: number
  maxImportance: number
}

function BarRow({ feature, rank, maxImportance }: BarRowProps) {
  const cfg = GROUP_CONFIG[feature.group] ?? { color: '#64748b', gradStart: '#64748b', gradEnd: '#475569', label: 'other' }
  const pct = maxImportance > 0 ? (feature.importance / maxImportance) * 100 : 0
  const stdPct = maxImportance > 0 ? ((feature.importance + feature.std) / maxImportance) * 100 : 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.04 }}
      className="flex items-center gap-3"
    >
      {/* Rank */}
      <span className="mono-label w-4 text-right text-ink-4 flex-shrink-0">
        {rank + 1}
      </span>

      {/* Feature name */}
      <span
        className="font-mono text-xs text-ink-1 truncate flex-shrink-0"
        style={{ width: 130 }}
        title={feature.name}
      >
        {feature.name}
      </span>

      {/* Bar track */}
      <div className="flex-1 relative" style={{ height: 6 }}>
        {/* Std deviation overlay */}
        <motion.div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            background: `${cfg.color}20`,
            maxWidth: `${Math.min(stdPct, 100)}%`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(stdPct, 100)}%` }}
          transition={{ duration: 0.6, delay: rank * 0.04 + 0.1, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Main importance bar */}
        <motion.div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${cfg.gradStart}, ${cfg.gradEnd}30)`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: rank * 0.04, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Track */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: '#F1F5F9', zIndex: -1 }}
        />
      </div>

      {/* Percentage */}
      <span
        className="font-mono text-xs flex-shrink-0 text-right"
        style={{ width: 36, color: cfg.color }}
      >
        {(feature.importance * 100).toFixed(1)}%
      </span>

      {/* Group dot */}
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: cfg.color }}
      />
    </motion.div>
  )
}

function SkeletonRow({ i }: { i: number }) {
  return (
    <div className="flex items-center gap-3" style={{ opacity: 0.15 + i * 0.05 }}>
      <span className="mono-label w-4 text-right text-ink-4">{i + 1}</span>
      <div className="h-2 rounded flex-shrink-0" style={{ width: 130, background: '#F1F5F9' }} />
      <div className="flex-1 h-1.5 rounded-full" style={{ background: '#F1F5F9' }} />
      <div className="h-2 rounded" style={{ width: 36, background: '#F1F5F9' }} />
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F1F5F9' }} />
    </div>
  )
}

export function FeatureImportance() {
  const latest = useStore((s) => s.latestAttack)

  const data: Feature[] = latest?.features
    ? [...latest.features].sort((a, b) => b.importance - a.importance).slice(0, 8)
    : []

  const maxImportance = data[0]?.importance ?? 1
  const attackColor = latest ? (TYPE_COLORS[latest.attack_type] ?? '#0F172A') : '#475569'

  return (
    <div
      className="glass h-full flex flex-col p-4 relative"
      style={{ background: 'rgba(255,255,255,0.75)' }}
    >
      {/* Title row */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <span className="mono-label">Feature Attribution</span>
        <div className="flex items-center gap-2">
          {latest && (
            <span
              className="badge"
              style={{
                color: attackColor,
                background: `${attackColor}15`,
                border: `1px solid ${attackColor}30`,
              }}
            >
              {latest.attack_type}
            </span>
          )}
          {latest && (
            <span className="mono-label">pkt #{latest.packet_id}</span>
          )}
        </div>
      </div>

      {/* Group legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 flex-shrink-0">
        {Object.entries(GROUP_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: cfg.color }}
            />
            <span className="mono-label" style={{ color: cfg.color }}>{cfg.label}</span>
          </span>
        ))}
      </div>

      {/* Bars */}
      <div className="flex-1 flex flex-col justify-center gap-2.5">
        <AnimatePresence mode="popLayout">
          {data.length > 0
            ? data.map((f, i) => (
                <BarRow
                  key={f.name}
                  feature={f}
                  rank={i}
                  maxImportance={maxImportance}
                />
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} i={i} />
              ))
          }
        </AnimatePresence>
      </div>

      {/* No data overlay */}
      {!latest && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <span className="text-2xl opacity-10">〰</span>
          <p className="mono-label text-center" style={{ opacity: 0.3 }}>
            Awaiting attack detection…
          </p>
        </div>
      )}
    </div>
  )
}
