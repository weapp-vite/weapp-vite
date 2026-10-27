import assert from 'node:assert/strict'
import { glob } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createBuildArtifactManifest, verifyBuildArtifactManifest } from '../buildArtifact/index.mjs'
import { redactReport } from '../verification/report.ts'
import { assertVerificationTopology, logicalTopologyCaseFile, topologyEnvironment } from '../verification/topology.ts'
import { classifyCoverageScope } from '../verificationTelemetry/coveragePolicy.mjs'
import { localDocument, localRelative, localText, localWithin } from './localIo.mjs'
import { validateLocalVitest } from './localReporter.mjs'
import { assertAllLocalDom, localIdeEvidence, localSuites, readLocalSuites } from './localRuntime.mjs'
import { validateLocalTurbo } from './localTurbo.mjs'

/** 验证 full 原始顶层报告，partial 与缺失任务不能包装为完整样本。 */
export function validateLocalFull(plan, report, frozen) {
  assertVerificationTopology(frozen.executionTopology)
  assert.deepEqual(plan.executionTopology, frozen.executionTopology, 'Local full plan topology changed')
  assert.deepEqual(report.executionTopology, frozen.executionTopology, 'Local full report topology changed')
  assert(plan.mode === 'full' && report.mode === 'full' && report.status === 'passed'
    && report.version === 1 && plan.fingerprint === frozen.fingerprint && report.fingerprint === frozen.fingerprint
    && plan.remaining.length === 0 && report.remaining.length === 0, 'Local benchmark needs an actual complete full verification report')
  const semantics = value => ({ version: value.version, fingerprint: value.fingerprint, mode: value.mode, selection: value.selection, executionTopology: value.executionTopology, tasks: value.tasks, selected: value.selected, remaining: value.remaining })
  assert.deepEqual(semantics(plan), semantics(frozen), 'Local verification plan changed after freezing')
  const planned = plan.tasks.map(task => task.id).sort()
  assert(planned.length && new Set(planned).size === planned.length, 'Local full plan has empty or duplicate tasks')
  assert.deepEqual(report.results.map(item => item.id).sort(), planned, 'Local full report is missing or duplicating tasks')
  for (const result of report.results) {
    assert(result.status === 'passed' && result.exitCode === 0 && result.durationMs > 0
      && ['actual', 'cached', 'mixed'].includes(result.execution), 'Local full task did not actually pass')
  }
}

async function filesUnder(root, directory, pattern) {
  const files = []
  for await (const file of glob(pattern, { cwd: directory })) {
    files.push(localRelative(root, path.join(directory, file)))
  }
  return files.sort()
}

async function taskLog(root, reference, prefix) {
  const document = await localText(root, reference.path, prefix)
  assert(document.digest === reference.digest, 'Local task log changed after execution')
  return document.value
}

