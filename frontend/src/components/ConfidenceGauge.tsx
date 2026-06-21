import { useStore } from '../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import type { Tier } from '../types'

/* ── Geometry helpers ─────────────────────────────────────────────────────── */
function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  if (Math.abs(endDeg - startDeg) < 0.01) return ''
  const s = polarToXY(cx, cy, r, startDeg)
  const e = polarToXY(cx, cy, r, endDeg)
  const lg = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${lg} 1 ${e.x} ${e.y}`
}

function arcLength(r: number, sweepDeg: number) {
  return (sweepDeg / 360) * 2 * Math.PI * r
}

/* ── Config ────────────────────────────────────────────────────────────────── */
const TIER_CONFIG: Record<Tier, {
  color: string
  gradId: string
  gradStart: string
  gradEnd: string
  bg: string
  badgeClass: string
}> = {
  HIGH: {
    color: '#10B981',
    gradId: 'gaugeGradHigh',
    gradStart: '#10B981',
    gradEnd: '#06B6D4',
    bg: 'rgba(16,185,129,0.04)',
    badgeClass: 'badge-high',
  },
  MEDIUM: {
    color: '#F59E0B',
    gradId: 'gaugeGradMed',
    gradStart: '#F59E0B',
    gradEnd: '#D97706',
    bg: 'rgba(245,158,11,0.04)',
    badgeClass: 'badge-medium',
  },
  LOW: {
    color: '#EF4444',
    gradId: 'gaugeGradLow',
    gradStart: '#EF4444',
    gradEnd: '#F87171',
    bg: 'rgba(239,68,68,0.04)',
    badgeClass: 'badge-low',
  },
}

const CX = 100
const CY = 90
const R_TRACK = 68
const R_OUTER = 80
const R_TICK_IN = 74
const R_TICK_OUT = 78
const START_DEG = -150
const END_DEG = -30
const SWEEP = END_DEG - START_DEG + 360  // 240 degrees
const FULL_ARC = arcLength(R_TRACK, SWEEP)

function AnimatedArc({
  confidence,

  gradId,
}: {
  confidence: number
  color: string
  gradId: string
}) {
  const [dashoffset, setDashoffset] = useState(FULL_ARC)

  useEffect(() => {
    const target = FULL_ARC * (1 - confidence)
    setDashoffset(target)
  }, [confidence])

  // Full circle path for stroke-dasharray trick — use the same arc as track
  const fullPath = arcPath(CX, CY, R_TRACK, START_DEG, START_DEG + SWEEP)

  return (
    <motion.path
      d={fullPath}
      fill="none"
      stroke={`url(#${gradId})`}
      strokeWidth={16}
      strokeLinecap="round"
      strokeDasharray={FULL_ARC}
      animate={{ strokeDashoffset: dashoffset }}
      transition={{ type: 'spring', stiffness: 60, damping: 18 }}
    />
  )
}

