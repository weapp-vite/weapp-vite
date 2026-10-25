import assert from 'node:assert/strict'
import { glob } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { verificationSuiteReportSchema } from '../../e2e/scripts/verification/validation.ts'
import { E2E_TARGET_FILE_ENV } from '../../e2e/utils/vitestTargetFile.ts'
import { runtimeScope } from './evidence.mjs'
import { localDocument, localWithin } from './localIo.mjs'
import { assertRuntimeCaseInventory, assertRuntimeTaskInventory, createRuntimeInventory } from './runtimeInventory.mjs'

export const localSuites = { 'runtime:headless': ['ide-headless-full'], 'runtime:full': ['full-regression'] }

function childSuite(task) {
  const script = task.args.findIndex(arg => /\/run-(?:sleep-inhibited-)?e2e-suite\.ts$/u.test(arg.replaceAll('\\', '/')))
  if (script !== -1) {
    return task.args[script + 1]
  }
  const hmr = task.args.findIndex(arg => arg.replaceAll('\\', '/').endsWith('/run-hmr-guard-suite.ts'))
  return hmr === -1 ? undefined : `hmr-guard:${task.args[hmr + 1]}`
}

function hmrTasks(root, name, manifest) {
  const groups = {
    'full': manifest.HMR_GUARD_STABLE_TESTS,
    'auto-import-vue-sfc': [manifest.HMR_GUARD_SPECIAL_CASES.autoImportVueSfc],
    'auto-routes-hmr': [manifest.HMR_GUARD_SPECIAL_CASES.autoRoutesHmr],
    'shared-chunks-auto': [manifest.HMR_GUARD_SPECIAL_CASES.sharedChunksAuto],
  }
  assert(groups[name], 'Local benchmark encountered an unknown formal HMR child suite')
  return [...manifest.HMR_GUARD_UTILITY_TESTS, ...groups[name]].map((file) => {
    const label = path.relative(path.join(root, 'e2e'), file).replaceAll('\\', '/')
    return { label, command: 'pnpm', args: ['vitest', 'run', '--config', path.join(root, 'e2e/vitest.e2e.ci.config.ts')], env: { [E2E_TARGET_FILE_ENV]: label } }
  })
}

/** 冻结正式 suite 原始任务定义；仅严格 IDE 原入口要求 DOM 清单。 */
export async function freezeLocalSuites(root, executionTopology) {
  const [manifest, definitions, hmr] = await Promise.all([
    import(pathToFileURL(path.join(root, 'e2e/scripts/e2e-suite-manifest.ts')).href),
    import(pathToFileURL(path.join(root, 'e2e/scripts/verification/plan.ts')).href),
    import(pathToFileURL(path.join(root, 'e2e/scripts/hmr-guard-manifest.ts')).href),
  ])
  const suites = {}
  const pending = Object.values(localSuites).flat()
  for (const name of pending) {
    assert(!suites[name], 'Local formal suite hierarchy contains a duplicate or cycle')
    const tasks = name.startsWith('hmr-guard:') ? hmrTasks(root, name.slice('hmr-guard:'.length), hmr) : await manifest.getSuiteTasks(name, { topology: executionTopology?.id })
    suites[name] = tasks.map(task => ({ label: task.label, definitionHash: definitions.taskDefinitionHash(task), outOfScopeReason: task.outOfScopeReason, acceptanceTemplates: task.acceptanceTemplates, childSuite: childSuite(task), caseEvidence: task.args.includes('vitest') || Boolean(task.acceptanceTemplates) }))
    pending.push(...suites[name].map(task => task.childSuite).filter(Boolean))
  }
  suites['ide-full'] = (await createRuntimeInventory(root, 'ide-full', executionTopology)).map(task => ({ ...suites['ide-full'].find(item => item.label === task.label), ...task }))
  return suites
}

