import type { Fixture, MeasurementResult, Operation } from './types'
import { CORE_OPERATIONS } from './contracts'
import { createWorkload } from './workload'

/** 在任何计时前完整执行每个输入、双方入口及其语义 oracle，不产生性能样本。 */
export function checkCorrectness(operations: Operation[], fixtures: Fixture[], expectedOperations: readonly string[] = CORE_OPERATIONS) {
  const manifest = createWorkload(operations, fixtures, false, expectedOperations)
  const errors: MeasurementResult['errors'] = []
  const parity: MeasurementResult['parity'] = []
  for (const operation of operations) {
    for (const fixture of fixtures) {
      for (const arm of ['baseline', 'candidate'] as const) {
        try {
          operation.run(fixture, arm)
        }
        catch (error) {
          errors.push({ operation: operation.id, fixture: fixture.id, cohort: fixture.pressureId ?? fixture.cohort, arm, phase: 'preflight', error: String(error) })
        }
      }
      try {
        if (!operation.verify) {
          throw new Error('Missing benchmark correctness oracle.')
        }
        parity.push({ operation: operation.id, fixture: fixture.id, cohort: fixture.cohort, ...operation.verify(fixture) })
      }
      catch (error) {
        errors.push({ operation: operation.id, fixture: fixture.id, cohort: fixture.pressureId ?? fixture.cohort, arm: 'candidate', phase: 'parity', error: String(error) })
      }
    }
  }
  const fixtureMap = new Map(fixtures.map(fixture => [fixture.id, fixture]))
  const semanticFailures = parity.filter(row => !row.equal && (row.cohort === 'shared' || fixtureMap.get(row.fixture)!.synthetic || row.operation === 'preserve-noop'))
  return { status: errors.length || semanticFailures.length ? 'failed' : 'passed', manifest, samples: [], errors, parity, semanticFailures }
}
