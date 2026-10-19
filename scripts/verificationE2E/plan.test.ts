import { describe, expect, it } from 'vitest'
import { assertVerificationPlan, createVerificationIdentity, createVerificationPlan, fallbackTaskDuration } from '../../e2e/scripts/verification/plan'
import { assertVerificationProfile } from '../../e2e/scripts/verification/profile'
import { freeze, identity, now, profile, rehash, tasks } from './fixtures'

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
