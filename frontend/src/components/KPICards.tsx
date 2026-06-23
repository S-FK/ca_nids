import { Activity, AlertTriangle, CheckCircle, Clock, Eye, TrendingUp } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useRef, useEffect, useState } from 'react'
import { motion, animate } from 'framer-motion'

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    if (value === prevRef.current) return
    const from = prevRef.current
    const to = value
    prevRef.current = value

    const controls = animate(from, to, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [value])

  return <>{display.toLocaleString()}</>
}

interface CardConfig {
  icon: React.ReactNode
  label: string
  sublabel: string
  value: number
  gradClass: string
  accentClass: string
  glowClass?: string
  iconBg: string
  iconColor: string
}

function KPICard({
  icon, label, sublabel, value,
  gradClass, accentClass, glowClass,
  iconBg, iconColor,
}: CardConfig) {
  const prevRef = useRef(-1)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (prevRef.current !== -1 && value > prevRef.current) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 800)
      return () => clearTimeout(t)
    }
    prevRef.current = value
  }, [value])

  return (
    <motion.div
      layout
      className={`glass ${accentClass} relative overflow-hidden p-4 flex flex-col gap-3 ${pulse && glowClass ? glowClass : ''}`}
      animate={pulse ? { scale: [1, 1.015, 1] } : { scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Shimmer sweep on pulse */}
      {pulse && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(var(--ink-rgb),0.06) 50%, transparent 60%)',
          }}
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
      )}

      {/* Top row: icon + trend */}
      <div className="flex items-center justify-between">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp size={10} className="opacity-40" style={{ color: iconColor }} />
          <span className="mono-label" style={{ color: iconColor, opacity: 0.5 }}>
            +{value > 0 ? '1' : '0'}
          </span>
        </div>
      </div>

      {/* Big number */}
      <div>
        <div className={`text-4xl font-bold font-mono leading-none tracking-tight ${gradClass}`}>
          <AnimatedNumber value={value} />
        </div>
        <div className="mono-label mt-2">{label}</div>
        <div className="text-ink-3 text-xs font-mono mt-0.5">{sublabel}</div>
      </div>
    </motion.div>
  )
}

export function KPICards() {
  const { totalPackets, totalAttacks, autoDeployed, needsReview, manualOnly } = useStore()

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <KPICard
        icon={<Activity size={16} />}
        label="Packets Analysed"
        sublabel="network stream"
        value={totalPackets}
        gradClass="grad-blue"
        accentClass="card-accent-blue"
        iconBg="rgba(59,130,246,0.1)"
        iconColor="#3B82F6"
      />
      <KPICard
        icon={<AlertTriangle size={16} />}
        label="Attacks Detected"
        sublabel="all tiers"
        value={totalAttacks}
        gradClass="grad-red"
        accentClass="card-accent-red"
        glowClass="glow-red"
        iconBg="rgba(239,68,68,0.1)"
        iconColor="#EF4444"
      />
      <KPICard
        icon={<CheckCircle size={16} />}
        label="Rules Deployed"
        sublabel="HIGH confidence"
        value={autoDeployed}
        gradClass="grad-green"
        accentClass="card-accent-green"
        glowClass="glow-green"
        iconBg="rgba(16,185,129,0.1)"
        iconColor="#10B981"
      />
      <KPICard
        icon={<Eye size={16} />}
        label="Awaiting Review"
        sublabel="MEDIUM confidence"
        value={needsReview}
        gradClass="grad-amber"
        accentClass="card-accent-amber"
        glowClass="glow-amber"
        iconBg="rgba(245,158,11,0.1)"
        iconColor="#F59E0B"
      />
      <KPICard
        icon={<Clock size={16} />}
        label="Manual Analysis"
        sublabel="LOW confidence"
        value={manualOnly}
        gradClass="grad-purple"
        accentClass="card-accent-purple"
        glowClass="glow-purple"
        iconBg="rgba(139,92,246,0.1)"
        iconColor="#8B5CF6"
      />
    </div>
  )
}