export function ConfidenceGauge() {
  const latest = useStore((s) => s.latestAttack)
  const conf = latest?.confidence ?? 0
  const tier = (latest?.tier ?? 'LOW') as Tier

  const cfg = TIER_CONFIG[tier]
  const hasData = latest !== null

  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div
      className="glass h-full flex flex-col"
      style={{ background: hasData ? cfg.bg : 'rgba(255,255,255,0.75)' }}
    >
      <div className="p-4 flex flex-col items-center h-full">
        {/* Title */}
        <div className="w-full flex items-center justify-between mb-2 flex-shrink-0">
          <span className="mono-label">CA-xNIDS Confidence</span>
          {hasData && (
            <span className={`badge ${cfg.badgeClass}`}>{tier}</span>
          )}
        </div>

        {/* SVG Gauge */}
        <div className="flex-1 flex items-center justify-center w-full">
          <svg viewBox="0 0 200 160" style={{ width: '100%', maxWidth: 220 }}>
            <defs>
              {/* Gradient for each tier */}
              {Object.entries(TIER_CONFIG).map(([t, c]) => (
                <linearGradient key={t} id={c.gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={c.gradStart} />
                  <stop offset="100%" stopColor={c.gradEnd} />
                </linearGradient>
              ))}

              {/* Glow filter */}
              <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer dashed ring */}
            <circle
              cx={CX} cy={CY} r={R_OUTER}
              fill="none"
              stroke="rgba(15,23,42,0.05)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />

            {/* Tick marks */}
            {ticks.map((v) => {
              const angleDeg = START_DEG + SWEEP * v
              const inner = polarToXY(CX, CY, R_TICK_IN, angleDeg)
              const outer = polarToXY(CX, CY, R_TICK_OUT, angleDeg)
              return (
                <line
                  key={v}
                  x1={inner.x} y1={inner.y}
                  x2={outer.x} y2={outer.y}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              )
            })}

            {/* Track arc */}
            <path
              d={arcPath(CX, CY, R_TRACK, START_DEG, START_DEG + SWEEP)}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={16}
              strokeLinecap="round"
            />

            {/* Animated filled arc */}
            {hasData && (
              <g filter="url(#gaugeGlow)">
                <AnimatedArc
                  confidence={conf}
                  color={cfg.color}
                  gradId={cfg.gradId}
                />
              </g>
            )}

            {/* Center: percentage */}
            <AnimatePresence mode="wait">
              {hasData ? (
                <motion.g
                  key={`conf-${Math.round(conf * 100)}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <text
                    x={CX} y={CY - 8}
                    textAnchor="middle"
                    fill={cfg.color}
                    fontSize={32}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                    filter="url(#gaugeGlow)"
                  >
                    {(conf * 100).toFixed(0)}
                  </text>
                  <text
                    x={CX} y={CY + 10}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize={9}
                    fontFamily="JetBrains Mono, monospace"
                    letterSpacing={2}
                  >
                    CONF %
                  </text>
                </motion.g>
              ) : (
                <motion.g key="no-data" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <text
                    x={CX} y={CY - 4}
                    textAnchor="middle"
                    fill="#334155"
                    fontSize={28}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    —
                  </text>
                  <text
                    x={CX} y={CY + 12}
                    textAnchor="middle"
                    fill="#334155"
                    fontSize={9}
                    fontFamily="JetBrains Mono, monospace"
                    letterSpacing={2}
                  >
                    AWAITING
                  </text>
                </motion.g>
              )}
            </AnimatePresence>

            {/* Tick labels */}
            {ticks.map((v) => {
              const angleDeg = START_DEG + SWEEP * v
              const pos = polarToXY(CX, CY, R_TICK_OUT + 8, angleDeg)
              return (
                <text
                  key={v}
                  x={pos.x} y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#334155"
                  fontSize={7}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {(v * 100).toFixed(0)}
                </text>
              )
            })}
          </svg>
        </div>

        {/* Tier breakdown table */}
        <div className="w-full space-y-1 flex-shrink-0">
          {([
            ['HIGH',   '≥ 75%', 'Auto-deploy rule',   '#10B981'],
            ['MEDIUM', '≥ 50%', 'Operator review',    '#F59E0B'],
            ['LOW',    '< 50%', 'Manual analysis',    '#EF4444'],
          ] as const).map(([t, thresh, action, color]) => (
            <div
              key={t}
              className="flex items-center justify-between px-2 py-1 rounded transition-all duration-300"
              style={{
                background: (hasData && tier === t) ? 'rgba(15,23,42,0.04)' : 'transparent',
                opacity: (hasData && tier !== t) ? 0.35 : 1,
              }}
            >
              <span
                className="font-mono text-xs font-bold w-14"
                style={{ color }}
              >
                {t}
              </span>
              <span className="font-mono text-xs text-ink-3 w-10">{thresh}</span>
              <span className="text-xs text-ink-3 font-mono">{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
