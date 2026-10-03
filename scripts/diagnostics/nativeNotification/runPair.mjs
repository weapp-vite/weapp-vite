import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { compareModes } from './compare.mjs'

assert.equal(process.env.WEAPP_NATIVE_NOTIFICATION_SLOT, '1', 'Obtain exclusive runtime slot before execution')
const root = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'))
const harness = JSON.parse(await readFile(new URL('./harness-manifest.json', import.meta.url), 'utf8'))
const digest = text => createHash('sha256').update(text).digest('hex')
assert.equal(digest(await readFile(path.join(root, harness.sourcePath))), harness.sourceHash)
assert.equal(digest(await readFile(new URL('./benchmark-private.ts', import.meta.url))), harness.privateHash)
for (const file of manifest.files) {
  assert.equal(digest(await readFile(path.join(root, file.path))), file.sourceHash)
}
for (const [file, hash] of Object.entries(manifest.sources)) {
  assert.equal(digest(await readFile(path.join(root, file))), hash)
}
assert.equal(digest(await readFile(path.join(root, manifest.native.path))), manifest.native.hash)
const runRoot = await mkdtemp(path.join(root, '.tmp/native-source-notification-run-'))
const workspaces = path.join(runRoot, 'workspace')
const evidence = { diagnosticOnly: true, runtimeHost: process.platform, sourceIdentity: manifest.identity, runRoot: path.relative(root, runRoot), errors: [], modes: [], children: [], interrupted: false }
const children = new Set()
function stop() {
  evidence.interrupted = true
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
    }
  }
}
process.once('SIGTERM', stop)
process.once('SIGINT', stop)
async function hashTree(directory, ignore = new Set()) {
  const result = {}
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignore.has(entry.name)) {
      continue
    }
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      for (const [file, hash] of Object.entries(await hashTree(filename, ignore))) {
        result[`${entry.name}/${file}`] = hash
      }
    }
    else if (entry.isFile()) {
      result[entry.name] = digest(await readFile(filename))
    }
  }
  return result
}
const template = path.join(root, 'templates/weapp-vite-template')
const sourceBefore = await hashTree(template, new Set(['node_modules', 'dist', '.weapp-vite', '.turbo']))
const distBefore = await hashTree(path.join(root, 'packages/weapp-vite/dist'))
async function mode(name) {
  assert(!evidence.interrupted, 'Run interrupted')
  evidence.stage = `${name}:observation`
  const modeRecord = { mode: name, lifecycleConfirmed: false }
  evidence.modes.push(modeRecord)
  const reportRoot = path.join(runRoot, name)
  const traces = path.join(reportRoot, 'traces')
  await mkdir(traces, { recursive: true })
  const env = { ...process.env, WEAPP_NATIVE_NOTIFICATION_MODE: name, WEAPP_NATIVE_NOTIFICATION_OUTPUT: traces, TEMPLATES_HMR_REPO_ROOT: root, TEMPLATES_HMR_PROJECT_ROOT: template, TEMPLATES_HMR_WORKSPACE_ROOT: workspaces, TEMPLATES_HMR_REPORT_DIR: reportRoot, TEMPLATES_HMR_FILTER: 'weapp-vite-template', TEMPLATES_HMR_SCENARIO_FILTER: 'app-json,native-page-script', TEMPLATES_HMR_RUNTIME: 'stateful-experimental', TEMPLATES_HMR_ITERATIONS: '2', TEMPLATES_HMR_MARKER_SEED: 'native-notification-probe', TEMPLATES_HMR_SAMPLE_MODE: 'edit-only', TEMPLATES_HMR_PROFILE: '1', TEMPLATES_HMR_OUTPUT_SCOPE: '0', TEMPLATES_HMR_KEEP_WORKSPACE: '0', TEMPLATES_HMR_FAIL_ON_ERROR: '0', TEMPLATES_HMR_STOP_ON_ERROR: '0', TEMPLATES_HMR_BUDGET_MS: '500', TEMPLATES_HMR_TIMEOUT_MS: '30000', TEMPLATES_HMR_PROFILE_TIMEOUT_MS: '15000', TEMPLATES_HMR_STARTUP_TIMEOUT_MS: '120000', TEMPLATES_HMR_SETTLE_MS: '300' }
  delete env.NODE_OPTIONS
  delete env.TEMPLATES_HMR_PLAN_ONLY
  delete env.TEMPLATES_HMR_CPU_PROFILE_DIR
  delete env.TEMPLATES_HMR_MAX_SCENARIOS_PER_TEMPLATE
  let output = ''
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./benchmark-private.ts', import.meta.url))], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
  children.add(child)
  const record = { mode: name, pid: child.pid }
  evidence.children.push(record)
  child.stdout.on('data', (chunk) => {
    output += chunk
    process.stdout.write(chunk)
  })
  child.stderr.on('data', (chunk) => {
    output += chunk
    process.stderr.write(chunk)
  })
  const result = await new Promise((resolve, reject) => {
    child.once('error', (error) => {
      children.delete(child)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      children.delete(child)
      resolve({ code, signal })
    })
  })
  Object.assign(record, result, { exited: true })
  await writeFile(path.join(reportRoot, 'runner.log'), output.replaceAll(root, '<repo>'))
  evidence.stage = `${name}:observation-integrity`
  assert(!output.includes('[native-notification:export-error]'), 'Trace export failed')
  const report = JSON.parse(await readFile(path.join(reportRoot, 'report.json'), 'utf8'))
  const driver = JSON.parse(await readFile(path.join(reportRoot, 'driver-events.json'), 'utf8'))
  const lifecycle = JSON.parse(await readFile(path.join(reportRoot, 'driver-lifecycle.json'), 'utf8'))
  Object.assign(modeRecord, result, { devs: lifecycle.devs, lifecycleConfirmed: lifecycle.devs.length === 1 && lifecycle.devs.every(dev => dev.stopped) })
  assert(modeRecord.lifecycleConfirmed, 'Dev lifecycle incomplete')
  modeRecord.originalBudget = { thresholdMs: report.budgetMs, overBudgetCount: report.summary.overBudgetCount, status: report.summary.overBudgetCount ? 'exceeded-recorded-as-in-formal-collector' : 'within-budget', formalPairedVerdict: 'not-evaluated-diagnostic-only' }
  assert.deepEqual(report.templates[0]?.scenarios.map(item => item.id), ['app-json', 'native-page-script'])
  evidence.stage = `${name}:original-functional-result`
  assert.equal(report.summary.failedTemplateCount, 0)
  assert.equal(report.summary.failedScenarioCount, 0)
  evidence.stage = `${name}:instrumentation`
  const traceFiles = await readdir(traces)
  const traceReports = await Promise.all(traceFiles.map(async file => ({ file, report: JSON.parse(await readFile(path.join(traces, file), 'utf8')) })))
  const selected = traceReports.filter(item => item.report.mutations.length === 4).sort((a, b) => b.report.events.length - a.report.events.length)[0]
  assert(selected, 'No complete dev trace')
  assert(!selected.report.overflow && !selected.report.incompleteWindow)
  assert(Object.values(selected.report.integrity).every(Boolean))
  if (name === 'probe') {
    assert.equal(new Set(selected.report.selectedModules.map(file => file.kind)).size, 3)
  }
  Object.assign(modeRecord, { summary: report.summary, selectedTrace: selected.file, traceFiles })
  assert.equal(result.code, 0, 'Original strict benchmark gates failed; diagnostic retained')
  return driver
}
try {
  const control = await mode('control')
  const probe = await mode('probe')
  evidence.stage = 'output-and-transport-equivalence'
  evidence.comparison = compareModes(control, probe)
  assert(evidence.comparison.comparable, 'Unknown output/transport differences require inspection')
}
catch (error) {
  evidence.errors.push({ stage: evidence.stage, message: String(error?.stack ?? error).replaceAll(root, '<repo>') })
  process.exitCode = 1
}
finally {
  process.removeListener('SIGTERM', stop)
  process.removeListener('SIGINT', stop)
  evidence.liveRunnerCount = children.size
  const registered = evidence.children.map(item => item.pid).concat(evidence.modes.flatMap(item => item.devs?.map(dev => dev.pid) ?? []))
  evidence.registeredPidsStillPresent = registered.filter((pid) => {
    try {
      process.kill(pid, 0)
      return true
    }
    catch (error) { return error.code !== 'ESRCH' }
  })
  evidence.templateUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(await hashTree(template, new Set(['node_modules', 'dist', '.weapp-vite', '.turbo'])))
  evidence.distUnchanged = JSON.stringify(distBefore) === JSON.stringify(await hashTree(path.join(root, 'packages/weapp-vite/dist')))
  evidence.sourcesUnchanged = (await Promise.all(Object.entries(manifest.sources).map(async ([file, hash]) => digest(await readFile(path.join(root, file))) === hash))).every(Boolean)
  evidence.nativeUnchanged = digest(await readFile(path.join(root, manifest.native.path))) === manifest.native.hash
  if (children.size === 0 && evidence.registeredPidsStillPresent.length === 0 && evidence.modes.length > 0 && evidence.modes.every(item => item.lifecycleConfirmed)) {
    await rm(workspaces, { recursive: true, force: true })
    evidence.workspaceRemoved = true
  }
  if (!evidence.templateUnchanged || !evidence.distUnchanged || !evidence.nativeUnchanged || !evidence.sourcesUnchanged || children.size || evidence.registeredPidsStillPresent.length) {
    evidence.errors.push({ stage: 'final-integrity-and-cleanup', message: 'Source/binding integrity changed or a registered PID remains present; owned directory preserved if cleanup could not be confirmed.' })
    process.exitCode = 1
  }
  await writeFile(path.join(runRoot, 'pair-result.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ report: path.relative(root, path.join(runRoot, 'pair-result.json')), errors: evidence.errors.length, liveRunnerCount: children.size }))
}
