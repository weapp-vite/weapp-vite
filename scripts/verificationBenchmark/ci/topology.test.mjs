/* eslint-disable no-template-curly-in-string -- fixture 需要保留 GitHub 表达式原文，不能执行 JavaScript 插值。 */
import { expect, it, vi } from 'vitest'
import { stringify } from 'yaml'
import { generateCiTopology } from './topology.mjs'

const root = '.github/workflows/ci-pr.yml'
const shared = '.github/workflows/shared.yml'
const runner = '.github/workflows/runner.yml'
const frozen = '.github/workflows/frozen.yml'
const uses = file => `./${file}`
const successful = name => ({ name, status: 'completed', conclusion: 'success' })
const skipped = name => ({ name, status: 'completed', conclusion: 'skipped' })
const matrix = { os: ['ubuntu-latest', 'windows-latest'], node: [22] }
const buildName = 'Build and Test (${{ matrix.os }} / Node ${{ matrix.node }})'
const testName = 'Miniapp (${{ matrix.os }} / Node ${{ matrix.node }})'

function sources(workflows) {
  return vi.fn(async (file) => {
    if (!Object.hasOwn(workflows, file)) {
      throw new Error(`No frozen source: ${file}`)
    }
    return typeof workflows[file] === 'string' ? workflows[file] : stringify({ jobs: workflows[file] })
  })
}

function baseline() {
  const read = sources({
    [root]: {
      approval: { name: 'Approve PR checks' },
      plan: { name: 'Freeze approved PR target', needs: 'approval' },
      e2e: { name: 'CI E2E', needs: 'plan', uses: uses(shared) },
    },
    [shared]: {
      'pr-context': { uses: uses(frozen) },
      'build-pr': { name: buildName, needs: 'pr-context', strategy: { matrix }, uses: uses(runner), if: 'condition' },
      'build-full': { name: buildName, needs: 'pr-context', strategy: { matrix }, uses: uses(runner), if: 'other condition' },
      'build-release': { name: buildName, needs: 'pr-context', strategy: { matrix }, uses: uses(runner), if: 'release condition' },
      'test': { name: testName, needs: ['pr-context', 'build-pr'], strategy: { matrix }, uses: uses(runner) },
    },
    [runner]: { run: {} },
    [frozen]: { resolve: {} },
  })
  const builds = ['ubuntu-latest', 'windows-latest'].map(os => `CI E2E / Build and Test (${os} / Node 22) / run`)
  const tests = ['ubuntu-latest', 'windows-latest'].map(os => `CI E2E / Miniapp (${os} / Node 22) / run`)
  const jobs = ['Approve PR checks', 'Freeze approved PR target', 'CI E2E / pr-context / resolve', ...builds, ...tests].map(successful)
  jobs.push(skipped(`CI E2E / ${buildName}`), skipped(`CI E2E / ${buildName}`))
  return { read, jobs, builds, tests }
}

it('preserves the baseline all-matrix barrier and groups duplicate skipped branch rows', async () => {
  const value = baseline()
  const result = await generateCiTopology(value.jobs, value.read)
  expect(result.needs['Approve PR checks']).toEqual([])
  expect(result.needs['Freeze approved PR target']).toEqual(['Approve PR checks'])
  expect(result.needs['CI E2E / pr-context / resolve']).toEqual(['Freeze approved PR target'])
  for (const test of value.tests) {
    expect(result.needs[test]).toEqual([...value.builds, 'CI E2E / pr-context / resolve'].sort())
  }
  expect(result.outOfScope).toEqual({ [`CI E2E / ${buildName}`]: { reason: expect.any(String), expectedCount: 2 } })
  expect(result.sourceFiles).toEqual([frozen, root, runner, shared].sort())
  expect(value.read.mock.calls.map(([file]) => file).sort()).toEqual(result.sourceFiles)
})

