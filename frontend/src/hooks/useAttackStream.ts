import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import type { AttackEvent } from '../types'
import type { PacketEntry } from '../store/useStore'

const WS_URL = `ws://${window.location.host}/ws`

export function useAttackStream() {
  const ws  = useRef<WebSocket | null>(null)
  const {
    setConnected, setPipelineStatus, setSimRunning,
    setPacketsPerSec, addPacket, addAttack,
  } = useStore()

  // Packet-rate counter
  const countRef  = useRef(0)
  const rateTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    rateTimer.current = setInterval(() => {
      setPacketsPerSec(countRef.current)
      countRef.current = 0
    }, 1000)
    return () => clearInterval(rateTimer.current)
  }, [])

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      const socket = new WebSocket(WS_URL)
      ws.current   = socket

      socket.onopen = () => {
        setConnected(true)
        setPipelineStatus('connected')
      }

      socket.onmessage = (ev) => {
        const data = JSON.parse(ev.data as string)

        if (data.type === 'status') {
          setPipelineStatus(data.status as string)
          setSimRunning(data.status !== "stopped")
          return
        }

        if (data.type === 'packet' || data.type === 'attack') {
          countRef.current++
          const entry: PacketEntry = {
            packet_id:       data.packet_id,
            timestamp:       data.timestamp,
            prob:            data.prob ?? 0,
            is_attack:       data.is_attack ?? false,
            attack_type:     data.attack_type,
            confidence:      data.confidence,
            tier:            data.tier,
            features:        data.features,
            group_importance:data.group_importance,
            iptables_rule:   data.iptables_rule,
            openflow_rule:   data.openflow_rule,
            scope:           data.scope,
            source:          data.source,
            raw_features:    data.raw_features,
          }
          addPacket(entry)
        }

        if (data.type === 'attack') {
          addAttack(data as AttackEvent)
        }
      }

      socket.onclose = () => {
        setConnected(false)
        setPipelineStatus('reconnecting')
        reconnectTimer = setTimeout(connect, 2500)
      }

      socket.onerror = () => socket.close()
    }

    connect()
    return () => {
      clearTimeout(reconnectTimer)
      ws.current?.close()
    }
  }, [])
}
