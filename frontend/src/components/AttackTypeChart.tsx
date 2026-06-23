import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useStore } from '../store/useStore'
import { motion } from 'framer-motion'

const TYPE_CONFIG: Record<string, {
  color: string
  bg: string
  desc: string
}> = {
  DoS:   { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   desc: 'Denial of Service' },
  Probe: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  desc: 'Network Reconnaissance' },
  R2L:   { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', desc: 'Remote to Local' },
  U2R:   { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  desc: 'User to Root' },
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const cfg = TYPE_CONFIG[d.name as keyof typeof TYPE_CONFIG]
  return (
    <div
      className="glass-bright px-3 py-2 text-xs font-mono shadow-xl"
    >
      <p className="font-bold mb-1" style={{ color: cfg?.color }}>{d.name}</p>
      <p className="text-ink-2">{cfg?.desc}</p>
      <p className="text-ink-0 mt-1">
        {d.value} attacks
        <span className="text-ink-3 ml-2">({d.pct}%)</span>
      </p>
    </div>
  )
}


export function AttackTypeChart() {
  const counts = useStore((s) => s.attackTypeCounts)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  const data = Object.entries(counts).map(([name, value]) => ({
    name,
    value,
    pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
  }))

  const hasData = total > 0

  return (
    <div
      className="glass h-full flex flex-col p-4 relative"
      style={{ background: 'var(--surface-card-translucent-2)' }}
    >
      {/* Title */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <span className="mono-label">Attack Taxonomy</span>
        {hasData && (
          <span className="mono-label">
            <span className="text-neon-red">{total}</span> total
          </span>
        )}
      </div>

      {/* Donut chart */}
      <div className="flex-1 min-h-0" style={{ minHeight: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasData ? data.filter((d) => d.value > 0) : [{ name: 'empty', value: 1, pct: '0' }]}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={hasData ? 4 : 0}
              dataKey="value"
              strokeWidth={0}
              isAnimationActive
            >
              {hasData
                ? data.filter((d) => d.value > 0).map((d) => (
                    <Cell
                      key={d.name}
                      fill={TYPE_CONFIG[d.name as keyof typeof TYPE_CONFIG]?.color ?? 'var(--text-secondary)'}
                    />
                  ))
                : <Cell fill="var(--surface-2)" />
              }
            </Pie>
            {hasData && <Tooltip content={<CustomTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* No data state */}
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div
              className="w-24 h-24 rounded-full border-4 mx-auto mb-3 flex items-center justify-center"
              style={{ borderColor: 'var(--surface-2)' }}
            >
              <span className="mono-label" style={{ opacity: 0.3 }}>—</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend with animated bars */}
      <div className="space-y-2 flex-shrink-0 mt-1">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
          const count = counts[type] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0

          return (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ background: cfg.color }}
              />
              <span
                className="font-mono text-xs font-bold flex-shrink-0"
                style={{ color: cfg.color, width: 36 }}
              >
                {type}
              </span>

              {/* Animated progress bar */}
              <div
                className="flex-1 rounded-full overflow-hidden"
                style={{ height: 4, background: 'var(--surface-2)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: cfg.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <span className="mono-label text-right flex-shrink-0" style={{ width: 36, color: 'var(--text-tertiary)' }}>
                {count > 0 ? `${pct.toFixed(0)}%` : '—'}
              </span>
              <span className="mono-label text-right flex-shrink-0" style={{ width: 16 }}>
                {count > 0 ? count : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
