import type { VerificationTiming } from './types'
import { randomUUID } from 'node:crypto'
import { recordE2ETiming } from './timing'

/** 保留原 aggregate 与共享会话，按现有 describe 组记录 case 耗时。 */
export function createCaseTimingRecorder(sink = recordE2ETiming) {
  const started = new Map<string, { name: string, group: string, startedAt: string, clock: number }>()
  const groups = new Map<string, VerificationTiming>()
  const complete = (id: string, status: VerificationTiming['status']) => {
    const value = started.get(id)
    if (!value) {
      return
    }
    started.delete(id)
    const timing: VerificationTiming = {
      name: `case:${value.name}`,
      group: value.group,
      invocationId: randomUUID(),
      startedAt: value.startedAt,
      durationMs: Math.max(0, performance.now() - value.clock),
      status,
    }
    sink(timing)
    const group = groups.get(value.group) ?? { ...timing, name: `case-group:${value.group}`, durationMs: 0, invocationId: randomUUID() }
    group.durationMs += timing.durationMs
    if (status === 'failed' || (status === 'cancelled' && group.status === 'passed')) {
      group.status = status
    }
    groups.set(value.group, group)
  }
  return {
    start(id: string, name: string) {
      if (started.has(id)) {
        throw new Error(`Duplicate case timing start: ${name}`)
      }
      started.set(id, { name, group: name.split(' > ')[0]!, startedAt: new Date().toISOString(), clock: performance.now() })
    },
    complete,
    finish() {
      for (const id of started.keys()) {
        complete(id, 'cancelled')
      }
      for (const timing of groups.values()) {
        sink(timing)
      }
      groups.clear()
    },
  }
}
