import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { glob, lstat, mkdir, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 正式 suite 需要跨平台启动并保留实际退出状态。
import { execa } from 'execa'
import { verificationSuiteReportSchema } from '../../e2e/scripts/verification/validation.ts'
import { createBuildArtifactManifest, verifyBuildArtifactManifest } from '../buildArtifact/index.mjs'
import { formalVerificationTopology, topologyEnvironment } from '../verification/topology.ts'
import { reserveCaptureOutput, writeCaptureJson } from './captureOutput.mjs'
import { validateSample } from './compare.mjs'
import { artifactSnapshot, evidenceDigest, runtimeScope } from './evidence.mjs'
import { LOCAL_FRAMEWORK_INPUT_POLICY, localFrameworkInputs } from './localFramework.mjs'
import { assertRuntimeCaseInventory, assertRuntimeTaskInventory, createRuntimeInventory, logicalRuntimeTaskInventory } from './runtimeInventory.mjs'

const suites = {
  'ide-full': ['e2e:ide:full', 'node --import tsx ./e2e/scripts/run-sleep-inhibited-e2e-suite.ts ide-full'],
  'ide-full:exhaustive': ['e2e:ide:full:exhaustive', 'node --import tsx ./e2e/scripts/run-sleep-inhibited-e2e-suite.ts "ide-full:exhaustive"'],
}
const partialEnvironment = ['TASK_FILTER', 'TASK_FROM', 'TASK_ROLL_FROM', 'SHARD_INDEX', 'SHARD_TOTAL', 'TEMPLATE', 'TARGET_FILE', 'EXCLUDE_PROJECTS', 'ACCEPTANCE_CASES']
const configurationKeys = ['schemaVersion', 'id', 'variant', 'cachePolicy', 'suite', 'toolchain', 'inputPolicy', 'artifactDirectories', 'topology', 'comparisonProtocol']
const suitePath = /^docs\/reports\/\d{4}-\d{2}-\d{2}-\d{6}-[\w.](?:[\w.-]*[\w.])?-suite-report\/index\.json$/u

function configuration(config) {
  assert(config?.schemaVersion === 1 && Object.keys(config).every(key => configurationKeys.includes(key))
    && Object.hasOwn(suites, config.suite) && ['baseline', 'candidate'].includes(config.variant)
    && typeof config.id === 'string' && config.id && typeof config.cachePolicy === 'string' && config.cachePolicy
    && typeof config.toolchain === 'string' && config.inputPolicy === LOCAL_FRAMEWORK_INPUT_POLICY, 'Invalid local runtime benchmark configuration')
  assert(!partialEnvironment.some(key => process.env[`WEAPP_VITE_E2E_${key}`]?.trim()), 'Runtime benchmark cannot use inherited filters, shards or exclusions')
  assert(!process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER || process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER === 'devtools', 'Runtime benchmark requires the actual DevTools provider')
  return suites[config.suite]
}

function relativeFile(value, prefix) {
  assert(typeof value === 'string' && value.startsWith(prefix) && !value.includes('\\') && !value.includes('\0')
    && !path.posix.isAbsolute(value) && !/^[a-z]:/iu.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..'), 'Runtime evidence must stay inside its owned report directory')
  return value
}

async function readDocument(root, relative, prefix) {
  relativeFile(relative, prefix)
  const file = path.join(root, relative)
  assert((await lstat(file)).isFile() && path.relative(await realpath(file), file) === '', 'Runtime evidence cannot use symlinks or directories')
  const bytes = await readFile(file, 'utf8')
  return { path: relative, digest: evidenceDigest(bytes), value: JSON.parse(bytes) }
}

function within(value, start, end) {
  const time = typeof value === 'number' ? value : Date.parse(value)
  assert(Number.isFinite(time) && time >= start && time <= end, 'Runtime evidence is stale or outside this invocation')
}

function actualRuntimeProfile(report, acceptance, toolchain, cachePolicy) {
  const actual = report.execution.profile
  assert(actual.os === toolchain.os && actual.arch === toolchain.arch && actual.nodeMajor === Number(toolchain.nodeMajor)
    && actual.provider === 'devtools' && actual.runnerClass === 'local', 'Runtime suite resource identity differs from the actual toolchain')
  const versions = new Set()
  const fixtures = new Map()
  for (const document of acceptance) {
    assert(document.value.environment.nodeVersion === toolchain.toolchain.nodeVersion, 'Runtime evidence Node version mismatch')
    for (const item of document.value.cases) {
      if (!item.acceptance) {
        continue
      }
      const runtime = item.acceptance.runtime
      versions.add(runtime.ideVersion)
      const fixture = item.acceptance.fixture
      assert(!fixtures.has(fixture) || fixtures.get(fixture) === runtime.baseLibraryVersion, 'Runtime fixture SDK changed between invocations')
      fixtures.set(fixture, runtime.baseLibraryVersion)
    }
  }
  assert(versions.size === 1 && [...versions].every(value => typeof value === 'string' && value.trim()), 'Runtime benchmark needs one actual IDE version')
  const sdkVersions = [...new Set(fixtures.values())]
  return {
    os: toolchain.os,
    arch: toolchain.arch,
    node: toolchain.toolchain.nodeVersion,
    packageManager: toolchain.toolchain.actualPackageManager,
    provider: actual.provider,
    platform: actual.platform,
    runnerClass: actual.runnerClass,
    cachePolicy,
    ideVersion: [...versions][0],
    baseLibraryVersion: sdkVersions.length === 1 ? sdkVersions[0] : JSON.stringify([...fixtures].sort(([left], [right]) => left.localeCompare(right))),
  }
}

async function executionEvidence(root, config, stdout, identity, previousReports, toolchain, inventory, start, end, raw) {
  const markers = [...new Set([...stdout.matchAll(/^\[e2e-suite-report\] index=(\S+)/gmu)].map(match => match[1].replace(/\.md$/u, '.json')))]
  const candidates = []
  for (const marker of markers) {
    assert(suitePath.test(marker) && !previousReports.has(marker.split('/')[2]), 'Runtime benchmark cannot reuse a previous suite report')
    const document = await readDocument(root, marker, 'docs/reports/')
    if (document.value.runId === identity.runId && document.value.suiteName === `e2e:${config.suite}`) {
      candidates.push(document)
    }
  }
  assert(candidates.length === 1, 'Runtime benchmark requires one fresh report from the formal suite')
  const suite = candidates[0]
  raw.suite = suite
  const report = verificationSuiteReportSchema.parse(suite.value)
  assert(report.runId === identity.runId && report.commitSha === identity.commitSha
    && Array.isArray(report.excludedProjects) && report.excludedProjects.length === 0, 'Runtime benchmark identity or full task scope differs')
  assert.deepEqual(report.execution.executionTopology, identity.executionTopology, 'Runtime report topology differs from the frozen capture')
  assertRuntimeTaskInventory(report, inventory)
  within(report.generatedAt, start, end)
  within(report.execution.startedAt, start, end)
  within(report.execution.finishedAt, start, end)
  assert(Date.parse(report.execution.startedAt) <= Date.parse(report.execution.finishedAt), 'Invalid runtime suite execution window')
  const prefix = `docs/reports/dom-acceptance/${identity.runId}/`
  const acceptance = []
  for (const task of report.tasks) {
    const taskReports = []
    for (const artifact of task.artifacts.filter(value => value.kind === 'dom-acceptance-report')) {
      const document = await readDocument(root, artifact.indexPath, prefix)
      raw.acceptance.push(document)
      assert(document.value.taskLabel === task.label, 'Runtime acceptance evidence belongs to another task')
      within(document.value.startedAt, start, end)
      within(document.value.finishedAt, start, end)
      acceptance.push(document)
      taskReports.push(document.value)
    }
    assertRuntimeCaseInventory(inventory.find(planned => planned.label === task.label), taskReports)
  }
  const files = []
  for await (const file of glob('**/*.json', { cwd: path.join(root, prefix) })) {
    files.push(`${prefix}${file.replaceAll('\\', '/')}`)
  }
  assert.deepEqual(files.sort(), acceptance.map(value => value.path).sort(), 'Runtime benchmark must include all fresh DOM evidence exactly once')
  const cases = runtimeScope(report, acceptance.map(document => document.value))
  const scope = config.comparisonProtocol ? { tasks: logicalRuntimeTaskInventory(inventory), cases } : cases
  const profile = actualRuntimeProfile(report, acceptance, toolchain, config.cachePolicy)
  return { scope, profile, suite, acceptance }
}

/** 只调用正式完整 suite；本轮原始报告、工具链和前后输入共同决定样本是否成立。 */
export async function captureRuntimeSample(config, output, root = process.cwd()) {
  const [script, expectedScript] = configuration(config)
  const executionTopology = formalVerificationTopology(config)
  const outputRelative = path.relative(root, path.resolve(root, output)).replaceAll('\\', '/')
  root = await realpath(root)
  relativeFile(outputRelative, '.tmp/')
  await mkdir(path.dirname(path.join(root, outputRelative)), { recursive: true })
  assert(path.relative(await realpath(path.dirname(path.join(root, outputRelative))), path.dirname(path.join(root, outputRelative))) === '', 'Runtime sample output escapes its workspace')
  const inputReceiptRelative = `${outputRelative}.inputs.json`
  const frozenRelative = `${outputRelative}.frozen.json`
  const runId = `benchmark-${randomUUID()}`
  const reservationPath = await reserveCaptureOutput(path.join(root, outputRelative), [path.join(root, inputReceiptRelative), path.join(root, frozenRelative)], { id: config.id, variant: config.variant, runId, executionTopology })
  const reservation = await readDocument(root, path.relative(root, reservationPath).replaceAll('\\', '/'), '.tmp/')
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  assert(manifest.scripts?.[script] === expectedScript, 'Runtime benchmark must launch an unchanged existing formal suite script')
  const before = await localFrameworkInputs(root)
  const identity = { runId, commitSha: before.commitSha, executionTopology }
  await writeCaptureJson(path.join(root, inputReceiptRelative), { schemaVersion: 1, ...before })
  const inputReceipt = await readDocument(root, inputReceiptRelative, '.tmp/')
  const inventory = await createRuntimeInventory(root, config.suite, executionTopology)
  const pnpm = (await execa('pnpm', ['--version'], { cwd: root })).stdout.trim()
  assert(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(pnpm), 'Cannot identify the actual pnpm toolchain')
  const buildEnvironment = { BUILD_ARTIFACT_EXPECTED_COMMIT: before.commitSha, BUILD_ARTIFACT_PACKAGE_MANAGER: `pnpm@${pnpm}` }
  const toolchain = await readDocument(root, config.toolchain, '.tmp/')
  verifyBuildArtifactManifest(root, toolchain.value, buildEnvironment)
  const artifacts = createBuildArtifactManifest(root, buildEnvironment)
  assert.deepEqual(toolchain.value, artifacts, 'Prepared toolchain manifest does not describe the actual local artifacts')
  assert(artifacts.toolchain.nodeVersion === process.version, 'Prepared artifact Node version differs from the measured runtime')
  const prepared = await artifactSnapshot(root, config.artifactDirectories)
  const previousReports = new Set(await readdir(path.join(root, 'docs/reports')).catch((error) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return []
  }))
  const env = { ...process.env, ...topologyEnvironment(executionTopology), WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID: runId, WEAPP_VITE_E2E_ACCEPTANCE_SHA: before.commitSha, WEAPP_VITE_E2E_REPORT_MARKERS: '1', WEAPP_VITE_E2E_RUNNER_CLASS: 'local' }
  delete env.WEAPP_VITE_E2E_ACCEPTANCE_DIRTY
  const args = ['run', script, `--topology=${executionTopology.id}`]
  await writeCaptureJson(path.join(root, frozenRelative), { schemaVersion: 1, runId, suite: config.suite, executionTopology, revision: before.commitSha, sourceFingerprint: before.sourceFingerprint, inputDigest: before.inputDigest, cachePolicy: config.cachePolicy, command: 'pnpm', args, effectiveTopology: topologyEnvironment(executionTopology), inventory, toolchain: { report: toolchain.path, digest: toolchain.digest } })
  const frozen = await readDocument(root, frozenRelative, '.tmp/')
  const start = Date.now()
  const begin = performance.now()
  let result
  let launchError
  try {
    result = await execa('pnpm', args, { cwd: root, env, stdout: ['pipe', 'inherit'], stderr: ['pipe', 'inherit'], reject: false })
  }
  catch (error) {
    launchError = error.message
    result = { exitCode: error.exitCode ?? 1, stdout: error.stdout ?? '', isCanceled: error.isCanceled }
  }
  const executionMs = performance.now() - begin
  const end = Date.now()
  const after = await localFrameworkInputs(root)
  const currentInputReceipt = await readDocument(root, inputReceiptRelative, '.tmp/')
  const currentFrozen = await readDocument(root, frozenRelative, '.tmp/')
  const currentReservation = await readDocument(root, reservation.path, '.tmp/')
  const currentToolchain = await readDocument(root, config.toolchain, '.tmp/')
  assert(before.sourceFingerprint === after.sourceFingerprint && before.inputDigest === after.inputDigest
    && inputReceipt.digest === currentInputReceipt.digest
    && frozen.digest === currentFrozen.digest
    && reservation.digest === currentReservation.digest
    && toolchain.digest === currentToolchain.digest
    && evidenceDigest(artifacts) === evidenceDigest(createBuildArtifactManifest(root, buildEnvironment))
    && evidenceDigest(prepared) === evidenceDigest(await artifactSnapshot(root, config.artifactDirectories)), 'Source, framework input or prepared artifact changed during sampling')
  let observed
  let error = launchError
  const raw = { acceptance: [] }
  try {
    observed = await executionEvidence(root, config, result.stdout ?? '', identity, previousReports, artifacts, inventory, start, end, raw)
    assert((await readDocument(root, reservation.path, '.tmp/')).digest === reservation.digest, 'Runtime benchmark capture reservation changed during finalization')
  }
  catch (caught) {
    error = [error, caught.message].filter(Boolean).join('; ')
  }
  const complete = result.exitCode === 0 && !error && Boolean(observed)
  const cancelled = result.isCanceled || result.exitCode === 130 || result.exitCode === 143
  const sample = validateSample({
    schemaVersion: 1,
    id: config.id,
    variant: config.variant,
    comparisonProtocol: config.comparisonProtocol,
    executionTopology,
    revision: before.commitSha,
    sourceFingerprint: before.sourceFingerprint,
    inputDigest: before.inputDigest,
    scopeDigest: evidenceDigest(observed?.scope ?? []),
    complete,
    outcome: complete ? 'passed' : cancelled ? 'cancelled' : result.exitCode === 0 ? 'partial' : 'failed',
    profile: observed?.profile ?? { os: artifacts.os, arch: artifacts.arch, node: artifacts.toolchain.nodeVersion, packageManager: artifacts.toolchain.actualPackageManager, provider: 'devtools', platform: 'weapp', runnerClass: 'local', cachePolicy: config.cachePolicy },
    metrics: { executionMs, approvalWaitMs: 0, schedulingWaitMs: 0, runnerMs: executionMs },
    evidence: { runId, reservation: { report: reservation.path, digest: reservation.digest, runId }, inputs: { report: inputReceipt.path, digest: inputReceipt.digest }, frozen: { report: frozen.path, digest: frozen.digest }, suite: raw.suite && { report: raw.suite.path, digest: raw.suite.digest }, acceptance: raw.acceptance.map(value => ({ report: value.path, digest: value.digest, invocationId: value.value.invocationId })), toolchain: { report: toolchain.path, digest: toolchain.digest }, artifacts: { files: artifacts.files, digest: evidenceDigest(artifacts.checksums) }, error, exitCode: result.exitCode },
  })
  await writeCaptureJson(path.join(root, outputRelative), sample)
  return sample
}
