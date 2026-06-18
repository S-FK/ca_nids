export type Tier = 'HIGH' | 'MEDIUM' | 'LOW'
export type AttackType = 'DoS' | 'Probe' | 'R2L' | 'U2R'

export interface Feature {
  name: string
  importance: number
  std: number
  group: 'basic' | 'content' | 'time_traffic' | 'host_traffic'
}

export interface AttackEvent {
  packet_id: number
  timestamp: string
  prob: number
  attack_type: AttackType
  features: Feature[]
  group_importance: Record<string, number>
  confidence: number
  tier: Tier
  iptables_rule: string
  openflow_rule: string
  scope: string
  review_required: boolean
}

export interface TrafficPoint {
  id: number
  ts: number      // epoch ms
  prob: number
  isAttack: boolean
}

export interface StatusEvent {
  type: 'status'
  status: string
}
