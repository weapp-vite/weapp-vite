import { describe, expect, it } from 'vitest'
import { assertVerificationPlan, createVerificationIdentity, createVerificationPlan, fallbackTaskDuration } from '../../e2e/scripts/verification/plan'
import { assertVerificationProfile } from '../../e2e/scripts/verification/profile'
import { resolveVerificationTopology } from '../verification/topology.ts'
import { useIsolatedTopologyTestEnvironment } from '../verification/topologyTestFixture.ts'
import { freeze, identity, now, profile, rehash, tasks } from './fixtures'

useIsolatedTopologyTestEnvironment()

function mismatchDiagnostics(callback: () => void) {
  try {
    callback()
  }
  catch (error) {
    expect(error).toBeInstanceOf(Error)
    const prefix = 'Frozen verification plan does not match the current checkout, suite or task inventory: '
    const message = (error as Error).message
    expect(message.startsWith(prefix)).toBe(true)
    return { message, details: JSON.parse(message.slice(prefix.length)) as unknown }
  }
  throw new Error('Expected frozen verification plan rejection')
}

describe('frozen E2E verification plans', () => {
  it('uses deterministic LPT weights in milliseconds without losing task order or coverage', async () => {
    const history = { schemaVersion: 1 as const, toolVersion: 1, generatedAt: now.toISOString(), profile, tasks: Object.fromEntries([80, 70, 60, 50].map((weight, index) => [tasks[index]!.label, { durationMs: weight * 1000, samples: 1, sources: ['trusted'] }])) }
    const plan = await freeze({ history })
    expect(plan).toEqual(await freeze({ history }))
    expect(plan.tasks.map(task => [task.label, task.shardIndex])).toEqual([['a', 1], ['b', 2], ['c', 2], ['d', 1]])
    expect(plan.tasks.reduce((sum, task) => sum + task.estimatedDurationMs, 0)).toBe(260_000)
    expect(fallbackTaskDuration('hmr-guard:a')).toBe(80_000)
    expect(fallbackTaskDuration('template-a')).toBe(40_000)
    expect(() => assertVerificationPlan(plan)).not.toThrow()
  })

  it('rejects empty inventories, duplicate tasks, dirty checkouts and empty shards', async () => {
    await expect(freeze({ tasks: [] })).rejects.toThrow('empty')
    await expect(freeze({ tasks: [tasks[0]!, tasks[0]!] })).rejects.toThrow('duplicate')
    await expect(freeze({ shards: 5 })).rejects.toThrow('exceeds')
    await expect(freeze({ identity: { ...identity, workingTreeDirty: true } })).rejects.toThrow('clean')
    await expect(freeze({ identity: { ...identity, workingTreeDirty: null } })).rejects.toThrow('clean')
  })

  it('rejects modified plans even after a caller recalculates their hash', async () => {
    const plan = await freeze()
    expect(() => assertVerificationPlan({ ...plan, suite: 'ci-pr' })).toThrow('modified')
    expect(() => assertVerificationPlan(rehash({ ...plan, strict: true }))).toThrow('modified')
    expect(() => assertVerificationPlan(rehash({ ...plan, shardTotal: 3 }))).toThrow('modified')
    expect(() => assertVerificationPlan(rehash({ ...plan, tasks: [...plan.tasks, plan.tasks[0]!] }))).toThrow('modified')
    expect(() => assertVerificationPlan(rehash({ ...plan, profile: { ...profile, arch: undefined } }))).toThrow('modified')
    const options = { suite: 'ci-full', profile, tasks, identity }
    expect(() => assertVerificationPlan(plan, options)).toThrow('current checkout')
    expect(() => assertVerificationPlan(plan, { ...options, identity: { ...identity, commitSha: 'c'.repeat(40) } })).toThrow('current checkout')
    expect(() => assertVerificationPlan(plan, { ...options, identity: { ...identity, workingTreeDirty: true } })).toThrow('current checkout')
    const actual = await freeze({ sourceDigest: undefined })
    expect(() => assertVerificationPlan(actual, options)).not.toThrow()
    expect(() => assertVerificationPlan(actual, { ...options, tasks: [{ ...tasks[0]!, args: ['changed'] }, ...tasks.slice(1)] })).toThrow('inventory')
  })

  it('rechecks tracked and untracked source changes even when the parent claims a clean checkout', () => {
    const environment = { WEAPP_VITE_E2E_ACCEPTANCE_DIRTY: '0' }
    const readGit = (args: string[]) => args[0] === 'rev-parse' ? identity.commitSha : args[0] === 'status' ? ' M packages/runtime/src/index.ts' : ''
    expect(createVerificationIdentity(environment, readGit).workingTreeDirty).toBe(true)
    expect(createVerificationIdentity(environment, args => args[0] === 'rev-parse' ? identity.commitSha : args[0] === 'ls-files' ? 'e2e-apps/example/src/index.ts\0' : '').workingTreeDirty).toBe(true)
  })

  it('reports dirty repository paths from the original identity reads without changing the frozen plan', async () => {
    const plan = await freeze({ sourceDigest: undefined })
    const frozen = JSON.stringify(plan)
    const operations: string[][] = []
    const current = createVerificationIdentity({}, (args) => {
      operations.push(args)
      return args[0] === 'rev-parse'
        ? identity.commitSha
        : args[0] === 'status' ? ' M e2e-apps/example/src/index.vue\r\n' : 'e2e-apps/example/src/added.ts\0'
    })
    const { details } = mismatchDiagnostics(() => assertVerificationPlan(plan, { suite: 'ci-full', profile, tasks, identity: current }))
    expect(details).toMatchObject({
      mismatches: ['workingTreeDirty'],
      expected: { commitSha: identity.commitSha, workingTreeDirty: false, sourceDigest: plan.sourceDigest },
      actual: { commitSha: identity.commitSha, workingTreeDirty: true, sourceDigest: plan.sourceDigest },
      taskDefinitionChanges: [],
      git: {
        trackedStatus: { count: 1, entries: [' M e2e-apps/example/src/index.vue'] },
        untrackedFiles: { count: 1, entries: ['e2e-apps/example/src/added.ts'] },
        failedOperations: [],
      },
    })
    expect(operations).toEqual([['rev-parse', 'HEAD'], ['status', '--porcelain', '--untracked-files=no'], ['ls-files', '--others', '--exclude-standard', '-z']])
    expect(JSON.stringify(plan)).toBe(frozen)
  })

  it('identifies commit, suite, source and added, removed or changed tasks without printing task arguments or environment', async () => {
    const plan = await freeze()
    const currentTasks = [{ ...tasks[0]!, args: ['private-argument'], env: { PRIVATE_TOKEN: 'private-value' } }, ...tasks.slice(1, 3), { ...tasks[3]!, label: 'added' }]
    const { message, details } = mismatchDiagnostics(() => assertVerificationPlan(plan, { suite: 'ci-pr', profile, tasks: currentTasks, identity: { ...identity, commitSha: 'c'.repeat(40) } }))
    expect(details).toMatchObject({
      mismatches: ['suite', 'commitSha', 'sourceDigest', 'taskInventoryHash'],
      expected: { suite: 'ci-full', commitSha: identity.commitSha, sourceDigest: plan.sourceDigest },
      actual: { suite: 'ci-pr', commitSha: 'c'.repeat(40), sourceDigest: expect.stringMatching(/^[a-f0-9]{64}$/) },
      taskDefinitionChanges: [
        { label: 'a', expected: expect.any(String), actual: expect.any(String) },
        { label: 'd', expected: expect.any(String), actual: null },
        { label: 'added', expected: null, actual: expect.any(String) },
      ],
    })
    expect(message).not.toContain('private-argument')
    expect(message).not.toContain('PRIVATE_TOKEN')
    expect(message).not.toContain('private-value')
  })

  it('reports a failed identity operation without copying its stderr into diagnostics', async () => {
    const plan = await freeze({ sourceDigest: undefined })
    const current = createVerificationIdentity({}, (args) => {
      if (args[0] === 'rev-parse') {
        return identity.commitSha
      }
      throw new Error('private stderr with a private credential')
    })
    const { message, details } = mismatchDiagnostics(() => assertVerificationPlan(plan, { suite: 'ci-full', profile, tasks, identity: current }))
    expect(details).toMatchObject({ mismatches: ['workingTreeDirty'], actual: { workingTreeDirty: null }, git: { failedOperations: ['status'] } })
    expect(message).not.toContain('private stderr')
    expect(message).not.toContain('private credential')
  })

  it.each(['os', 'nodeMajor', 'provider', 'platform', 'runnerClass', 'arch'] as const)('isolates history by %s', async (key) => {
    const other = { ...profile, [key]: key === 'nodeMajor' ? 26 : `other-${key}` }
    expect(() => assertVerificationProfile(profile, other)).toThrow('profile mismatch')
    await expect(freeze({ history: { schemaVersion: 1, toolVersion: 1, profile: other, generatedAt: now.toISOString(), tasks: {} } })).rejects.toThrow('profile mismatch')
  })

  it('rejects expired or incompatible duration data', async () => {
    const history = { schemaVersion: 1 as const, toolVersion: 1, profile, generatedAt: '2026-09-01T00:00:00.000Z', tasks: {} }
    await expect(freeze({ history })).rejects.toThrow('expired')
    await expect(freeze({ history: { ...history, toolVersion: 2 } })).rejects.toThrow('version')
    await expect(createVerificationPlan({ suite: 'ci-full', shards: 0, profile, tasks })).rejects.toThrow('positive')
  })
})

it('binds topology into the frozen hash and refuses missing, unknown or mismatched identities', async () => {
  const legacy = await freeze({ topology: 'legacy-v1', sourceDigest: undefined })
  const optimized = await freeze({ topology: 'optimized-v1', sourceDigest: undefined })
  expect(legacy.planHash).not.toBe(optimized.planHash)
  expect(legacy.tasks).toEqual(optimized.tasks)
  expect(legacy.profile).toEqual(optimized.profile)
  expect(legacy.sourceDigest).toBe(optimized.sourceDigest)
  expect(() => assertVerificationPlan(legacy, { suite: 'ci-full', profile, tasks, identity, topology: 'optimized-v1' })).toThrow('topology mismatch')
  expect(() => assertVerificationPlan(legacy, { suite: 'ci-full', profile, tasks, identity, topology: 'legacy-v1' })).not.toThrow()
  expect(() => assertVerificationPlan(rehash({ ...legacy, executionTopology: undefined! }))).toThrow('topology')
  expect(() => assertVerificationPlan(rehash({ ...legacy, executionTopology: { ...resolveVerificationTopology('legacy-v1'), policyDigest: '0'.repeat(64) } }))).toThrow('topology')
})
