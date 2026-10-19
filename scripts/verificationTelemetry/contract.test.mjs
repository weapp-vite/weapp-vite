import { expect, it } from 'vitest'
import { completeTelemetryContract } from './contract.mjs'
import { classifyCoverageScope, coverageScopePolicy } from './coveragePolicy.mjs'

function fixture() {
  const evidence = [
    { id: 'coverage-linux', kind: 'coverage', scopeLevel: 'logical-cases', scope: { files: ['example.test.ts'], cases: [['example.test.ts', 'works', 'passed']] } },
    { id: 'runtime-linux', kind: 'runtime' },
    { id: 'task-suite-linux-pr', kind: 'task-suite' },
  ]
  return {
    kind: 'ci-benchmark-preparation',
    formalSample: false,
    gaps: [{ id: 'review', reason: 'Review inventory' }],
    configuration: { needs: { approval: [], tests: ['approval'] }, outOfScope: {} },
    contract: { schemaVersion: 1, draft: true, inputPolicy: { version: 'framework-tree-v1' }, needs: { approval: [], tests: ['approval'] }, outOfScope: {}, evidence },
  }
}

it('creates a non-draft contract only from the exact reviewed complete evidence inventory', () => {
  const value = fixture()
  expect(completeTelemetryContract(value, value.contract.evidence.map(entry => entry.id)).draft).toBe(false)
  expect(value.contract.draft).toBe(true)
})

it('finalizes audited product/validation scope while retaining every validation case and receipt', () => {
  const value = fixture()
  const entry = value.contract.evidence[0]
  Object.assign(entry, { scopeLevel: 'audited-cases', scopePolicy: structuredClone(coverageScopePolicy), scope: classifyCoverageScope({ files: ['example.test.ts', 'scripts/verification/run.test.ts'], cases: [['example.test.ts', 'works', 'passed'], ['scripts/verification/run.test.ts', 'tool regression', 'skipped']] }) })
  const ids = value.contract.evidence.map(item => item.id)
  expect(completeTelemetryContract(value, ids).evidence[0].scope.validation.cases).toHaveLength(1)
  entry.scope.classification[0].category = 'validation'
  expect(() => completeTelemetryContract(value, ids)).toThrow(/classification/)
})

it.each(['failed', 'pending'])('rejects a %s case even when it is classified as validation tooling', (state) => {
  const value = fixture()
  Object.assign(value.contract.evidence[0], { scopeLevel: 'audited-cases', scopePolicy: structuredClone(coverageScopePolicy), scope: classifyCoverageScope({ files: ['example.test.ts', 'scripts/verification/run.test.ts'], cases: [['example.test.ts', 'works', 'passed'], ['scripts/verification/run.test.ts', 'tool regression', state]] }) })
  expect(() => completeTelemetryContract(value, value.contract.evidence.map(item => item.id))).toThrow(/unfinished/)
})

it.each([
  value => value.gaps.push({ id: 'coverage', reason: 'Missing native blob' }),
  value => value.contract.evidence[0].scopeLevel = 'files',
  value => value.contract.evidence[0].scope.cases = [],
  value => value.contract.needs.tests = [],
  value => value.contract.evidence.pop(),
])('rejects incomplete evidence, reduced logical scope or changed topology', (mutate) => {
  const value = fixture()
  const expected = value.contract.evidence.map(entry => entry.id)
  mutate(value)
  expect(() => completeTelemetryContract(value, expected)).toThrow()
})
