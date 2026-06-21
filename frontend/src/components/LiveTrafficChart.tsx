import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useStore } from '../store/useStore'

const THRESHOLD = 0.5

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div
      className="glass-bright px-3 py-2 text-xs font-mono shadow-xl"
      style={{ borderColor: 'rgba(15,23,42,0.12)' }}
    >
      <p className="text-ink-2 mb-1">pkt <span className="text-ink-1">#{d.id}</span></p>
      <p style={{ color: d.isAttack ? '#EF4444' : '#10B981' }}>
        {(d.prob * 100).toFixed(1)}% anomaly
      </p>
      {d.isAttack && <p className="text-neon-red mt-0.5">⚠ ATTACK</p>}
    </div>
  )
}

export function LiveTrafficChart() {
  const traffic = useStore((s) => s.traffic)
  const totalPackets = useStore((s) => s.totalPackets)

  const data = traffic.map((p) => ({
    id:       p.id,
    prob:     p.prob,
    isAttack: p.isAttack,
    attack:   p.isAttack ? p.prob : undefined,
    normal:   !p.isAttack ? p.prob : undefined,
  }))

  const attackMarkers = traffic
    .filter((p) => p.isAttack)
    .slice(-8)
    .map((p) => p.id)

  return (
    <div
      className="glass h-full flex flex-col p-4"
      style={{ background: 'rgba(255,255,255,0.75)' }}
    >
      {/* Title row */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="mono-label">Anomaly Probability Stream</span>
          {/* Legend */}
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-full"
                style={{ width: 20, height: 2, background: '#10B981' }}
              />
              <span className="mono-label" style={{ color: '#10B981' }}>Normal</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-full"
                style={{ width: 20, height: 2, background: '#EF4444' }}
              />
              <span className="mono-label" style={{ color: '#EF4444' }}>Attack</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block"
                style={{
                  width: 20, height: 1,
                  borderTop: '1px dashed #F59E0B',
                }}
              />
              <span className="mono-label" style={{ color: '#F59E0B' }}>Threshold</span>
            </span>
          </div>
        </div>
        <span className="mono-label">
          <span className="text-neon-blue">{totalPackets.toLocaleString()}</span>
          {' '}pkts
        </span>
      </div>

      {/* Chart area with shimmer */}
      <div className="flex-1 min-h-0 relative overflow-hidden" style={{ borderRadius: 8 }}>
        {/* Shimmer sweep pseudo-effect */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(105deg, transparent 45%, rgba(16,185,129,0.02) 50%, transparent 55%)',
            animation: 'sweep 4s ease-in-out infinite',
          }}
        />

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="lgNormal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#10B981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="lgAttack" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="#F1F5F9"
              strokeDasharray="none"
              vertical={false}
              horizontal={true}
            />

            <XAxis
              dataKey="id"
              hide
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{
                fill: '#475569',
                fontSize: 9,
                fontFamily: 'JetBrains Mono, monospace',
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              width={32}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(15,23,42,0.08)', strokeWidth: 1 }}
            />

            {/* Threshold line */}
            <ReferenceLine
              y={THRESHOLD}
              stroke="#F59E0B"
              strokeDasharray="6 4"
              strokeOpacity={0.5}
              strokeWidth={1}
            />

            {/* Attack vertical markers */}
            {attackMarkers.map((id) => (
              <ReferenceLine
                key={id}
                x={id}
                stroke="#EF4444"
                strokeOpacity={0.2}
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            ))}

            <Area
              type="monotone"
              dataKey="normal"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#lgNormal)"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="attack"
              stroke="#EF4444"
              strokeWidth={2}
              fill="url(#lgAttack)"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
