import { afterEach, expect, it, vi } from 'vitest'
import { getSuiteTasks } from '../../e2e/scripts/e2e-suite-manifest.ts'
import { fixturePartition } from '../../packages/weapp-vite/vitest/partition.ts'
import { logicalRuntimeTaskInventory } from '../verificationBenchmark/runtimeInventory.mjs'
import { assertVerificationTopology, AUDITED_PARALLEL_FIXTURE_TESTS, formalVerificationTopology, resolveVerificationTopology, TDESIGN_AGGREGATE_LABEL, TDESIGN_SOURCE_LABELS, TOPOLOGY_COMPARISON_PROTOCOL, TOPOLOGY_ENV, TOPOLOGY_POLICY_ENV, topologyEnvironment } from './topology.ts'
import { isolateTopologyTestEnvironment, useIsolatedTopologyTestEnvironment } from './topologyTestFixture.ts'

useIsolatedTopologyTestEnvironment()

afterEach(() => vi.unstubAllEnvs())

it.each([
  {},
  { [TOPOLOGY_ENV]: 'legacy-v1', [TOPOLOGY_POLICY_ENV]: 'inherited-policy' },
  { [TOPOLOGY_ENV]: 'optimized-v1', [TOPOLOGY_POLICY_ENV]: '' },
])('isolates and restores only the test topology environment: %j', (inherited) => {
  const env: NodeJS.ProcessEnv = { ...inherited, UNRELATED: 'preserved' }
  const original = { ...env }
  const restore = isolateTopologyTestEnvironment(env)
  expect(env).toEqual({ UNRELATED: 'preserved' })
  env[TOPOLOGY_ENV] = 'test-owned'
  env[TOPOLOGY_POLICY_ENV] = 'test-owned-policy'
  env.UNRELATED = 'changed by test'
  restore()
  expect(env).toEqual({ ...original, UNRELATED: 'changed by test' })
  restore()
  expect(env).toEqual({ ...original, UNRELATED: 'changed by test' })
})

it('rejects unknown topology, inherited conflicts and changed policy before execution', () => {
  expect(resolveVerificationTopology(undefined, {}).id).toBe('optimized-v1')
  expect(() => resolveVerificationTopology('other', {})).toThrow('Unknown')
  expect(() => resolveVerificationTopology('legacy-v1', { [TOPOLOGY_ENV]: 'optimized-v1' })).toThrow('inherited')
  expect(() => resolveVerificationTopology('legacy-v1', { [TOPOLOGY_POLICY_ENV]: '0'.repeat(64) })).toThrow('inherited')
  expect(() => assertVerificationTopology(undefined)).toThrow('Missing')
  expect(() => assertVerificationTopology({ ...resolveVerificationTopology(), extra: 'unreviewed' })).toThrow('invalid')
  expect(() => formalVerificationTopology({ comparisonProtocol: TOPOLOGY_COMPARISON_PROTOCOL, variant: 'baseline' })).toThrow('explicit')
  expect(() => formalVerificationTopology({ comparisonProtocol: TOPOLOGY_COMPARISON_PROTOCOL, variant: 'baseline', topology: 'optimized-v1' })).toThrow('explicit')
  expect(formalVerificationTopology({ comparisonProtocol: TOPOLOGY_COMPARISON_PROTOCOL, variant: 'baseline', topology: 'legacy-v1' }).id).toBe('legacy-v1')
  expect(formalVerificationTopology({ comparisonProtocol: TOPOLOGY_COMPARISON_PROTOCOL, variant: 'candidate', topology: 'optimized-v1' }).id).toBe('optimized-v1')
})

it('changes only the audited fixture partition and keeps the same policy identity', () => {
  const legacy = resolveVerificationTopology('legacy-v1')
  const optimized = resolveVerificationTopology('optimized-v1')
  expect(legacy.policyDigest).toBe(optimized.policyDigest)
  expect(fixturePartition('legacy-v1').parallel).toEqual([])
  expect(fixturePartition('optimized-v1').parallel).toEqual([...AUDITED_PARALLEL_FIXTURE_TESTS])
  expect(new Set(AUDITED_PARALLEL_FIXTURE_TESTS).size).toBe(14)
  vi.stubEnv(TOPOLOGY_ENV, 'legacy-v1')
  expect(fixturePartition().parallel).toEqual([])
  expect(() => fixturePartition('optimized-v1')).toThrow('inherited')
})

it('preserves the entire exhaustive workload, non-applicable tasks and child resource policy across the sole TD four-to-one mapping', async () => {
  const legacy = await getSuiteTasks('ide-full:exhaustive', { topology: 'legacy-v1' })
  const optimized = await getSuiteTasks('ide-full:exhaustive', { topology: 'optimized-v1' })
  expect(logicalRuntimeTaskInventory(legacy)).toEqual(logicalRuntimeTaskInventory(optimized))
  expect(legacy.filter(task => (TDESIGN_SOURCE_LABELS as readonly string[]).includes(task.label))).toHaveLength(4)
  expect(legacy.some(task => task.label === TDESIGN_AGGREGATE_LABEL)).toBe(false)
  expect(optimized.filter(task => task.label === TDESIGN_AGGREGATE_LABEL)).toHaveLength(1)
  expect(optimized.some(task => (TDESIGN_SOURCE_LABELS as readonly string[]).includes(task.label))).toBe(false)
  expect(legacy.length).toBe(optimized.length + 3)
  const common = legacy.filter(task => !(TDESIGN_SOURCE_LABELS as readonly string[]).includes(task.label))
  const withoutTopology = (task: typeof legacy[number]) => ({ ...task, env: Object.fromEntries(Object.entries(task.env ?? {}).filter(([key]) => ![TOPOLOGY_ENV, TOPOLOGY_POLICY_ENV].includes(key))) })
  expect(common.map(withoutTopology)).toEqual(optimized.filter(task => task.label !== TDESIGN_AGGREGATE_LABEL).map(withoutTopology))
  expect(legacy.filter(task => task.outOfScopeReason)).toHaveLength(3)
  for (const [topology, tasks] of [['legacy-v1', legacy], ['optimized-v1', optimized]] as const) {
    const environment = topologyEnvironment(resolveVerificationTopology(topology))
    expect(tasks.every(task => Object.entries(environment).every(([key, value]) => task.env?.[key] === value))).toBe(true)
  }
  expect(() => logicalRuntimeTaskInventory([{ label: TDESIGN_AGGREGATE_LABEL }, { label: TDESIGN_SOURCE_LABELS[0] }])).toThrow('duplicated')
})
