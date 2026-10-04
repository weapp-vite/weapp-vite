import type { SequenceStepResult } from './measurement'
import type { readSequenceProfile } from './profileEvidence'
import type { SequenceRunIdentity } from './runIdentity'
import { assertIndependentSequenceRuns } from './runIdentity'

interface SequenceReport {
  run: SequenceRunIdentity
  engine: string
  candidate: { revision: string, clean: boolean }
  profileEnabled: boolean
  report: Array<{ name: string, inputSha256: string, status: string, steps: SequenceStepResult[], childrenAfterClose?: number, profile?: Awaited<ReturnType<typeof readSequenceProfile>> }>
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/** 开关对照必须来自同一干净提交、输入和逐步运行语义；不会用缺失样本得出零开销。 */
export function compareSequenceProfiles(disabled: SequenceReport, enabled: SequenceReport, maxOverheadPercent: number) {
  if (!Number.isFinite(maxOverheadPercent) || maxOverheadPercent < 0) {
    throw new Error('Profile comparison requires an explicit nonnegative overhead budget')
  }
  if (disabled.profileEnabled || !enabled.profileEnabled || disabled.engine !== enabled.engine
    || !disabled.candidate.clean || !enabled.candidate.clean || disabled.candidate.revision !== enabled.candidate.revision) {
    throw new Error('Profile comparison requires matching clean candidates with profiling off and on')
  }
  if (!disabled.report.length || disabled.report.length !== enabled.report.length) {
    throw new Error('Profile comparison requires matching complete sequences')
  }
  return disabled.report.map((before, index) => {
    const after = enabled.report[index]!
    if (!before.profile || !after.profile || before.profile.samples.length !== 0
      || before.profile.skippedLineCount !== 0 || after.profile.coverage.invalid !== 0
      || after.profile.coverage.incompatible !== 0
      || after.profile.coverage.incomplete !== 0 || after.profile.coverage.legacy !== 0
      || !after.profile.samples.some(sample => sample.schemaVersion === 1 && sample.status === 'complete' && sample.sourceEvents?.length)) {
      throw new Error(`Profile comparison requires actual successful JSONL events only in the enabled run: ${before.name}`)
    }
    const sourceEvents = new Set<string>()
    for (const sample of after.profile.samples) {
      for (const event of sample.sourceEvents ?? []) {
        if (sourceEvents.has(event.eventId)) {
          throw new Error(`Profile comparison has duplicate source events: ${before.name}`)
        }
        sourceEvents.add(event.eventId)
      }
    }
    for (const step of after.steps.slice(1)) {
      const clock = step.measurement?.clock
      if (!clock || !after.profile.samples.some(sample => sample.clock?.timeOrigin === clock.timeOrigin
        && sample.sourceEvents?.some(event => event.file?.startsWith('<fixture>/src/')
          && event.receivedAtMs >= clock.startedAtMs && event.receivedAtMs <= clock.endedAtMs))) {
        throw new Error(`Profile comparison has no completed source event for edit: ${before.name}/${step.step}`)
      }
    }
    if (before.name !== after.name || before.inputSha256 !== after.inputSha256 || before.status !== 'passed' || after.status !== 'passed'
      || before.childrenAfterClose !== 0 || after.childrenAfterClose !== 0 || before.steps.length !== after.steps.length || before.steps.length < 15) {
      throw new Error(`Profile comparison has incomplete input or cleanup: ${before.name}`)
    }
    const timings = [before, after].map(sequence => sequence.steps.slice(3).map((step) => {
      const elapsed = step.measurement?.elapsedMs
      if (step.status !== 'passed' || typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed <= 0) {
        throw new Error(`Profile comparison has missing timing: ${sequence.name}/${step.step}`)
      }
      return elapsed
    }))
    for (const [stepIndex, step] of before.steps.entries()) {
      const paired = after.steps[stepIndex]!
      if (step.step !== paired.step || step.label !== paired.label || !step.observationSha256 || step.observationSha256 !== paired.observationSha256) {
        throw new Error(`Profile changed observed build/runtime semantics: ${before.name}/${step.step}`)
      }
    }
    const disabledMs = median(timings[0]!)
    const enabledMs = median(timings[1]!)
    const overheadPercent = (enabledMs / disabledMs - 1) * 100
    return { name: before.name, sampleCount: timings[0]!.length, disabledMs, enabledMs, overheadPercent, maxOverheadPercent, status: overheadPercent <= maxOverheadPercent ? 'passed' : 'over-budget' }
  })
}

/** 两组以上独立运行按 AB/BA 采集，逐组保留数据后聚合配对比值。 */
export function compareSequenceProfilePairs(pairs: Array<{ disabled: SequenceReport, enabled: SequenceReport }>, maxOverheadPercent: number) {
  if (pairs.length < 2) {
    throw new Error('Profile overhead requires at least two independent counterbalanced run pairs')
  }
  assertIndependentSequenceRuns(pairs)
  const runs = pairs.map(pair => compareSequenceProfiles(pair.disabled, pair.enabled, maxOverheadPercent))
  const first = pairs[0]!.disabled
  for (const pair of pairs.slice(1)) {
    if (pair.disabled.candidate.revision !== first.candidate.revision || pair.disabled.engine !== first.engine
      || pair.disabled.report.length !== first.report.length
      || pair.disabled.report.some((sequence, index) => sequence.inputSha256 !== first.report[index]!.inputSha256)) {
      throw new Error('Profile pairs must share the same candidate, engine and inputs')
    }
  }
  return runs[0]!.map((sequence, index) => {
    const pairs = runs.map(run => run[index]!)
    const overheadPercent = median(pairs.map(pair => pair.overheadPercent))
    return { name: sequence.name, runPairs: pairs.length, samplesPerRun: sequence.sampleCount, pairs, overheadPercent, maxOverheadPercent, status: overheadPercent <= maxOverheadPercent ? 'passed' : 'over-budget' }
  })
}
