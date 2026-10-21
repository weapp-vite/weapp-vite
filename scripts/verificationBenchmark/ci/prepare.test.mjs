import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../../../e2e/scripts/domAcceptanceReport/helpers.ts'
import { classifyCoverageScope, coverageScopePolicy } from '../../verificationTelemetry/coveragePolicy.mjs'
import { coverageLogicalScope } from '../../verificationTelemetry/logicalCoverage.mjs'
import { collectCiEvidence } from '../ci.mjs'
import { fixture, time } from './fixture.mjs'
import { isRuntimeAcceptanceFile, prepareCiBenchmark } from './prepare.mjs'

function discoveryFixture() {
  const value = fixture()
  const shard = value.files['coverage-shard-1']['manifest.json']
  shard.cases = [{ ...shard.inventory[0], name: 'works', state: 'passed' }]
  Object.assign(value.immutableFiles, {
    'package.json': JSON.stringify({ scripts: { build: 'build', verify: 'verify' } }),
    'pnpm-lock.yaml': 'lockfileVersion: 9',
    'pnpm-workspace.yaml': 'packages: [packages/*]',
    'turbo.json': JSON.stringify({ tasks: { build: { dependsOn: ['^build'] } } }),
    'vitest.coverage.ts': 'export const thresholds = { lines: 100 }',
    '.github/workflows/ci-pr.yml': `jobs:
  approval:
    name: Approve PR checks
  build:
    needs: approval
  tests:
    needs: build
  lint:
    needs: approval
`,
  })
  for (const name of ['coverage-plan', 'coverage-shard-1', 'coverage-complete']) {
    const actual = name === 'coverage-shard-1' ? 'coverage-shard-linux-node-24-1' : `${name}-linux-node-24`
    value.files[actual] = value.files[name]
    delete value.files[name]
    value.artifacts.find(artifact => artifact.name === name).name = actual
  }
  return value
}