export async function readLocalSuites(root, receipt, stdout, frozen, identity, raw) {
  const expected = localSuites[receipt.taskId]
  assert(expected, 'Unexpected local runtime entry')
  const markers = [...stdout.matchAll(/^\[e2e-suite-report\] index=(\S+)/gmu)].map(match => match[1])
  assert(markers.length === expected.length, 'Local runtime is missing or duplicating formal root suite markers')
  const reports = []
  const seen = new Set(raw.suites.map(document => document.path))
  async function visit(reference, name, start, end) {
    const marker = reference.replace(/\.md$/u, '.json')
    assert(/^docs\/reports\/\d{4}-\d{2}-\d{2}-\d{6}-[\w.-]+-suite-report\/index\.json$/u.test(marker), 'Local runtime marker is not an owned formal report')
    assert(!seen.has(marker) && !reports.some(item => item.name === name), 'Local runtime suite hierarchy contains a duplicate or cycle')
    seen.add(marker)
    const document = await localDocument(root, marker, 'docs/reports/')
    raw.suites.push(document)
    const report = verificationSuiteReportSchema.parse(document.value)
    if (identity.executionTopology) {
      assert.deepEqual(report.execution.executionTopology, identity.executionTopology, 'Local child suite topology differs from its frozen capture')
    }
    assert(report.suiteName?.replace(/^e2e:/u, '') === name && frozen[name], 'Local runtime child suite belongs to another formal task')
    assert(report.runId === identity.runId && report.commitSha === identity.commitSha && report.workingTreeDirty === false
      && report.coverage === 'complete' && report.acceptance === 'passed' && report.execution.scope === 'full'
      && report.execution.status === 'passed' && report.strict === (name === 'ide-full')
      && Array.isArray(report.excludedProjects) && report.excludedProjects.length === 0, 'Local runtime suite is partial, failed or belongs to another run')
    assert(report.execution.profile.os === process.platform && report.execution.profile.arch === process.arch
      && report.execution.profile.nodeMajor === Number(process.versions.node.split('.')[0]) && report.execution.profile.runnerClass === 'local'
      && report.execution.profile.platform === 'weapp'
      && report.execution.profile.provider === (name === 'ide-full' ? 'devtools' : name === 'ide-headless-full' ? 'headless' : 'none'), 'Local runtime suite resource identity differs from the actual host')
    localWithin(report.execution.startedAt, start, end)
    localWithin(report.execution.finishedAt, Date.parse(report.execution.startedAt), end)
    localWithin(report.generatedAt, Date.parse(report.execution.finishedAt), end)
    assertRuntimeTaskInventory(report, frozen[name])
    reports.push({ name, report, document })
    for (const task of report.tasks) {
      const planned = frozen[name].find(item => item.label === task.label)
      if (task.status !== 'out-of-scope') {
        assert(task.status === 'passed' && task.exitCode === 0 && task.durationMs > 0
          && task.definitionHash === planned.definitionHash, 'Local runtime task did not pass its frozen definition')
      }
      const children = task.artifacts.filter(item => item.kind === 'suite-report')
      assert(children.length === (planned.childSuite && !planned.outOfScopeReason ? 1 : 0), 'Local runtime is missing or adding formal child suite artifacts')
      for (const child of children) {
        await visit(child.indexPath, planned.childSuite, Date.parse(report.execution.startedAt), Date.parse(report.execution.finishedAt))
      }
      if (name !== 'ide-full') {
        for (const artifact of task.artifacts.filter(item => item.kind === 'dom-acceptance-report')) {
          const dom = await localDocument(root, artifact.indexPath, `docs/reports/dom-acceptance/${identity.runId}/`)
          assert(dom.value.runId === identity.runId && dom.value.commitSha === identity.commitSha && dom.value.taskLabel === task.label, 'Local nonstrict DOM document has another invocation identity')
          localWithin(dom.value.startedAt, Date.parse(report.execution.startedAt), Date.parse(report.execution.finishedAt))
          localWithin(dom.value.finishedAt, Date.parse(dom.value.startedAt), Date.parse(report.execution.finishedAt))
          raw.acceptance.push(dom)
        }
      }
    }
  }
  for (const [index, marker] of markers.entries()) {
    await visit(marker, expected[index], Date.parse(receipt.startedAt), Date.parse(receipt.finishedAt))
  }
  return reports
}

/** 只对原本 strict 的真实 IDE suite 使用严格 DOM；其他 suite 保留真实 Vitest 原始状态。 */
export async function localIdeEvidence(root, suite, frozen, identity, receipt, raw) {
  assert(suite.report.strict === true && suite.report.execution.profile.provider === 'devtools', 'Local complete IDE suite lost strict DevTools acceptance')
  const documents = []
  const prefix = `docs/reports/dom-acceptance/${identity.runId}/`
  for (const task of suite.report.tasks) {
    const taskDocuments = []
    for (const artifact of task.artifacts.filter(item => item.kind === 'dom-acceptance-report')) {
      const document = await localDocument(root, artifact.indexPath, prefix)
      raw.acceptance.push(document)
      assert(document.value.taskLabel === task.label && document.value.environment.nodeVersion === receipt.nodeVersion, 'Local IDE evidence has another task or Node identity')
      localWithin(document.value.startedAt, Date.parse(receipt.startedAt), Date.parse(receipt.finishedAt))
      localWithin(document.value.finishedAt, Date.parse(document.value.startedAt), Date.parse(receipt.finishedAt))
      documents.push(document)
      taskDocuments.push(document.value)
    }
    assertRuntimeCaseInventory(frozen['ide-full'].find(item => item.label === task.label), taskDocuments, 'devtools')
  }
  const scope = runtimeScope(suite.report, documents.map(document => document.value))
  const ideVersions = new Set()
  const sdkVersions = new Map()
  for (const item of documents.flatMap(document => document.value.cases)) {
    if (!item.acceptance) {
      continue
    }
    ideVersions.add(item.acceptance.runtime.ideVersion)
    const { fixture, runtime } = item.acceptance
    assert(!sdkVersions.has(fixture) || sdkVersions.get(fixture) === runtime.baseLibraryVersion, 'Local IDE SDK changed during full invocation')
    sdkVersions.set(fixture, runtime.baseLibraryVersion)
  }
  assert(ideVersions.size === 1 && [...ideVersions][0], 'Local full benchmark requires one actual IDE version')
  return { scope, ideVersion: [...ideVersions][0], baseLibraryVersion: JSON.stringify([...sdkVersions].sort()) }
}

export async function assertAllLocalDom(root, identity, documents) {
  const prefix = `docs/reports/dom-acceptance/${identity.runId}/`
  const files = []
  for await (const file of glob('**/*.json', { cwd: path.join(root, prefix) })) {
    files.push(`${prefix}${file.replaceAll('\\', '/')}`)
  }
  assert.deepEqual(files.sort(), documents.map(item => item.path).sort(), 'Local full benchmark must retain every generated DOM document')
}
