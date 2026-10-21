import { expect, it } from 'vitest'
import { hash } from '../../coverageShards/contracts.mjs'
import { classifyCoverageScope, coverageScopePolicy } from '../../verificationTelemetry/coveragePolicy.mjs'
import { coverageLogicalScope } from '../../verificationTelemetry/logicalCoverage.mjs'
import { collectCiEvidence } from '../ci.mjs'
import { fixture } from './fixture.mjs'

function auditedFixture() {
  const value = fixture()
  const plan = value.files['coverage-plan']['plan.json']
  const shard = value.files['coverage-shard-1']['manifest.json']
  const descriptor = value.contract.evidence[0]
  shard.cases = [{ ...plan.inventory[0], name: 'works', state: 'passed' }]
  Object.assign(descriptor, { scopeLevel: 'audited-cases', scopePolicy: structuredClone(coverageScopePolicy) })
  const freezeScope = () => descriptor.scope = classifyCoverageScope(coverageLogicalScope(plan, [shard]))
  const add = (file, name, state = 'passed') => {
    const entry = { file, projectName: 'framework' }
    plan.inventory.push(entry)
    shard.cases.push({ ...entry, name, state })
    const { planHash: _oldHash, ...data } = plan
    plan.planHash = hash(JSON.stringify(data))
    shard.planHash = plan.planHash
    Object.assign(value.files['coverage-complete']['shard-verdict.json'], { planHash: plan.planHash, tests: plan.inventory.length })
  }
  freezeScope()
  return { ...value, plan, shard, descriptor, freezeScope, add, collect: () => collectCiEvidence(value.repository, 123, value.configuration, value.execute) }
}

it('compares identical product cases while retaining every added validation case and its explicit rule', async () => {
  const value = auditedFixture()
  const baseline = await value.collect()
  value.add('scripts/verification/plan.test.ts', 'new tooling regression')
  value.freezeScope()
  const candidate = await value.collect()
  expect(candidate.sample?.complete).toBe(true)
  expect(candidate.sample.scopeDigest).toBe(baseline.sample.scopeDigest)
  expect(candidate.evidence.execution.inventories).not.toEqual(baseline.evidence.execution.inventories)
  expect(candidate.evidence.execution.inventories[0]).toMatchObject({
    scopeSummary: { product: { files: 1, cases: 1 }, validation: { files: 1, cases: 1 } },
    scope: {
      validation: { cases: [['scripts/verification/plan.test.ts', 'new tooling regression', 'passed']] },
      classification: [{ file: 'packages/framework/test.ts', category: 'product', rule: null }, { file: 'scripts/verification/plan.test.ts', category: 'validation', rule: 'scripts/verification/' }],
    },
  })
})

it.each(['scripts/unknown.test.ts', 'mpcore/packages/simulator/test/tdesignStyleBindings.test.ts'])(
  'keeps a new case in %s in the exact product comparison',
  async (file) => {
    const value = auditedFixture()
    const baseline = await value.collect()
    value.add(file, 'new product regression')
    value.freezeScope()
    const candidate = await value.collect()
    expect(candidate.sample?.complete).toBe(true)
    expect(candidate.sample.scopeDigest).not.toBe(baseline.sample.scopeDigest)
    expect(candidate.evidence.execution.inventories[0].scopeSummary.product.cases).toBe(2)
  },
)

it.each(['passed', 'skipped'])('pins the full validation %s state per immutable variant contract', async (state) => {
  const value = auditedFixture()
  value.add('scripts/verification/plan.test.ts', 'tooling regression', state)
  value.freezeScope()
  expect((await value.collect()).sample?.complete).toBe(true)
  value.shard.cases[1].state = state === 'passed' ? 'skipped' : 'passed'
  expect((await value.collect()).sample).toBeNull()
})

it.each([
  ['missing product case', value => value.shard.cases = []],
  ['changed product case', value => value.shard.cases[0].name = 'changed'],
  ['changed product state', value => value.shard.cases[0].state = 'skipped'],
  ['failed product', value => value.shard.cases[0].state = 'failed'],
  ['pending product', value => value.shard.cases[0].state = 'pending'],
  ['wrong project', value => value.shard.cases[0].projectName = 'another'],
  ['missing assignment', value => value.shard.inventory = []],
  ['missing policy', value => delete value.descriptor.scopePolicy],
  ['unknown policy', value => value.descriptor.scopePolicy.version = 'unreviewed'],
  ['changed classification receipt', value => value.descriptor.scope.classification[0].category = 'validation'],
])('rejects %s instead of reducing the observed scope', async (_, mutate) => {
  const value = auditedFixture()
  mutate(value)
  expect((await value.collect()).sample).toBeNull()
})

it.each(['failed', 'pending'])('does not hide a %s validation case through classification', async (state) => {
  const value = auditedFixture()
  value.add('scripts/verification/plan.test.ts', 'tooling regression')
  value.freezeScope()
  value.shard.cases[1].state = state
  expect((await value.collect()).sample).toBeNull()
})

it('rejects a missing validation case even when every product case still passed', async () => {
  const value = auditedFixture()
  value.add('scripts/verification/plan.test.ts', 'tooling regression')
  value.freezeScope()
  value.shard.cases.pop()
  expect((await value.collect()).sample).toBeNull()
})

it.each([['os', 'lInux'], ['nodeVersion', 'v24'], ['packageManager', 'pnpm@11']])(
  'rejects malformed actual %s even if the frozen profile repeats it',
  async (key, actual) => {
    const value = auditedFixture()
    value.plan.identity[key] = actual
    value.descriptor.profile[key] = actual
    value.add('scripts/verification/plan.test.ts', 'resource profile regression')
    value.freezeScope()
    expect((await value.collect()).sample).toBeNull()
  },
)