it('correlates child dependencies with their full rendered reusable matrix ancestor', async () => {
  const inner = '.github/workflows/inner.yml'
  const read = sources({
    [root]: {
      approval: { name: 'Approve PR checks' },
      e2e: { name: 'CI E2E', needs: 'approval', uses: uses(shared) },
    },
    [shared]: {
      platform: { name: testName, strategy: { matrix }, uses: uses(inner) },
    },
    [inner]: {
      'pr-context': { uses: uses(frozen) },
      'build': { name: 'Build', needs: 'pr-context', uses: uses(runner) },
      'test': { name: 'Suite shard ${{ matrix.shard }}', strategy: { matrix: { shard: [1, 2] } }, needs: ['pr-context', 'build'], uses: uses(runner) },
      'aggregate': { needs: ['build', 'test'] },
    },
    [runner]: { run: {} },
    [frozen]: { resolve: {} },
  })
  const platforms = ['ubuntu-latest', 'windows-latest'].map(os => `CI E2E / Miniapp (${os} / Node 22)`)
  const jobs = [successful('Approve PR checks'), ...platforms.flatMap(prefix => [
    `${prefix} / pr-context / resolve`,
    `${prefix} / Build / run`,
    `${prefix} / Suite shard 1 / run`,
    `${prefix} / Suite shard 2 / run`,
    `${prefix} / aggregate`,
  ].map(successful))]
  const result = await generateCiTopology(jobs, read)
  for (const prefix of platforms) {
    expect(result.needs[`${prefix} / pr-context / resolve`]).toEqual(['Approve PR checks'])
    expect(result.needs[`${prefix} / Suite shard 1 / run`]).toEqual([`${prefix} / Build / run`, `${prefix} / pr-context / resolve`].sort())
    expect(result.needs[`${prefix} / aggregate`]).toEqual([`${prefix} / Build / run`, `${prefix} / Suite shard 1 / run`, `${prefix} / Suite shard 2 / run`].sort())
  }
})

it('rejects identical display names when possible source branches imply different needs', async () => {
  const read = sources({
    [root]: {
      first: { name: 'First' },
      second: { name: 'Second' },
      a: { name: 'Tests', needs: 'first', if: 'branch a' },
      b: { name: 'Tests', needs: 'second', if: 'branch b' },
    },
  })
  await expect(generateCiTopology(['First', 'Second', 'Tests'].map(successful), read)).rejects.toThrow(/Ambiguous needs/)
})

it('allows identical display names when all possible source needs are identical', async () => {
  const read = sources({
    [root]: {
      approval: { name: 'Approve' },
      a: { name: 'Tests', needs: 'approval', if: 'branch a' },
      b: { name: 'Tests', needs: 'approval', if: 'branch b' },
    },
  })
  expect((await generateCiTopology(['Approve', 'Tests'].map(successful), read)).needs.Tests).toEqual(['Approve'])
})

it('uses a unique executed sibling to disambiguate mutually exclusive reusable branches', async () => {
  const branchA = '.github/workflows/branch-a.yml'
  const branchB = '.github/workflows/branch-b.yml'
  const read = sources({
    [root]: {
      a: { name: 'Platform', uses: uses(branchA) },
      b: { name: 'Platform', uses: uses(branchB) },
    },
    [branchA]: {
      setup: { name: 'Setup A', uses: uses(runner) },
      tests: { name: 'Tests', needs: 'setup', uses: uses(runner) },
    },
    [branchB]: {
      setup: { name: 'Setup B', uses: uses(runner) },
      tests: { name: 'Tests', needs: 'setup', uses: uses(runner) },
    },
    [runner]: { run: {} },
  })
  const jobs = [
    successful('Platform / Setup A / run'),
    successful('Platform / Tests / run'),
    skipped('Platform / Setup B / run'),
  ]
  const result = await generateCiTopology(jobs, read)
  expect(result.needs['Platform / Tests / run']).toEqual(['Platform / Setup A / run'])
})

