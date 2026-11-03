import type { WorkloadManifest } from './contracts'
import type { MeasurementResult, Operation, Sample } from './types'
import { CORE_OPERATIONS, PARSING_CONTRACT, PERFORMANCE_CONTRACT, SAMPLING_CONTRACT } from './contracts'
import { summarize } from './statistics'

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

export function assertIntegrity(result: MeasurementResult, expected: WorkloadManifest | undefined = result.manifest, requirePerformance = false) {
  if (!expected || expected.contract !== SAMPLING_CONTRACT || !same(expected.parsing, PARSING_CONTRACT) || !same(expected.performance, PERFORMANCE_CONTRACT) || !same(result.manifest, expected)
    || ![3, 40].includes(expected.rounds) || expected.warmup !== (expected.rounds === 3 ? 1 : 10)
    || new Set(expected.operations.map(operation => operation.id)).size !== expected.operations.length
    || new Set(expected.fixtures.map(file => file.id)).size !== expected.fixtures.length
    || new Set(expected.cohorts.map(cohort => cohort.id)).size !== expected.cohorts.length
    || CORE_OPERATIONS.some(id => !expected.operations.some(operation => operation.id === id && operation.comparable === (id !== 'preserve-noop')))
    || expected.operations.some(operation => operation.id.startsWith('consumer-') && !operation.comparable)
    || !expected.cohorts.some(cohort => cohort.id === 'shared')) {
    throw new Error('Missing or different frozen benchmark workload manifest.')
  }
  if (result.errors.length) {
    throw new Error(`Benchmark operation errors: ${result.errors.length}`)
  }
  const fixtureMap = new Map(expected.fixtures.map(file => [file.id, file]))
  const real = expected.fixtures.filter(file => !file.synthetic)
  const aggregate = expected.cohorts.at(-1)
  if (!real.length || aggregate?.id !== 'real-all' || !same(aggregate.fixtureIds, real.map(file => file.id))
    || expected.fixtures.some(file => !Number.isInteger(file.bytes) || file.bytes < 0)
    || expected.cohorts.some(cohort => new Set(cohort.fixtureIds).size !== cohort.fixtureIds.length || cohort.documents !== cohort.fixtureIds.length
      || cohort.fixtureIds.some(id => !fixtureMap.has(id)) || cohort.bytes !== cohort.fixtureIds.reduce((total, id) => total + (fixtureMap.get(id)?.bytes ?? 0), 0))) {
    throw new Error('Missing or different complete real-all benchmark cohort.')
  }
  const parityKeys = new Set<string>()
  for (const row of result.parity) {
    const key = `${row.operation}:${row.fixture}`
    const file = fixtureMap.get(row.fixture)
    if (!file || !expected.operations.some(operation => operation.id === row.operation) || parityKeys.has(key) || row.cohort !== file.cohort
      || row.equal !== (row.baseline === row.candidate)) {
      throw new Error('Duplicate or unexpected benchmark parity result.')
    }
    parityKeys.add(key)
    if ((file.cohort === 'shared' || file.synthetic || row.operation === 'preserve-noop') && !row.equal) {
      throw new Error(`Benchmark semantic difference: ${key}`)
    }
  }
  if (parityKeys.size !== expected.operations.length * expected.fixtures.length) {
    throw new Error('Missing benchmark parity results.')
  }
  const allowedCells = new Set(expected.operations.flatMap(operation => expected.cohorts.map(cohort => `${operation.id}:${cohort.id}`)))
  if (result.summaries.length !== allowedCells.size || new Set(result.summaries.map(row => `${row.operation}:${row.cohort}`)).size !== allowedCells.size
    || result.summaries.some(row => !allowedCells.has(`${row.operation}:${row.cohort}`))
    || result.samples.some(row => !allowedCells.has(`${row.operation}:${row.cohort}`) || !['primary', 'confirmation'].includes(row.phase))) {
    throw new Error('Missing, duplicate or unexpected benchmark cells.')
  }
  for (const contract of expected.operations) {
    const operation: Operation = { ...contract, run: () => undefined }
    for (const cohort of expected.cohorts) {
      const rows = result.samples.filter(row => row.operation === contract.id && row.cohort === cohort.id)
      const primary = rows.filter(row => row.phase === 'primary')
      const confirmation = rows.filter(row => row.phase === 'confirmation')
      const validate = (batch: Sample[]) => {
        if (batch.length !== expected.rounds * 2) {
          throw new Error('Missing or duplicate benchmark samples.')
        }
        const iterations = batch[0]!.iterations
        for (let round = 0; round < expected.rounds; round++) {
          const pair = batch.filter(row => row.round === round)
          const order = round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']
          if (pair.length !== 2 || !same(pair.map(row => row.arm), order)
            || pair.some(row => row.iterations !== iterations || row.documents !== cohort.documents || row.bytes !== cohort.bytes)) {
            throw new Error('Invalid paired order, workload size or iteration count.')
          }
        }
      }
      validate(primary)
      const first = summarize(primary, operation, cohort.id, expected.rounds)
      const needsConfirmation = first.status === 'incomplete' && Number.isFinite(first.ratio)
      if (needsConfirmation) {
        validate(confirmation)
      }
      else if (confirmation.length) {
        throw new Error('Unexpected additional confirmation batch.')
      }
      if (confirmation.length && confirmation[0]!.iterations !== primary[0]!.iterations) {
        throw new Error('Confirmation changed the paired workload.')
      }
      const summary = summarize(rows, operation, cohort.id, expected.rounds)
      const stored = result.summaries.find(row => row.operation === contract.id && row.cohort === cohort.id)
      const complete = summary.status !== 'incomplete'
      const performancePassed = !requirePerformance || ['passed', 'informational'].includes(summary.status)
      if (!same(summary, stored) || !complete || !performancePassed) {
        throw new Error(`Benchmark cell incomplete, unstable or regressed: ${contract.id}:${cohort.id}`)
      }
    }
  }
}

export function assertPassed(result: MeasurementResult, expected: WorkloadManifest | undefined = result.manifest) {
  assertIntegrity(result, expected, true)
}
