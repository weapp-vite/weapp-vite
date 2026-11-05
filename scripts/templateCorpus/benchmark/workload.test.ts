import type { ProfileFixture, ProfileGroup, ProfileOptions, WorkloadPlan } from './types'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createWorkloadPlan } from './workload'
import { workloadHash, workloadJson } from './workloadHash'

function fixture(id: string): ProfileFixture {
  const source = `<${id}/>`
  return { id, source, sha256: 'f'.repeat(64), bytes: new TextEncoder().encode(source).length, profile: { id: 'weapp-xml', platform: 'weapp', parserPlatform: 'weapp', syntax: 'xml', rawTags: ['wxs'], resolver: 'none' }, options: { platform: 'weapp', syntax: 'xml', rawTags: ['wxs'] }, frameworks: [], categories: [], quotaEligible: true, features: [], size: 'small', comparison: { eligible: true } }
}

const fixtures = ['first', 'second', 'third'].map(fixture)
const groups: ProfileGroup[] = ['alpha', 'beta'].map(id => ({ id, comparable: true, fixtureIds: fixtures.map(input => input.id) }))
const options: ProfileOptions = { rounds: 40, warmup: 10, operations: ['parse'], gate: { aggregateGroupSuffix: '/all', aggregateGroups: ['aggregate'], aggregateMaximumRatio: 1.03, categoryMaximumRatio: 1.05 }, workload: { protocol: 'exact-workload-v2', runtime: 'node', identitySha256: 'a'.repeat(64) } }

function plan(selectedFixtures = fixtures, selectedGroups = groups, selectedOptions = options): WorkloadPlan {
  const result = createWorkloadPlan(selectedFixtures, selectedGroups, selectedOptions)
  expect(result).toBeDefined()
  return result!
}

function key(selectedFixtures = fixtures, selectedGroups = groups, selectedOptions = options) {
  return plan(selectedFixtures, selectedGroups, selectedOptions).jobs[0]!.keySha256
}

describe('portable exact workload identity', () => {
  it.each(['', 'abc', '微信𠮷🙂\r\nUnicode', ...[55, 56, 63, 64, 65, 127, 128, 129].map(length => 'a'.repeat(length)), '多区块🙂'.repeat(200)])('matches Node SHA-256 for UTF-8 input %#', (source) => {
    expect(workloadHash(source)).toBe(createHash('sha256').update(source).digest('hex'))
  })

  it('distinguishes JSON values whose ordinary serialization could omit or change meaning', () => {
    const values = [undefined, 'undefined', '["undefined"]', [], [undefined], ['undefined'], [null], {}, { syntax: undefined }, { syntax: 'undefined' }, null, 'null', false, 0, '0']
    expect(new Set(values.map(workloadJson)).size).toBe(values.length)
    expect(workloadJson({ syntax: 'xml', rawTags: ['wxs', 'sjs'] })).toBe(workloadJson({ rawTags: ['wxs', 'sjs'], syntax: 'xml' }))
    expect(workloadJson(['wxs', 'sjs'])).not.toBe(workloadJson(['sjs', 'wxs']))
  })

  it('encodes nested typed structure once with linear output size', () => {
    let value: unknown = 'quoted " value \\ surrogate \uD800'
    for (let depth = 0; depth < 20; depth++) {
      value = { nested: [value] }
    }
    const encoded = workloadJson(value)
    expect(encoded.length).toBeLessThan(2000)
    expect(encoded).toContain('\\ud800')
    expect(encoded).not.toContain('\\\\\\\\\\\\\\\\')
    expect(() => JSON.parse(encoded) as unknown).not.toThrow()
  })

  it.each([() => undefined, { resolver: () => undefined }, Symbol('resolver'), 1n, Number.NaN, Number.POSITIVE_INFINITY, new Date(0)])('rejects values with no frozen JSON-safe implementation identity: %#', (value) => {
    expect(() => workloadJson(value)).toThrow('JSON-safe frozen options')
  })
})

