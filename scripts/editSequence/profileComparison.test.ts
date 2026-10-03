import { expect, it } from 'vitest'
import { compareSequenceProfilePairs, compareSequenceProfiles } from './profileComparison'

function report(profileEnabled: boolean, elapsedMs: number, runIndex = profileEnabled ? 1 : 0): Parameters<typeof compareSequenceProfiles>[0] {
  const runOrigin = Date.UTC(2026, 0, 1) + runIndex * 10_000
  const workerOrigin = runOrigin + 100
  return {
    run: { id: `run-${runIndex}`, clock: { timeOrigin: runOrigin, startedAtMs: 0, endedAtMs: 9000 } },
    engine: 'weapp-stateful',
    candidate: { clean: true, revision: 'candidate' },
    profileEnabled,
    report: [{ name: 'sequence', inputSha256: 'input', status: 'passed', childrenAfterClose: 0, profile: {
      samples: profileEnabled ? Array.from({ length: 14 }, (_, index) => ({ schemaVersion: 1, status: 'complete', totalMs: 1, clock: { timeOrigin: workerOrigin, durations: 'performance.now', timestamp: 'UTC' }, sourceEvents: [{ eventId: `update-${index}`, file: '<fixture>/src/page.vue', receivedAtMs: (index + 1) * 200 + 1 }] })) : [],
      coverage: { compatible: profileEnabled ? 14 : 0, legacy: 0, incompatible: 0, incomplete: 0, invalid: 0 },
      skippedLineCount: 0,
      rawLines: [],
    }, steps: Array.from({ length: 15 }, (_, step) => ({
      step,
      label: `step-${step}`,
      status: 'passed',
      observationSha256: `semantics-${step}`,
      measurement: { elapsedMs, clock: { timeOrigin: workerOrigin, startedAtMs: step * 200, endedAtMs: step * 200 + elapsedMs }, process: { memory: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 }, resources: {}, processListeners: {} } },
    })) }],
  }
}

it('reports measured overhead only after semantic and cleanup equivalence', () => {
  expect(compareSequenceProfiles(report(false, 100), report(true, 110), 20)[0]).toMatchObject({ disabledMs: 100, enabledMs: 110, status: 'passed', sampleCount: 12 })
  expect(compareSequenceProfiles(report(false, 100), report(true, 130), 20)[0]!.status).toBe('over-budget')
  const changed = report(true, 90)
  changed.report[0]!.steps[4]!.observationSha256 = 'different'
  expect(() => compareSequenceProfiles(report(false, 100), changed, 20)).toThrow('semantics')
})

it('rejects an enabled flag without successful source-correlated profile events', () => {
  const enabled = report(true, 90)
  enabled.report[0]!.profile!.samples = []
  expect(() => compareSequenceProfiles(report(false, 100), enabled, 5)).toThrow('actual successful JSONL events')
  const disabled = report(false, 100)
  disabled.report[0]!.profile = report(true, 100).report[0]!.profile
  expect(() => compareSequenceProfiles(disabled, report(true, 100), 5)).toThrow('actual successful JSONL events')
})

it('rejects a missing edit, duplicate event or incomplete profile', () => {
  const missing = report(true, 100)
  missing.report[0]!.profile!.samples.pop()
  expect(() => compareSequenceProfiles(report(false, 100), missing, 5)).toThrow('no completed source event for edit')
  const duplicate = report(true, 100)
  duplicate.report[0]!.profile!.samples.push(duplicate.report[0]!.profile!.samples[0]!)
  expect(() => compareSequenceProfiles(report(false, 100), duplicate, 5)).toThrow('duplicate source events')
  const incomplete = report(true, 100)
  incomplete.report[0]!.profile!.coverage.incomplete = 1
  expect(() => compareSequenceProfiles(report(false, 100), incomplete, 5)).toThrow('actual successful JSONL events')
})

it('aggregates independent run pairs without accepting mismatched candidate inputs', () => {
  const pairs = [{ disabled: report(false, 100), enabled: report(true, 104) }, { disabled: report(false, 100, 3), enabled: report(true, 106, 2) }]
  expect(compareSequenceProfilePairs(pairs, 6)[0]).toMatchObject({ runPairs: 2, samplesPerRun: 12, status: 'passed' })
  expect(() => compareSequenceProfilePairs(pairs.slice(0, 1), 6)).toThrow('two independent')
  pairs[1]!.disabled.report[0]!.inputSha256 = 'different'
  pairs[1]!.enabled.report[0]!.inputSha256 = 'different'
  expect(() => compareSequenceProfilePairs(pairs, 6)).toThrow('same candidate, engine and inputs')
})

it('rejects repeated evidence and forward-only pairs instead of declaring independent AB/BA runs', () => {
  const first = { disabled: report(false, 100), enabled: report(true, 104) }
  expect(() => compareSequenceProfilePairs([first, first], 6)).toThrow('unique run identities')
  const forwardOnly = { disabled: report(false, 100, 2), enabled: report(true, 104, 3) }
  expect(() => compareSequenceProfilePairs([first, forwardOnly], 6)).toThrow('counterbalanced AB/BA')
  const backwardsWorker = { disabled: report(false, 100, 3), enabled: report(true, 104, 2) }
  backwardsWorker.enabled.report[0]!.steps[1]!.measurement!.clock!.timeOrigin = first.enabled.report[0]!.steps[1]!.measurement!.clock!.timeOrigin
  expect(() => compareSequenceProfilePairs([first, backwardsWorker], 6)).toThrow('recorded run interval')
})

it('rejects missing clocks, overlapping runs and workers whose observations exceed their run', () => {
  const pairs = [{ disabled: report(false, 100), enabled: report(true, 104) }, { disabled: report(false, 100, 3), enabled: report(true, 104, 2) }]
  const overlap = structuredClone(pairs)
  overlap[0]!.enabled.run.clock.timeOrigin -= 2000
  expect(() => compareSequenceProfilePairs(overlap, 6)).toThrow('counterbalanced AB/BA')
  const missing = structuredClone(pairs)
  delete missing[0]!.disabled.report[0]!.steps[0]!.measurement!.clock
  expect(() => compareSequenceProfilePairs(missing, 6)).toThrow('worker clocks')
  const outside = structuredClone(pairs)
  outside[1]!.disabled.report[0]!.steps[14]!.measurement!.clock!.endedAtMs = 10_000
  expect(() => compareSequenceProfilePairs(outside, 6)).toThrow('recorded run interval')
})

it('rejects dirty candidates and missing timings instead of inventing low overhead', () => {
  const dirty = report(true, 90)
  dirty.candidate.clean = false
  expect(() => compareSequenceProfiles(report(false, 100), dirty, 20)).toThrow('clean candidates')
  const missing = report(true, 90)
  missing.report[0]!.steps[4]!.measurement!.elapsedMs = Number.NaN
  expect(() => compareSequenceProfiles(report(false, 100), missing, 20)).toThrow('missing timing')
})
