import type { WorkloadManifest } from './contracts'
import type { Fixture, Operation } from './types'
import { cohorts } from './cohorts'
import { CORE_OPERATIONS, PARSING_CONTRACT, PERFORMANCE_CONTRACT, SAMPLING_CONTRACT } from './contracts'

export function createWorkload(operations: Operation[], fixtures: Fixture[], quick: boolean, expectedOperations: readonly string[] = CORE_OPERATIONS): WorkloadManifest {
  const actual = operations.map(operation => operation.id)
  const expected = [...expectedOperations].sort()
  if (actual.length !== expected.length || new Set(actual).size !== actual.length
    || JSON.stringify([...actual].sort()) !== JSON.stringify(expected)
    || CORE_OPERATIONS.some(id => !actual.includes(id))) {
    throw new Error('Missing, duplicate or unexpected benchmark operation.')
  }
  if (operations.some(operation => (CORE_OPERATIONS as readonly string[]).includes(operation.id) && operation.comparable !== (operation.id !== 'preserve-noop'))) {
    throw new Error('Core operation comparison contract changed.')
  }
  if (operations.some(operation => operation.id.startsWith('consumer-') && !operation.comparable)) {
    throw new Error('Consumer operation comparison contract changed.')
  }
  if (new Set(fixtures.map(file => file.id)).size !== fixtures.length) {
    throw new Error('Duplicate benchmark fixture.')
  }
  return {
    contract: SAMPLING_CONTRACT,
    parsing: PARSING_CONTRACT,
    performance: PERFORMANCE_CONTRACT,
    rounds: quick ? 3 : 40,
    warmup: quick ? 1 : 10,
    operations: operations.map(({ id, comparable }) => ({ id, comparable })),
    fixtures: fixtures.map(file => ({ id: file.id, sha256: file.sha256, bytes: file.bytes, cohort: file.cohort, synthetic: file.synthetic ?? false })),
    cohorts: cohorts(fixtures).map(([id, files]) => ({ id, fixtureIds: files.map(file => file.id), documents: files.length, bytes: files.reduce((total, file) => total + file.bytes, 0) })),
  }
}
