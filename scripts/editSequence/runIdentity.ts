import type { SequenceStepResult } from './measurement'
import { randomUUID } from 'node:crypto'

export interface SequenceRunIdentity {
  id: string
  clock: { timeOrigin: number, startedAtMs: number, endedAtMs: number }
}

/** 单次命令生成独立身份；时间窗口覆盖 worker 启动、运行、取证和清理。 */
export function beginSequenceRun(): SequenceRunIdentity {
  return { id: randomUUID(), clock: { timeOrigin: performance.timeOrigin, startedAtMs: performance.now(), endedAtMs: Number.NaN } }
}

function interval(clock: SequenceRunIdentity['clock']) {
  if (![clock.timeOrigin, clock.startedAtMs, clock.endedAtMs].every(Number.isFinite)
    || clock.timeOrigin <= 0 || clock.startedAtMs < 0 || clock.endedAtMs < clock.startedAtMs) {
    throw new Error('Profile comparison requires complete finite run and worker clock intervals')
  }
  return { started: clock.timeOrigin + clock.startedAtMs, ended: clock.timeOrigin + clock.endedAtMs }
}

interface RecordedRun {
  run: SequenceRunIdentity
  report: Array<{ steps: SequenceStepResult[] }>
}

/** 独立运行必须具有唯一身份和 worker，且实际时间证明按 AB/BA 串行采集。 */
export function assertIndependentSequenceRuns(pairs: Array<{ disabled: RecordedRun, enabled: RecordedRun }>) {
  const ids = new Set<string>()
  const origins = new Set<number>()
  let previousEnd = -Infinity
  for (const [index, pair] of pairs.entries()) {
    const ordered = index % 2 ? [pair.enabled, pair.disabled] : [pair.disabled, pair.enabled]
    for (const report of ordered) {
      if (!report.run?.id || ids.has(report.run.id)) {
        throw new Error('Profile pairs require unique run identities; repeated reports are not independent')
      }
      ids.add(report.run.id)
      const bounds = interval(report.run.clock)
      if (bounds.started < previousEnd) {
        throw new Error('Profile pairs require serial counterbalanced AB/BA collection order')
      }
      previousEnd = bounds.ended
      const runOrigins = new Set<number>()
      for (const sequence of report.report) {
        const sequenceOrigins = new Set<number>()
        for (const step of sequence.steps) {
          if (!step.measurement?.clock) {
            throw new Error('Profile pairs require actual worker clocks for every observation')
          }
          const clock = step.measurement.clock
          const observed = interval(clock)
          if (clock.timeOrigin < bounds.started || observed.started < bounds.started || observed.ended > bounds.ended) {
            throw new Error('Profile worker observations must belong to their recorded run interval')
          }
          sequenceOrigins.add(clock.timeOrigin)
          runOrigins.add(clock.timeOrigin)
        }
        if (sequenceOrigins.size !== 1) {
          throw new Error('Profile sequence requires one persistent incremental worker')
        }
      }
      for (const origin of runOrigins) {
        if (origins.has(origin)) {
          throw new Error('Profile pairs require distinct worker time origins for independent runs')
        }
        origins.add(origin)
      }
    }
  }
}