function runtimeDiscoveryFixture() {
  const value = discoveryFixture()
  const invocationId = '0277f749-f8a7-4250-a088-3ba889333b27'
  const acceptancePath = `dom-acceptance/run-id/${invocationId}.json`
  const cases = [evaluateAcceptanceCase({
    id: 'case',
    file: 'e2e/ide/render.runtime.test.ts',
    name: 'renders',
    state: 'passed',
    startedAt: Date.parse(time(18)),
    finishedAt: Date.parse(time(19)),
    acceptance: {
      fixture: 'e2e-apps/base',
      provider: 'headless',
      checkpoints: [{ id: 'mount', route: '/pages/index/index', action: 'launch', nodes: [{ selector: '.title', text: 'Ready' }] }],
      evidence: [{ id: 'mount', route: 'pages/index/index', source: 'headless-logical-tree', capturedAt: time(19), nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
    },
  })]
  const acceptance = {
    schemaVersion: 1,
    runId: 'run-id',
    invocationId,
    commitSha: value.context.checkoutSha,
    taskLabel: 'runtime',
    template: null,
    provider: 'headless',
    strict: true,
    environment: { nodeVersion: 'v24.18.0', ideVersion: null, baseLibraryVersion: null },
    startedAt: time(18),
    finishedAt: time(19),
    status: 'passed',
    errors: [],
    cases,
    summary: summarizeAcceptanceCases(cases),
  }
  const suite = {
    runId: acceptance.runId,
    commitSha: value.context.checkoutSha,
    workingTreeDirty: false,
    strict: true,
    coverage: 'complete',
    acceptance: 'passed',
    execution: { scope: 'full', status: 'passed', profile: { os: 'linux', arch: 'x64', nodeMajor: 24, provider: 'headless' }, assignedTasks: ['runtime'] },
    tasks: [{ label: 'runtime', durationMs: 1000, exitCode: 0, status: 'passed', artifacts: [{ kind: 'dom-acceptance-report', indexPath: `docs/reports/${acceptancePath}` }] }],
  }
  value.files['ide-dom-headless-linux-node-24'] = {
    'dated-suite-report/index.json': suite,
    [acceptancePath]: acceptance,
    'dom-acceptance/run-id/task-resources/ide-dom-headless/0001.json': { protocol: 'weapp-vite-ide-task-resources-v1', status: 'passed' },
  }
  value.files['miniapp-linux-node-24-weapp-build'] = { '.tmp/build-artifact-manifest.json': { schemaVersion: 2, commit: value.context.checkoutSha, os: 'linux', arch: 'x64', toolchain: { nodeVersion: 'v24.18.0', actualPackageManager: 'pnpm@11.0.0' } } }
  for (const name of Object.keys(value.files).filter(name => !value.artifacts.some(artifact => artifact.name === name))) {
    value.artifacts.push({ ...value.artifacts[0], id: 100 + value.artifacts.length, name })
  }
  return { ...value, acceptancePath, acceptance, suite }
}

it('recognizes per-invocation DOM acceptance reports emitted by the headless runner', () => {
  expect(isRuntimeAcceptanceFile('dom-acceptance/run-id/0277f749-f8a7-4250-a088-3ba889333b27.json')).toBe(true)
  expect(isRuntimeAcceptanceFile('dom-acceptance/run-id/index.json')).toBe(true)
  expect(isRuntimeAcceptanceFile('dom-acceptance/run-id/report.txt')).toBe(false)
  expect(isRuntimeAcceptanceFile('suite-report/index.json')).toBe(false)
  expect(isRuntimeAcceptanceFile('dom-acceptance/run-id/task-resources/suite/0001.json')).toBe(false)
  expect(isRuntimeAcceptanceFile('dom-acceptance/run-id/task-resources/suite/0001.wrapper-events.jsonl')).toBe(false)
  expect(isRuntimeAcceptanceFile('dom-acceptance/run-id.json')).toBe(false)
})

it('prepares reusable UUID report selectors and collects the same complete runtime evidence without resource diagnostics', async () => {
  const value = runtimeDiscoveryFixture()
  const result = await prepareCiBenchmark(value.repository, 123, { profile: value.contract.profile, cohort: value.configuration.cohort }, value.execute)
  expect(result.gaps.filter(gap => gap.id.startsWith('runtime'))).toEqual([])
  const runtime = result.contract.evidence.find(evidence => evidence.kind === 'runtime')
  expect(runtime).toMatchObject({ id: 'runtime-linux-node-24', acceptance: [{ artifact: 'ide-dom-headless-linux-node-24', filePattern: '**/dom-acceptance/*/*.json', expectedCount: 1 }] })
  expect(runtime.scope).toHaveLength(1)
  value.contract.evidence = result.contract.evidence
  const collected = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(collected.sample?.complete).toBe(true)
  expect(collected.evidence.execution.inventories.find(entry => entry.kind === 'runtime')?.scope).toEqual(runtime.scope)

  const nextInvocationId = 'a75d6ca4-74c0-4b70-9384-a223e882d264'
  const nextAcceptancePath = `dom-acceptance/run-id/${nextInvocationId}.json`
  const files = value.files['ide-dom-headless-linux-node-24']
  delete files[value.acceptancePath]
  files[nextAcceptancePath] = { ...value.acceptance, invocationId: nextInvocationId }
  value.suite.tasks[0].artifacts[0].indexPath = `docs/reports/${nextAcceptancePath}`
  expect((await collectCiEvidence(value.repository, 123, value.configuration, value.execute)).sample?.complete).toBe(true)
  expect(value.downloads.every(filename => !existsSync(path.dirname(filename)))).toBe(true)
})

it('prepares a reviewable immutable input/topology contract using actual successful evidence', async () => {
  const value = discoveryFixture()
  const result = await prepareCiBenchmark(value.repository, 123, { profile: value.contract.profile, cohort: value.configuration.cohort }, value.execute)
  expect(result).toMatchObject({ kind: 'ci-benchmark-preparation', formalSample: false, configuration: { identity: value.configuration.identity }, contract: { draft: true, needs: value.configuration.needs } })
  expect(result.contract.evidence).toHaveLength(1)
  expect(result.contract.evidence[0]).toMatchObject({ kind: 'coverage', scopeLevel: 'audited-cases', scopePolicy: coverageScopePolicy, scope: classifyCoverageScope(coverageLogicalScope(value.files['coverage-plan-linux-node-24']['plan.json'], [value.files['coverage-shard-linux-node-24-1']['manifest.json']])) })
  expect(result.receipt.inputs.inventory.map(entry => entry[0])).toContain('packages/framework/src/index.ts')
  expect(result.receipt.inputs.projectedFields['package.json']).toContain('scripts.verify')
  expect(result.gaps.map(gap => gap.id)).toContain('review')
  expect(result.gaps.map(gap => gap.id)).toContain('runtime')
  expect(value.downloads.every(directory => !existsSync(path.dirname(directory)))).toBe(true)
})

it('records partial discovery evidence as a gap and still removes its downloads', async () => {
  const value = discoveryFixture()
  value.files['coverage-complete-linux-node-24']['shard-verdict.json'].status = 'failed'
  const result = await prepareCiBenchmark(value.repository, 123, { profile: value.contract.profile, cohort: value.configuration.cohort }, value.execute)
  expect(result.contract.evidence).toEqual([])
  expect(result.gaps.some(gap => gap.reason.includes('threshold'))).toBe(true)
  expect(value.downloads.every(directory => !existsSync(path.dirname(directory)))).toBe(true)
})

it('does not accept a committed discovery draft as a formal sample', async () => {
  const value = fixture()
  value.contract.draft = true
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/contract/u)
})

it('discovers one descriptor per current artifact while retaining old attempt metadata', async () => {
  const value = discoveryFixture()
  const artifact = value.artifacts.find(artifact => artifact.name.startsWith('coverage-plan-'))
  value.artifacts.push({ ...artifact, id: 99, created_at: time(-1), expired: true })
  const result = await prepareCiBenchmark(value.repository, 123, { profile: value.contract.profile, cohort: value.configuration.cohort }, value.execute)
  expect(result.contract.evidence.filter(evidence => evidence.kind === 'coverage')).toHaveLength(1)
  expect(result.receipt.artifactInventory).toHaveLength(5)
  expect(result.receipt.downloadedArtifacts.some(artifact => artifact.id === 99)).toBe(false)
})