/** 逐一绑定本轮任务、实际文件/case、Turbo 叶子与完整 runtime 报告层级。 */
export async function collectLocalEvidence(root, directory, frozen, inventories, identity, start, end, raw) {
  const prefix = `${localRelative(root, directory)}/`
  raw.plan = await localDocument(root, path.join(directory, 'verification/plan.json'), prefix)
  raw.report = await localDocument(root, path.join(directory, 'verification/report.json'), prefix)
  const redacted = JSON.parse(redactReport(JSON.stringify(frozen), root))
  validateLocalFull(raw.plan.value, raw.report.value, redacted)
  localWithin(raw.report.value.startedAt, start, end)
  const receipts = await filesUnder(root, path.join(directory, 'tasks'), '*/receipt.json')
  assert(receipts.length === frozen.tasks.length, 'Local full benchmark is missing task receipts')
  const seenTasks = new Set()
  const seenVitest = new Set()
  const leafScope = []
  const caseScope = []
  const lintScope = []
  const runtimeTaskScope = []
  const runtimeCases = []
  let ide
  for (const file of receipts) {
    const document = await localDocument(root, file, prefix)
    raw.tasks.push(document)
    const receipt = document.value
    const task = frozen.tasks.find(item => item.id === receipt.taskId)
    assert(task && !seenTasks.has(task.id) && receipt.schemaVersion === 1 && receipt.runId === identity.runId
      && receipt.sourceFingerprint === identity.fingerprint && receipt.nodeVersion === process.version && receipt.exitCode === 0 && !receipt.cancelled
      && !receipt.signal && !receipt.error, 'Local task receipt is failed, duplicate or belongs to another run')
    assert.deepEqual(receipt.executionTopology, frozen.executionTopology, 'Local task receipt topology changed')
    assert.deepEqual(receipt.effectiveTopology, topologyEnvironment(frozen.executionTopology), 'Local task effective topology changed')
    seenTasks.add(task.id)
    assert.deepEqual([receipt.command, receipt.args, receipt.directory], [task.command, task.args, task.directory], 'Local observer changed the original command')
    localWithin(receipt.startedAt, start, end)
    localWithin(receipt.finishedAt, Date.parse(receipt.startedAt), end)
    const stdout = await taskLog(root, receipt.stdout, prefix)
    await taskLog(root, receipt.stderr, prefix)
    if (task.evidence) {
      const leaves = validateLocalTurbo(receipt.dryGraph, receipt.summary?.value)
      assert.deepEqual(receipt.leaves, leaves, 'Local Turbo normalized leaf evidence differs')
      leafScope.push(...leaves.filter(([, command]) => command !== '<NONEXISTENT>').map(([id]) => id.replace(/#test:types:check$/u, '#test:types')))
    }
    const artifactWriter = ['build', 'types'].includes(task.kind) || receipt.dryGraph?.tasks.some(node => node.taskId.endsWith('#build') && node.command !== '<NONEXISTENT>')
    if (artifactWriter) {
      assert(receipt.artifacts?.schemaVersion === 2 && receipt.artifacts.commit === identity.commitSha && receipt.artifacts.files.length, 'Local build has no fresh schema 2 artifact manifest')
    }
    if (task.kind !== 'build' && task.dependencies.length) {
      assert(receipt.preparedArtifacts?.value.schemaVersion === 2 && receipt.preparedArtifacts.value.commit === identity.commitSha, 'Local consumer did not check prepared build artifacts')
    }
    if (['lint', 'stylelint'].includes(task.kind)) {
      const lint = await localDocument(root, receipt.lintReport, prefix)
      raw.lint.push(lint)
      assert(Array.isArray(lint.value) && lint.value.length, 'Local lint has no actual file inventory')
      const expectedArgs = [...task.args, task.kind === 'stylelint' ? '--formatter=json' : '--format=json', `--output-file=${path.join(root, receipt.lintReport)}`]
      assert.deepEqual(receipt.effectiveArgs, expectedArgs, 'Local lint observer changed scope or failure semantics')
      for (const item of lint.value) {
        assert((item.errorCount ?? 0) === 0 && (item.fatalErrorCount ?? 0) === 0 && !item.errored, 'Local lint JSON contains errors')
        const source = path.relative(root, item.filePath ?? item.source).replaceAll('\\', '/')
        assert(source && !source.startsWith('../') && !path.isAbsolute(source), 'Local lint file escaped checkout')
        lintScope.push([task.kind, source])
      }
    }
    else {
      assert.deepEqual(receipt.effectiveArgs, task.args, 'Local observer changed task scope or flags')
    }
    const markers = [...stdout.matchAll(/^\[verification-local-case\] index=(\S+)/gmu)].map(match => match[1])
    assert(new Set(markers).size === markers.length, 'Duplicate local Vitest document marker')
    for (const marker of markers) {
      const report = await localDocument(root, marker, `${prefix}vitest/`)
      raw.vitest.push(report)
      const value = report.value
      assert(value.runId === identity.runId && value.taskId === task.id && value.taskInvocation === receipt.invocationId
        && value.nodeVersion === receipt.nodeVersion && !seenVitest.has(report.path), 'Local Vitest document has stale or wrong ownership')
      localWithin(value.startedAt, Date.parse(receipt.startedAt), Date.parse(receipt.finishedAt))
      localWithin(value.finishedAt, Date.parse(value.startedAt), Date.parse(receipt.finishedAt))
      seenVitest.add(report.path)
      const scope = validateLocalVitest(value)
      const group = task.kind === 'test' ? 'unit' : task.id
      caseScope.push(...scope.cases.map(([source, , name, mode, state, note]) => [logicalTopologyCaseFile(source), group, name, mode, state, note]))
      if (task.id === 'runtime:headless') {
        runtimeCases.push(...scope.cases.map(([, , name, mode, state, note]) => [group, value.template, name, mode, state, note]))
      }
    }
    if (task.kind === 'test' || task.id.startsWith('runtime:')) {
      assert(markers.length, 'Local test/runtime task has no actual Vitest case evidence')
    }
    if (localSuites[task.id]) {
      const suites = await readLocalSuites(root, receipt, stdout, inventories, identity, raw)
      const actualInvocations = raw.vitest.filter(item => item.value.taskId === task.id)
        .map(item => JSON.stringify([item.value.runtimeTaskLabel, item.value.template ?? null]))
        .sort()
      const expectedInvocations = suites.flatMap(suite => inventories[suite.name]
        .filter(item => item.caseEvidence && !item.outOfScopeReason)
        .flatMap(item => (item.acceptanceTemplates ?? [null]).map(template => JSON.stringify([item.label, template])))).sort()
      assert.deepEqual(actualInvocations, expectedInvocations, 'Local runtime Vitest invocation inventory is incomplete or duplicated')
      for (const suite of suites.filter(item => item.name !== 'ide-full')) {
        runtimeTaskScope.push([suite.name, inventories[suite.name].filter(item => item.outOfScopeReason).map(item => [item.label, item.outOfScopeReason])])
      }
      const strict = suites.find(item => item.name === 'ide-full')
      if (strict) {
        ide = await localIdeEvidence(root, strict, inventories, identity, receipt, raw)
      }
    }
  }
  assert.deepEqual(await filesUnder(root, path.join(directory, 'vitest'), '*.json'), [...seenVitest].sort(), 'Local full benchmark omitted fresh Vitest documents')
  await assertAllLocalDom(root, identity, raw.acceptance)
  assert(/^pnpm@\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(identity.packageManager), 'Local final artifacts require the actual package manager identity')
  raw.finalArtifacts = await localDocument(root, path.join(directory, 'artifacts/latest.json'), prefix)
  const environment = { BUILD_ARTIFACT_EXPECTED_COMMIT: identity.commitSha, BUILD_ARTIFACT_PACKAGE_MANAGER: identity.packageManager }
  verifyBuildArtifactManifest(root, raw.finalArtifacts.value, environment)
  assert.deepEqual(createBuildArtifactManifest(root, environment), raw.finalArtifacts.value, 'Final local artifact inventory changed after verification')
  assert(ide, 'Local complete full benchmark has no strict IDE evidence')
  const classification = classifyCoverageScope({ files: [...new Set(caseScope.map(([file]) => file))].sort(), cases: caseScope })
  assert(new Set(runtimeCases.map(item => JSON.stringify(item.slice(0, 3)))).size === runtimeCases.length, 'Local headless logical case identity is ambiguous across file groups')
  const lintClassification = classifyCoverageScope({ files: [...new Set(lintScope.map(([, file]) => file))].sort(), cases: [] })
  return {
    scope: { policy: classification.policy, leaves: [...new Set(leafScope)].sort(), cases: classification.product.cases.filter(([file, group]) => group !== 'runtime:headless' && !(group === 'runtime:full' && file.startsWith('e2e/ide/'))).sort(), headless: runtimeCases.sort(), lint: lintScope.filter(([, file]) => lintClassification.product.files.includes(file)).sort(), runtimeTasks: runtimeTaskScope.sort(), dom: ide.scope },
    classification,
    lintClassification,
    ide,
  }
}
