import { KPICards }          from '../components/KPICards'
import { LiveTrafficChart }  from '../components/LiveTrafficChart'
import { FeatureImportance } from '../components/FeatureImportance'
import { ConfidenceGauge }   from '../components/ConfidenceGauge'
import { AttackTypeChart }   from '../components/AttackTypeChart'
import { AttackLog }         from '../components/AttackLog'
import { DefenceRules }      from '../components/DefenceRules'

export function DashboardPage() {
  return (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-ink-0 mb-0.5">Dashboard</h1>
        <p className="text-sm text-ink-2">Overview of detection performance, explanations, and defence rules.</p>
      </div>

      <KPICards />

      <div className="grid gap-4" style={{ gridTemplateColumns: '65fr 35fr', minHeight: 220 }}>
        <LiveTrafficChart />
        <ConfidenceGauge />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '55fr 45fr', minHeight: 260 }}>
        <FeatureImportance />
        <AttackTypeChart />
      </div>

      <AttackLog />
      <DefenceRules />
    </div>
  )
}