it('retains prerequisites through skipped dependencies without inventing an execution duration', async () => {
  const read = sources({ [root]: { approval: {}, optional: { needs: 'approval' }, report: { needs: 'optional', if: 'always()' } } })
  const result = await generateCiTopology([successful('approval'), skipped('optional'), successful('report')], read)
  expect(result.needs.report).toEqual(['approval'])
  expect(result.outOfScope.optional.expectedCount).toBe(1)
})

it('matches automatic matrix names only beneath their actual reusable context', async () => {
  const read = sources({ [root]: { compatibility: { strategy: { matrix } } } })
  expect((await generateCiTopology([successful('compatibility (ubuntu-latest, 22)')], read)).needs).toEqual({ 'compatibility (ubuntu-latest, 22)': [] })
})

it.each(['success', 'skipped'])('rejects unknown actual %s jobs', async (conclusion) => {
  const value = baseline()
  await expect(generateCiTopology([...value.jobs, { name: 'not in frozen source', status: 'completed', conclusion }], value.read)).rejects.toThrow(/Unknown actual/)
})

it('rejects duplicate executed rows and executed/skipped name collisions', async () => {
  const value = baseline()
  await expect(generateCiTopology([...value.jobs, value.jobs[0]], value.read)).rejects.toThrow(/Duplicate executed/)
  await expect(generateCiTopology([...value.jobs, skipped(value.jobs[0].name)], value.read)).rejects.toThrow(/Ambiguous executed/)
})

it('rejects missing dependency observations rather than assuming a condition was false', async () => {
  const read = sources({ [root]: { build: {}, test: { needs: 'build' } } })
  await expect(generateCiTopology([successful('test')], read)).rejects.toThrow(/Missing actual dependency evidence/)
})

it('rejects failed and incomplete jobs', async () => {
  const read = sources({ [root]: { test: {} } })
  await expect(generateCiTopology([{ name: 'test', status: 'completed', conclusion: 'failure' }], read)).rejects.toThrow(/successful or skipped/)
  await expect(generateCiTopology([{ name: 'test', status: 'in_progress', conclusion: null }], read)).rejects.toThrow(/successful or skipped/)
})

it('rejects source cycles, missing source dependencies and unsupported reusable references', async () => {
  await expect(generateCiTopology([successful('a')], sources({ [root]: { a: { needs: 'b' }, b: { needs: 'a' } } }))).rejects.toThrow(/needs cycle/)
  await expect(generateCiTopology([successful('a')], sources({ [root]: { a: { needs: 'absent' } } }))).rejects.toThrow(/Invalid frozen source needs/)
  await expect(generateCiTopology([successful('a')], sources({ [root]: { a: { uses: uses(root) } } }))).rejects.toThrow(/recursive frozen workflow/)
  await expect(generateCiTopology([successful('a')], sources({ [root]: { a: { uses: 'owner/repo/.github/workflows/test.yml@main' } } }))).rejects.toThrow(/non-local/)
})

it('rejects malformed or duplicate-key YAML and never treats expressions as source code', async () => {
  await expect(generateCiTopology([successful('a')], sources({ [root]: 'jobs:\n  a: {}\n  a: {}\n' }))).rejects.toThrow()
  const read = sources({ [root]: { a: { name: '${{ process.exit(1) }}' } } })
  expect((await generateCiTopology([successful('Rendered by GitHub')], read)).needs).toEqual({ 'Rendered by GitHub': [] })
})

it('preserves literal display-name keys without object prototype setters', async () => {
  const read = sources({ [root]: { test: { name: '__proto__' } } })
  const result = await generateCiTopology([successful('__proto__')], read)
  expect(Object.hasOwn(result.needs, '__proto__')).toBe(true)
  expect(Object.getOwnPropertyDescriptor(result.needs, '__proto__').value).toEqual([])
})
