import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Terminal, Zap, Radio, Shield, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store/useStore'
import { clsx } from 'clsx'

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',      exact: true },
  { to: '/control',    icon: Terminal,        label: 'Control Center' },
  { to: '/attacks',    icon: Zap,             label: 'Attack Studio' },
  { to: '/detection',  icon: Radio,           label: 'Live Detection' },
  { to: '/threats',    icon: ShieldAlert,     label: 'Threat Log' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  )
  const { connected, simRunning, totalAttacks } = useStore()
  const attackBadge = totalAttacks > 0 ? (totalAttacks > 99 ? '99+' : String(totalAttacks)) : null

  const W = collapsed ? 64 : 220

  return (
    <aside
      className="flex flex-col flex-shrink-0 border-r border-[rgba(var(--ink-rgb),0.08)] transition-all duration-300"
      style={{ width: W, background: 'var(--surface-chrome)', backdropFilter: 'blur(20px)' }}
    >
      {/* Logo row */}
      <div
        className="flex items-center gap-3 px-4 border-b border-[rgba(var(--ink-rgb),0.08)]"
        style={{ height: 56, flexShrink: 0 }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <Shield size={15} className="text-neon-green" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm text-ink-0 leading-none">CA-xNIDS</p>
            <p className="mono-label mt-0.5">SOC Platform</p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative',
                isActive
                  ? 'bg-[rgba(16,185,129,0.08)] text-neon-green'
                  : 'text-ink-2 hover:text-ink-0 hover:bg-[rgba(var(--ink-rgb),0.05)]'
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full"
                    style={{ background: '#10B981', boxShadow: '0 0 6px #10B981' }}
                  />
                )}
                <Icon size={16} className={clsx('flex-shrink-0', isActive ? 'text-neon-green' : '')} />
                {!collapsed && (
                  <span className="text-sm font-medium flex-1">{label}</span>
                )}
                {/* Attack count badge on Threat Log */}
                {to === '/threats' && attackBadge && !collapsed && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    {attackBadge}
                  </span>
                )}
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-14 z-50 px-2 py-1 rounded text-xs font-medium pointer-events-none
                                  opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                    style={{ background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.12)', color: 'var(--text-primary)' }}>
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom status + collapse toggle */}
      <div className="p-3 border-t border-[rgba(var(--ink-rgb),0.08)] space-y-3">
        {/* Status indicators */}
        {!collapsed && (
          <div className="space-y-2 px-1">
            <div className="flex items-center justify-between">
              <span className="mono-label">WS</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: connected ? '#10B981' : '#EF4444',
                    boxShadow: connected ? '0 0 4px #10B981' : 'none',
                  }}
                />
                <span className="mono-label" style={{ color: connected ? '#10B981' : '#EF4444' }}>
                  {connected ? 'LIVE' : 'OFF'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="mono-label">SIM</span>
              <span className="mono-label" style={{ color: simRunning ? '#10B981' : 'var(--text-tertiary)' }}>
                {simRunning ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="mono-label">ATTACKS</span>
              <span className="mono-label" style={{ color: totalAttacks > 0 ? '#EF4444' : 'var(--text-tertiary)' }}>
                {totalAttacks}
              </span>
            </div>
          </div>
        )}

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                     text-ink-3 hover:text-ink-1 hover:bg-[rgba(var(--ink-rgb),0.05)]
                     transition-all duration-150 text-xs"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          {!collapsed && <span className="font-mono text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
