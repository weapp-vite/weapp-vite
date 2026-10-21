import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../../e2e/scripts/domAcceptanceReport/helpers.ts'
import { createBuildArtifactManifest } from '../buildArtifact/index.mjs'
import { resolveVerificationTopology, topologyEnvironment } from '../verification/topology.ts'
import { localDigest, localSave } from './localIo.mjs'

/** 测试专用的完整原始证据树；每个子凭据均可单独篡改以验证拒绝边界。 */
export async function localEvidenceFixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'local-evidence-')))
  const directory = path.join(root, '.tmp/run')
  await mkdir(directory, { recursive: true })
  const base = Date.now()
  const time = offset => new Date(base + offset).toISOString()
  const executionTopology = resolveVerificationTopology()
  const identity = { executionTopology, runId: 'fixture-run', commitSha: 'a'.repeat(40), fingerprint: 'b'.repeat(64), packageManager: 'pnpm@12.11.2' }
  const tasks = [
    { id: 'build', kind: 'build', evidence: 'turbo-summary', dependencies: [] },
    { id: 'tests', kind: 'test', dependencies: ['build'] },
    { id: 'runtime:headless', kind: 'runtime', dependencies: ['tests'] },
    { id: 'runtime:full', kind: 'runtime', dependencies: ['runtime:headless'] },
  ].map(task => ({ ...task, command: 'pnpm', args: ['run', task.id], directory: '.', env: topologyEnvironment(executionTopology) }))
  const plan = { version: 1, executionTopology, mode: 'full', selection: 'shadow', fingerprint: 'c'.repeat(64), tasks, selected: ['library'], remaining: [] }
  const report = { version: 1, executionTopology, mode: 'full', fingerprint: plan.fingerprint, startedAt: time(1), status: 'passed', remaining: [], results: tasks.map(task => ({ id: task.id, status: 'passed', exitCode: 0, durationMs: 10, execution: 'actual' })) }
  await localSave(path.join(directory, 'verification/plan.json'), plan)
  await localSave(path.join(directory, 'verification/report.json'), report)
  await mkdir(path.join(root, 'packages/library/dist'), { recursive: true })
  await writeFile(path.join(root, 'packages/library/dist/index.js'), 'export const artifact = true\n')
  const artifacts = createBuildArtifactManifest(root, { BUILD_ARTIFACT_EXPECTED_COMMIT: identity.commitSha, BUILD_ARTIFACT_PACKAGE_MANAGER: identity.packageManager })
  await localSave(path.join(directory, 'artifacts/latest.json'), artifacts)
  const inventories = Object.fromEntries(['ide-headless-full', 'ci', 'web', 'ide-full', 'full-regression'].map(name => [name, [{ label: name, definitionHash: 'd'.repeat(64), caseEvidence: name !== 'full-regression' }]]))
  inventories['full-regression'] = ['ci', 'web', 'ide-full'].map(childSuite => ({ label: childSuite === 'ide-full' ? 'e2e:ide:full' : `e2e:${childSuite}`, childSuite, definitionHash: 'd'.repeat(64) }))
  inventories.ci.push({ label: 'hmr-guard:full', childSuite: 'hmr-guard:full', definitionHash: 'd'.repeat(64), caseEvidence: false })
  inventories['hmr-guard:full'] = [{ label: 'ci/hmr-observed.test.ts', definitionHash: 'd'.repeat(64), caseEvidence: true }]
  const utility = { label: 'utils/hmr-shared.test.ts', definitionHash: 'd'.repeat(64), caseEvidence: true }
  inventories.ci.push(utility)
  inventories['hmr-guard:full'].push(utility)
  inventories['ide-full'][0].cases = [{ file: 'e2e/ide/scene.test.ts', name: 'renders' }]
  const profile = { os: process.platform, arch: process.arch, nodeMajor: Number(process.versions.node.split('.')[0]), runnerClass: 'local', platform: 'weapp', provider: 'devtools' }
  const save = async (file, value) => {
    await localSave(path.join(root, file), value)
    return file
  }
  const suitePath = name => `docs/reports/2026-10-19-000000-${name.replaceAll(':', '-')}-suite-report/index.json`
  const suite = async (name, entries, started = 3, finished = 8) => {
    const value = { schemaVersion: 2, toolVersion: 1, ...identity, workingTreeDirty: false, suiteName: name.startsWith('hmr-guard:') ? name : `e2e:${name}`, generatedAt: time(finished), strict: name === 'ide-full', coverage: 'complete', acceptance: 'passed', excludedProjects: [], execution: { executionTopology, scope: 'full', status: 'passed', profile: { ...profile, provider: name === 'ide-headless-full' ? 'headless' : name === 'ide-full' ? 'devtools' : 'none' }, assignedTasks: entries.map(item => item.label), startedAt: time(started), finishedAt: time(finished) }, tasks: entries.map(item => ({ label: item.label, definitionHash: 'd'.repeat(64), status: 'passed', exitCode: 0, durationMs: 2, artifacts: item.artifacts ?? [] })), summary: { taskCount: entries.length, plannedCount: entries.length, executedCount: entries.length, passedCount: entries.length, failedCount: 0, blockedCount: 0, skippedCount: 0, notExecutedCount: 0, outOfScopeCount: 0, artifactCount: entries.reduce((sum, item) => sum + (item.artifacts?.length ?? 0), 0) } }
    await save(suitePath(name), value)
    return value
  }
  const cases = [evaluateAcceptanceCase({ id: 'case', file: 'e2e/ide/scene.test.ts', name: 'renders', state: 'passed', startedAt: base + 4, finishedAt: base + 6, acceptance: { fixture: 'e2e-apps/fixture', provider: 'devtools', runtime: { ideVersion: 'stable-fixture', baseLibraryVersion: 'sdk-fixture' }, checkpoints: [{ id: 'mount', route: '/pages/index/index', action: 'launch', nodes: [{ selector: '.title', text: 'Ready' }] }], evidence: [{ id: 'mount', route: 'pages/index/index', source: 'devtools-page-frame', capturedAt: time(5), nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }] } })]
  const domPath = `docs/reports/dom-acceptance/${identity.runId}/ide.json`
  await save(domPath, { schemaVersion: 1, runId: identity.runId, invocationId: 'dom', commitSha: identity.commitSha, taskLabel: 'ide-full', template: null, provider: 'devtools', strict: true, environment: { nodeVersion: process.version, ideVersion: 'stable-fixture', baseLibraryVersion: 'sdk-fixture' }, startedAt: time(3), finishedAt: time(8), status: 'passed', errors: [], cases, summary: summarizeAcceptanceCases(cases) })
  await suite('ide-headless-full', [{ label: 'ide-headless-full' }])
  await suite('hmr-guard:full', [{ label: 'ci/hmr-observed.test.ts' }, utility], 4, 6)
  await suite('ci', [{ label: 'ci' }, { label: 'hmr-guard:full', artifacts: [{ kind: 'suite-report', indexPath: suitePath('hmr-guard:full').replace(/\.json$/u, '.md') }] }, utility], 3, 7)
  await suite('web', [{ label: 'web' }])
  await suite('ide-full', [{ label: 'ide-full', artifacts: [{ kind: 'dom-acceptance-report', indexPath: domPath }] }])
  await suite('full-regression', inventories['full-regression'].map(({ label, childSuite }) => ({ label, artifacts: [{ kind: 'suite-report', indexPath: suitePath(childSuite).replace(/\.json$/u, '.md') }] })))
  for (const task of tasks) {
    const invocationId = task.id.replaceAll(':', '-')
    const receipt = { schemaVersion: 1, executionTopology, effectiveTopology: topologyEnvironment(executionTopology), runId: identity.runId, taskId: task.id, invocationId, sourceFingerprint: identity.fingerprint, nodeVersion: process.version, command: task.command, args: task.args, effectiveArgs: task.args, directory: '.', startedAt: time(2), finishedAt: time(9), exitCode: 0, cancelled: false, signal: null }
    let stdout = ''
    if (task.id === 'build') {
      receipt.artifacts = artifacts
      receipt.dryGraph = { tasks: [{ taskId: 'library#build', command: 'node build.js', hash: 'build-hash' }] }
      receipt.summary = { value: { tasks: [{ taskId: 'library#build', command: 'node build.js', hash: 'build-hash', cache: { status: 'MISS' }, execution: { startTime: base + 3, exitCode: 0 } }] } }
      receipt.leaves = [['library#build', 'node build.js', 'actual']]
    }
    else {
      receipt.preparedArtifacts = { value: artifacts }
      const names = task.id === 'tests' ? ['tests'] : task.id === 'runtime:headless' ? ['ide-headless-full'] : ['ci', 'web', 'ide-full', 'hmr', 'utility-direct', 'utility-hmr']
      for (const name of names) {
        const source = name === 'ide-full' ? 'e2e/ide/scene.test.ts' : name === 'hmr' ? 'e2e/ci/hmr-observed.test.ts' : name.startsWith('utility-') ? 'e2e/utils/hmr-shared.test.ts' : `packages/library/${name}.test.ts`
        const item = { file: source, projectName: '', name: 'renders', mode: 'run' }
        const file = `.tmp/run/vitest/${name}.json`
        const nested = name === 'hmr' || name === 'utility-hmr'
        await save(file, { schemaVersion: 1, runId: identity.runId, taskId: task.id, taskInvocation: invocationId, invocationId: name, runtimeTaskLabel: name === 'hmr' ? 'ci/hmr-observed.test.ts' : name.startsWith('utility-') ? utility.label : name, template: null, nodeVersion: process.version, startedAt: time(nested ? 4 : 3), finishedAt: time(nested ? 6 : 7), plannedFiles: [{ file: source, projectName: '' }], files: [{ file: source, projectName: '' }], collected: [item], cases: [{ ...item, state: 'passed' }], errors: [], reason: 'passed', passed: true })
        stdout += `[verification-local-case] index=${file}\n`
      }
      for (const name of task.id === 'runtime:headless' ? ['ide-headless-full'] : task.id === 'runtime:full' ? ['full-regression'] : []) {
        stdout += `[e2e-suite-report] index=${suitePath(name).replace(/\.json$/u, '.md')}\n`
      }
    }
    for (const [name, bytes] of [['stdout', stdout], ['stderr', '']]) {
      const file = `.tmp/run/tasks/${invocationId}/${name}.log`
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), bytes)
      receipt[name] = { path: file, digest: localDigest(bytes) }
    }
    await save(`.tmp/run/tasks/${invocationId}/receipt.json`, receipt)
  }
  return { root, directory, plan, report, inventories, identity, suitePath, start: base, end: base + 10, raw: { tasks: [], vitest: [], lint: [], suites: [], acceptance: [] } }
}
