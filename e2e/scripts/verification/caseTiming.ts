import type { TestDiagnostic } from 'vitest/node'
import type { VerificationTiming } from './types'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { recordE2ETiming } from './timing'

type CaseDiagnostic = Pick<TestDiagnostic, 'startTime' | 'duration'>

function validDiagnostic(value: CaseDiagnostic | undefined): value is CaseDiagnostic {
  return Boolean(value && Number.isFinite(new Date(value.startTime).getTime())
    && Number.isFinite(value.duration) && value.duration >= 0)
}

/** 完成用例使用 worker 实际计时；仅未完成取消用例使用 reporter 单调时钟兜底。 */
export function createCaseTimingRecorder(sink?: (timing: VerificationTiming) => void) {
  const started = new Map<string, { name: string, group: string, startedAt: string, clock: number }>()
  const groups = new Map<string, VerificationTiming>()
  const complete = (id: string, status: VerificationTiming['status'], diagnostic?: CaseDiagnostic) => {
    const value = started.get(id)
    if (!value) {
      return
    }
    started.delete(id)
    const observed = validDiagnostic(diagnostic) ? diagnostic : undefined
    if (!observed && status !== 'cancelled') {
      process.stderr.write(`[e2e-timing] Missing actual Vitest case diagnostic: ${value.name}\n`)
      return
    }
    const timing: VerificationTiming = {
      name: `case:${value.name}`,
      group: value.group,
      invocationId: randomUUID(),
      startedAt: observed ? new Date(observed.startTime).toISOString() : value.startedAt,
      durationMs: observed ? observed.duration : Math.max(0, performance.now() - value.clock),
      status,
    }
    recordE2ETiming(timing, sink)
    const group = groups.get(value.group) ?? { ...timing, name: `case-group:${value.group}`, durationMs: 0, invocationId: randomUUID() }
    group.durationMs += timing.durationMs
    if (Date.parse(timing.startedAt) < Date.parse(group.startedAt)) {
      group.startedAt = timing.startedAt
    }
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
        recordE2ETiming(timing, sink)
      }
      groups.clear()
    },
  }
}
