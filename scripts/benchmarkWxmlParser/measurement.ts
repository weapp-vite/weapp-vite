import type { Arm, Fixture, MeasurementError, MeasurementResult, Operation, Sample } from './types'
import { calibrateBatch, CALIBRATION_POLICY } from './calibration'
import { probeClock } from './clock'
import { cohorts } from './cohorts'
import { CORE_OPERATIONS } from './contracts'
import { summarize } from './statistics'
import { createWorkload } from './workload'

export { cohorts } from './cohorts'
export { assertIntegrity, assertPassed } from './integrity'
export { percentile, statistics, summarize } from './statistics'

export async function measure(
  operations: Operation[],
  fixtures: Fixture[],
  quick: boolean,
  checkpoint: (state: MeasurementResult) => Promise<void> = async () => {},
  expectedOperations: readonly string[] = CORE_OPERATIONS,
): Promise<MeasurementResult> {
  const manifest = createWorkload(operations, fixtures, quick, expectedOperations)
  const result: MeasurementResult = { manifest, clock: probeClock(), calibrationPolicy: CALIBRATION_POLICY, calibrations: [], samples: [], summaries: [], parity: [], errors: [] }
  await checkpoint(result)
  const rounds = manifest.rounds
  let sink: unknown
  for (const operation of operations) {
    const failedFixtures = new Set<string>()
    for (const fixture of fixtures) {
      for (const arm of ['baseline', 'candidate'] as const) {
        try {
          sink = operation.run(fixture, arm)
        }
        catch (error) {
          result.errors.push({ operation: operation.id, fixture: fixture.id, cohort: fixture.pressureId ?? fixture.cohort, arm, phase: 'preflight', error: String(error) })
          failedFixtures.add(fixture.id)
        }
      }
      if (operation.verify) {
        try {
          result.parity.push({ operation: operation.id, fixture: fixture.id, cohort: fixture.cohort, ...operation.verify(fixture) })
        }
        catch (error) {
          result.errors.push({ operation: operation.id, fixture: fixture.id, cohort: fixture.pressureId ?? fixture.cohort, arm: 'candidate', phase: 'parity', error: String(error) })
          failedFixtures.add(fixture.id)
        }
      }
    }
    for (const [cohort, files] of cohorts(fixtures)) {
      const runBatch = (arm: Arm, phase: MeasurementError['phase'], iterations: number, round = 0) => {
        let fixture = files[0]!
        let iteration = 0
        const started = performance.now()
        try {
          for (; iteration < iterations; iteration++) {
            for (fixture of files) {
              sink = operation.run(fixture, arm)
            }
          }
          return performance.now() - started
        }
        catch (error) {
          result.errors.push({ operation: operation.id, fixture: fixture.id, cohort, arm, phase, round, iteration, error: String(error) })
          return undefined
        }
      }
      let failed = files.some(file => failedFixtures.has(file.id))
      for (let warmup = 0; warmup < manifest.warmup && !failed; warmup++) {
        for (const arm of ['baseline', 'candidate'] as const) {
          if (runBatch(arm, 'warmup', 1, warmup) === undefined) {
            failed = true
            break
          }
        }
      }
      let iterations = 1
      if (!failed) {
        const before = result.errors.length
        const calibration = calibrateBatch((arm, count) => runBatch(arm, 'calibration', count), operation.comparable)
        result.calibrations!.push({ operation: operation.id, cohort, ...calibration })
        iterations = calibration.iterations
        failed ||= result.errors.length > before
        if (calibration.candidateResolved === false) {
          result.errors.push({ operation: operation.id, fixture: '<corpus>', cohort, arm: 'candidate', phase: 'calibration', error: `Candidate batch remained below ${CALIBRATION_POLICY.minimumCandidateBatchMs} ms at ${iterations} common iterations; raw clock readings were preserved.` })
          failed = true
        }
      }
      const collect = (phase: Sample['phase']) => {
        for (let round = 0; round < rounds; round++) {
          const order = round % 2 ? ['candidate', 'baseline'] as const : ['baseline', 'candidate'] as const
          for (const arm of order) {
            const durationMs = runBatch(arm, phase, iterations, round)
            if (durationMs === undefined) {
              failed = true
              return
            }
            result.samples.push({ operation: operation.id, cohort, round, arm, phase, iterations, durationMs, documents: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) })
          }
        }
      }
      if (!failed) {
        collect('primary')
      }
      const preliminary = summarize(result.samples, operation, cohort, rounds)
      if (!failed && preliminary.status === 'incomplete' && Number.isFinite(preliminary.ratio)) {
        collect('confirmation')
      }
      result.summaries.push(summarize(result.samples, operation, cohort, rounds))
      await checkpoint(result)
    }
  }
  Reflect.set(globalThis, '__wxmlBenchmarkSink', sink)
  return result
}