describe('exact ordered workload planning', () => {
  it('measures two same-threshold classifications of three inputs once and retains both logical references', () => {
    const result = plan()
    expect(result).toMatchObject({ scope: options.workload, logicalCells: 2, physicalJobs: 1 })
    expect(result.jobs).toEqual([{ id: 'job-1', keySha256: expect.stringMatching(/^[a-f\d]{64}$/), operation: 'parse', comparable: true, threshold: 1.05, fixtureIds: ['first', 'second', 'third'], groups: ['alpha', 'beta'] }])
    expect(result.cells).toEqual([{ operation: 'parse', group: 'alpha', jobId: 'job-1' }, { operation: 'parse', group: 'beta', jobId: 'job-1' }])
    const { sha256, ...identity } = result
    expect(sha256).toBe(workloadHash(workloadJson(identity)))
    expect(fixtures).toHaveLength(3)
    expect(groups.map(group => group.id)).toEqual(['alpha', 'beta'])
  })

  it('fixes the first representative before timing and follows the declared group order', () => {
    const forward = plan()
    const reversed = plan(fixtures, [...groups].reverse())
    expect(forward.jobs[0]!.groups).toEqual(['alpha', 'beta'])
    expect(reversed.jobs[0]!.groups).toEqual(['beta', 'alpha'])
    expect(reversed.jobs[0]!.keySha256).toBe(forward.jobs[0]!.keySha256)
    expect(reversed.sha256).not.toBe(forward.sha256)
  })

  it('keeps different effective thresholds as separate physical jobs', () => {
    const result = plan(fixtures, [{ ...groups[0]!, id: 'aggregate' }, groups[1]!])
    expect(result).toMatchObject({ logicalCells: 2, physicalJobs: 2 })
    expect(result.jobs.map(job => job.threshold)).toEqual([1.03, 1.05])
    expect(result.jobs[0]!.keySha256).not.toBe(result.jobs[1]!.keySha256)
    expect(key(fixtures, groups, { ...options, gate: { ...options.gate!, categoryMaximumRatio: 1.06 } })).not.toBe(key())
  })

  it('preserves input order and does not merge a matching set in a different sequence', () => {
    const result = plan(fixtures, [groups[0]!, { ...groups[1]!, fixtureIds: [...groups[1]!.fixtureIds].reverse() }])
    expect(result.physicalJobs).toBe(2)
    expect(result.jobs[0]!.keySha256).not.toBe(result.jobs[1]!.keySha256)
    expect(key([...fixtures].reverse())).toBe(key())
  })

  it('binds actual source even if declared hashes, fixture IDs, UTF-16 length and byte counts match', () => {
    const replacement = { ...fixtures[0]!, source: '<other/>' }
    expect(replacement.source.length).toBe(fixtures[0]!.source.length)
    expect(replacement.id).toBe(fixtures[0]!.id)
    expect(replacement.sha256).toBe(fixtures[0]!.sha256)
    expect(replacement.bytes).toBe(fixtures[0]!.bytes)
    expect(key([replacement, ...fixtures.slice(1)])).not.toBe(key())
  })

  it('binds complete options and scan profile metadata independently', () => {
    const changedOptions = { ...fixtures[0]!, options: { ...fixtures[0]!.options, rawTags: ['wxs', 'sjs'] } }
    const changedProfile = { ...fixtures[0]!, profile: { ...fixtures[0]!.profile, syntax: 'legacy' as const } }
    expect(key([changedOptions, ...fixtures.slice(1)])).not.toBe(key())
    expect(key([changedProfile, ...fixtures.slice(1)])).not.toBe(key())
    expect(key([{ ...fixtures[0]!, options: { ...fixtures[0]!.options, rawTags: undefined } }, ...fixtures.slice(1)])).not.toBe(key())
  })

  it('distinguishes lone UTF-16 surrogates with equal UTF-8 replacement bytes', () => {
    const first = { ...fixtures[0]!, source: '<v>\uD800</v>' }
    const second = { ...first, source: '<v>\uD801</v>' }
    expect(workloadHash(first.source)).toBe(workloadHash(second.source))
    expect(first.source.length).toBe(second.source.length)
    expect(key([first, ...fixtures.slice(1)])).not.toBe(key([second, ...fixtures.slice(1)]))
  })

  it('refuses to silently discard a resolver function from a fixture identity', () => {
    const resolver = { ...fixtures[0]!, options: { ...fixtures[0]!.options, resolveScriptBoundary: () => undefined } }
    expect(() => plan([resolver, ...fixtures.slice(1)])).toThrow('functions/resolvers need an explicit implementation identity')
  })

  it('never shares across runtimes, frozen implementation scope or formal budgets', () => {
    expect(key(fixtures, groups, { ...options, workload: { ...options.workload!, runtime: 'chromium' } })).not.toBe(key())
    expect(key(fixtures, groups, { ...options, workload: { ...options.workload!, identitySha256: 'b'.repeat(64) } })).not.toBe(key())
    expect(key(fixtures, groups, { ...options, rounds: 39 })).not.toBe(key())
    expect(key(fixtures, groups, { ...options, warmup: 9 })).not.toBe(key())
  })

  it('keeps operations and comparable modes independent while retaining every logical cell', () => {
    const multiple = plan(fixtures, groups, { ...options, operations: ['scan', 'parse', 'canonical', 'preserve-noop'] })
    expect(multiple).toMatchObject({ logicalCells: 8, physicalJobs: 4 })
    expect(new Set(multiple.jobs.map(job => job.keySha256)).size).toBe(4)
    expect(multiple.jobs.find(job => job.operation === 'preserve-noop')!.threshold).toBeNull()
    const modes = plan(fixtures, [groups[0]!, { ...groups[1]!, comparable: false }])
    expect(modes.physicalJobs).toBe(2)
    expect(modes.jobs.map(job => job.comparable)).toEqual([true, false])
    expect(modes.jobs[0]!.keySha256).not.toBe(modes.jobs[1]!.keySha256)
  })

  it('respects explicit group and operation intersections without creating unexecuted aliases', () => {
    const selected = plan(fixtures, [{ ...groups[0]!, operations: ['scan'] }, { ...groups[1]!, operations: ['parse'] }], { ...options, groups: ['beta'], operations: ['scan', 'parse'] })
    expect(selected).toMatchObject({ logicalCells: 1, physicalJobs: 1 })
    expect(selected.jobs[0]!.groups).toEqual(['beta'])
    expect(selected.cells).toEqual([{ operation: 'parse', group: 'beta', jobId: 'job-1' }])
  })

  it('leaves legacy measurements unmodified and rejects invalid exact-plan identities', () => {
    expect(createWorkloadPlan(fixtures, groups, { ...options, workload: undefined })).toBeUndefined()
    expect(() => plan(fixtures, groups, { ...options, gate: undefined })).toThrow('frozen gate policy')
    expect(() => plan(fixtures, groups, { ...options, workload: { ...options.workload!, identitySha256: 'unfrozen' } })).toThrow('incomplete exact workload scope')
    expect(() => plan(fixtures, groups, { ...options, workload: { ...options.workload!, runtime: 'unknown' } })).toThrow('incomplete exact workload scope')
    expect(() => plan([...fixtures, fixtures[0]!])).toThrow('Duplicate fixture or group')
    expect(() => plan(fixtures, [groups[0]!, groups[0]!])).toThrow('Duplicate fixture or group')
    expect(() => plan(fixtures, [{ ...groups[0]!, fixtureIds: ['missing'] }])).toThrow('missing fixture')
    expect(() => plan(fixtures, [{ ...groups[0]!, fixtureIds: ['first', 'first'] }])).toThrow('duplicate or missing fixture')
    expect(() => plan(fixtures, [{ ...groups[0]!, fixtureIds: [] }])).toThrow('Empty, duplicate')
    expect(() => plan(fixtures, groups, { ...options, operations: ['parse', 'parse'] })).toThrow('Duplicate operation')
  })
})
