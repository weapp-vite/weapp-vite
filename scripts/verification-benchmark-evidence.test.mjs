import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../e2e/scripts/domAcceptanceReport/helpers.ts'
import { artifactSnapshot, inputDigest, runtimeScope } from './verificationBenchmark/evidence.mjs'

const directories = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

function fixture() {
  const cases = [evaluateAcceptanceCase({
    id: 'case-a',
    file: 'e2e/ide/example.test.ts',
    name: 'mounts',
    state: 'passed',
    startedAt: Date.parse('2026-10-19T00:00:00Z'),
    finishedAt: Date.parse('2026-10-19T00:00:02Z'),
    acceptance: {
      fixture: 'e2e-apps/base',
      provider: 'headless',
      checkpoints: [{ id: 'mounted', route: '/pages/index/index', action: 'launch', nodes: [{ selector: '.title', text: 'Ready' }] }],
      evidence: [{ id: 'mounted', route: 'pages/index/index', source: 'headless-logical-tree', capturedAt: '2026-10-19T00:00:01Z', nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
    },
  })]
  const acceptance = {
    schemaVersion: 1,
    runId: 'run',
    invocationId: 'invocation',
    commitSha: 'commit',
    taskLabel: 'task',
    template: null,
    provider: 'headless',
    strict: true,
    environment: { nodeVersion: 'test', ideVersion: null, baseLibraryVersion: null },
    startedAt: '2026-10-19T00:00:00Z',
    finishedAt: '2026-10-19T00:00:02Z',
    status: 'passed',
    errors: [],
    cases,
    summary: summarizeAcceptanceCases(cases),
  }
  const report = {
    runId: 'run',
    commitSha: 'commit',
    workingTreeDirty: false,
    strict: true,
    coverage: 'complete',
    acceptance: 'passed',
    execution: { scope: 'full', status: 'passed', profile: { provider: 'headless' }, assignedTasks: ['task'] },
    tasks: [{ label: 'task', status: 'passed', exitCode: 0, durationMs: 2000, artifacts: [{ kind: 'dom-acceptance-report' }] }],
  }
  return { report, acceptance }
}

it('uses the existing strict DOM validator and compares logical checkpoints across file grouping changes', () => {
  const { report, acceptance } = fixture()
  const scope = runtimeScope(report, [acceptance])
  expect(scope[0][0]).toBe('e2e-apps/base:mounts')
  expect(runtimeScope(report, [{ ...acceptance, cases: acceptance.cases.map(value => ({ ...value, id: 'aggregate-case', file: 'e2e/ide/aggregate.test.ts' })) }])).toEqual(scope)
  expect(() => runtimeScope({ ...report, coverage: 'partial' }, [acceptance])).toThrow(/complete/)
  expect(() => runtimeScope(report, [{ ...acceptance, commitSha: 'other' }])).toThrow(/identity/)
  expect(() => runtimeScope(report, [{ ...acceptance, cases: acceptance.cases.map(value => ({ ...value, acceptance: { ...value.acceptance, evidence: [] } })) }])).toThrow(/incomplete/)
})

it('retains declared provider skips in scope while rejecting skipped planned checkpoints', () => {
  const { report, acceptance } = fixture()
  const sourceSkip = evaluateAcceptanceCase({ id: 'provider-only', file: 'e2e/ide/example.test.ts', name: 'only for another provider', state: 'skipped' })
  acceptance.cases.push(sourceSkip)
  acceptance.summary = summarizeAcceptanceCases(acceptance.cases)
  const scope = runtimeScope(report, [acceptance])
  expect(scope).toContainEqual(['source-skip::e2e/ide/example.test.ts:only for another provider', [], 'skipped'])
  expect(scope).not.toEqual(runtimeScope(report, [{ ...acceptance, cases: acceptance.cases.slice(0, 1), summary: summarizeAcceptanceCases(acceptance.cases.slice(0, 1)) }]))
  acceptance.cases[0] = evaluateAcceptanceCase({ ...acceptance.cases[0], state: 'skipped' })
  acceptance.summary = summarizeAcceptanceCases(acceptance.cases)
  expect(() => runtimeScope(report, [acceptance])).toThrow(/incomplete/)
})

it('binds framework inputs to both stable relative paths and exact bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verification-input-'))
  directories.push(root)
  await writeFile(path.join(root, 'fixture.js'), 'first')
  const first = await inputDigest(root, ['fixture.js'])
  const bytes = await readFile(path.join(root, 'fixture.js'))
  await writeFile(path.join(root, 'fixture.js'), 'second')
  expect(await inputDigest(root, ['fixture.js'])).not.toBe(first)
  await writeFile(path.join(root, 'fixture.js'), bytes)
  expect(await inputDigest(root, ['fixture.js'])).toBe(first)
  await expect(inputDigest(root, ['../outside'])).rejects.toThrow(/relative/)
  await expect(inputDigest(root, ['C:/outside'])).rejects.toThrow(/relative/)
  await expect(inputDigest(root, ['fixture.js', 'fixture.js'])).rejects.toThrow(/duplicated/)
})

it('binds the full artifact inventory so added and removed chunks invalidate a sampling round', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verification-artifacts-'))
  directories.push(root)
  await mkdir(path.join(root, 'packages/library/dist'), { recursive: true })
  await writeFile(path.join(root, 'packages/library/dist/index.mjs'), 'prepared')
  const first = await artifactSnapshot(root, ['packages/library/dist'])
  await writeFile(path.join(root, 'packages/library/dist/new.mjs'), 'new')
  expect(await artifactSnapshot(root, ['packages/library/dist'])).not.toEqual(first)
  await rm(path.join(root, 'packages/library/dist/new.mjs'))
  expect(await artifactSnapshot(root, ['packages/library/dist'])).toEqual(first)
  await expect(artifactSnapshot(root, ['../outside'])).rejects.toThrow(/explicit/)
  await expect(artifactSnapshot(root, ['packages/library/dist', 'packages/library/dist'])).rejects.toThrow(/Invalid/)
})
