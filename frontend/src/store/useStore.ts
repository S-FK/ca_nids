import { create } from 'zustand'
import type { AttackEvent, TrafficPoint, Tier } from '../types'

const MAX_TRAFFIC  = 120
const MAX_ATTACKS  = 100
const MAX_PACKETS  = 150   // for detection page

export interface PacketEntry {
  packet_id: number
  timestamp: string
  prob: number
  is_attack: boolean
  attack_type?: string
  confidence?: number
  tier?: Tier
  features?: AttackEvent['features']
  group_importance?: Record<string, number>
  iptables_rule?: string
  openflow_rule?: string
  scope?: string
  source?: string
  raw_features?: Record<string, number>
}

export interface InjectionEntry {
  id: number
  timestamp: string
  label: string
  count: number
}

interface Store {
  // connection & pipeline
  connected:      boolean
  pipelineStatus: string
  simRunning:     boolean
  detectionMode:  'xnids' | 'ca_xnids'

  // counters
  totalPackets:     number
  totalAttacks:     number
  autoDeployed:     number
  needsReview:      number
  manualOnly:       number
  attackTypeCounts: Record<string, number>
  packetsPerSec:    number

  // live data
  traffic:     TrafficPoint[]
  attacks:     AttackEvent[]
  latestAttack: AttackEvent | null

  // detection page
  packets: PacketEntry[]

  // control page
  injectionLog: InjectionEntry[]
  injectionLogSeq: number

  // actions
  setConnected:      (v: boolean) => void
  setPipelineStatus: (s: string)  => void
  setSimRunning:     (v: boolean) => void
  setDetectionMode:  (m: 'xnids' | 'ca_xnids') => void
  setPacketsPerSec:  (n: number)  => void
  addPacket:  (ev: PacketEntry) => void
  addAttack:  (ev: AttackEvent) => void
  addInjectionLog: (label: string, count: number) => void
  reset: () => void
}

const initial = {
  connected:        false,
  pipelineStatus:   'connecting',
  simRunning:       false,
  detectionMode:    'ca_xnids' as 'xnids' | 'ca_xnids',
  totalPackets:     0,
  totalAttacks:     0,
  autoDeployed:     0,
  needsReview:      0,
  manualOnly:       0,
  attackTypeCounts: { DoS: 0, Probe: 0, R2L: 0, U2R: 0 },
  packetsPerSec:    0,
  traffic:          [] as TrafficPoint[],
  attacks:          [] as AttackEvent[],
  latestAttack:     null as AttackEvent | null,
  packets:          [] as PacketEntry[],
  injectionLog:     [] as InjectionEntry[],
  injectionLogSeq:  0,
}

export const useStore = create<Store>((set) => ({
  ...initial,

  setConnected:      (v) => set({ connected: v }),
  setPipelineStatus: (s) => set({ pipelineStatus: s }),
  setSimRunning:     (v) => set({ simRunning: v }),
  setDetectionMode:  (m) => set({ detectionMode: m }),
  setPacketsPerSec:  (n) => set({ packetsPerSec: n }),

  addPacket: (raw) =>
    set((s) => {
      const point: TrafficPoint = {
        id: raw.packet_id,
        ts: Date.now(),
        prob: raw.prob,
        isAttack: raw.is_attack,
      }
      const traffic = [...s.traffic, point].slice(-MAX_TRAFFIC)
      const packets = [raw, ...s.packets].slice(0, MAX_PACKETS)
      return {
        traffic,
        packets,
        totalPackets: s.totalPackets + 1,
      }
    }),

  addAttack: (ev) =>
    set((s) => {
      const tier: Tier     = ev.tier
      const autoDeployed   = s.autoDeployed + (tier === 'HIGH'   ? 1 : 0)
      const needsReview    = s.needsReview  + (tier === 'MEDIUM' ? 1 : 0)
      const manualOnly     = s.manualOnly   + (tier === 'LOW'    ? 1 : 0)
      const typeCounts     = { ...s.attackTypeCounts }
      if (ev.attack_type && typeCounts[ev.attack_type] !== undefined)
        typeCounts[ev.attack_type]++
      const attacks = [ev, ...s.attacks].slice(0, MAX_ATTACKS)
      return { totalAttacks: s.totalAttacks + 1, autoDeployed, needsReview, manualOnly, attackTypeCounts: typeCounts, attacks, latestAttack: ev }
    }),

  addInjectionLog: (label, count) =>
    set((s) => {
      const entry: InjectionEntry = {
        id:        s.injectionLogSeq + 1,
        timestamp: new Date().toISOString().slice(11, 19),
        label,
        count,
      }
      return {
        injectionLog:    [entry, ...s.injectionLog].slice(0, 30),
        injectionLogSeq: s.injectionLogSeq + 1,
      }
    }),

  reset: () => set(initial),
}))
