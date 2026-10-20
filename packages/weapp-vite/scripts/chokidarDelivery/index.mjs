import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { withMachineE2ELease } from '../../../devtools-runtime/src/lease/machine.ts'
import { INHERITED_LEASE_ENV } from '../../../devtools-runtime/src/lease/machineScope.ts'
import { createConsumerTemporaryRoot, packConsumerTarballs, readConsumerTarballs } from '../consumerTarballs.mjs'
import { readLicenseRequirements, verifyPublishedArchive } from './artifacts.mjs'
import { installConsumer } from './installation.mjs'
import { nonApplicableReason, scenarios } from './probe/scenarios.mjs'
import { invocation, normalizeReport, parseArguments } from './report.mjs'
import { ordinaryEnvironment, runPublicWorker } from './supervisor.mjs'
import { verifyPublicTypes } from './types.mjs'
import { completePublicValidation, runCandidateValidation } from './validation.mjs'

const options = parseArguments(process.argv.slice(2))
assert(process.env[INHERITED_LEASE_ENV], `Public watcher delivery must borrow the formal machine lease. Run: ${invocation}`)
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const report = { schemaVersion: 1, node: process.version, platform: process.platform, status: 'running', startedAt: new Date().toISOString(), results: [], negativeControl: { status: 'not-run', supplied: Boolean(options.baselineTarballs), reason: 'An independently packed original baseline is required; absence is never reported as a successful negative control.' } }
const roots = [[repositoryRoot, '<repo>'], [options.reportFile, '<report>']]
for (const [directory, label] of [[options.tarballs, '<candidate-tarballs>'], [options.baselineTarballs, '<baseline-tarballs>']]) {
  if (directory) {
    roots.push([directory, label])
  }
}
await mkdir(path.dirname(options.reportFile), { recursive: true })
const serialize = () => `${JSON.stringify(normalizeReport(report, roots), null, 2)}\n`
const persist = () => writeFile(options.reportFile, serialize())
const controller = new AbortController()
const interrupt = () => controller.abort()
process.on('SIGINT', interrupt)
process.on('SIGTERM', interrupt)
let temporaryRoot
let resourcesConfirmed = true

async function runWorker(lease, scenario, consumerRoot, variant) {
  assert.equal(controller.signal.aborted, false, 'Consumer delivery was interrupted')
  report.currentScenario = `${variant}:${scenario.id}`
  await persist()
  controller.signal.throwIfAborted()
  let result
  try {
    result = await runPublicWorker({ scenario, consumerRoot, variant, resultFile: path.join(temporaryRoot, 'results', `${variant}-${scenario.id}.json`), lease, repositoryRoot, signal: controller.signal })
  }
  catch (error) {
    result = { id: scenario.id, variant, status: 'failed', cleanupConfirmed: false, supervisorError: { message: String(error), stack: error?.stack } }
  }
  if (!result.cleanupConfirmed) {
    resourcesConfirmed = false
    report.status = 'failed'
    report.unconfirmedWorker = result
    report.cleanup = { status: 'unconfirmed', consumer: 'preserved', machineScope: 'preserved' }
    report.finishedAt = new Date().toISOString()
    writeFileSync(options.reportFile, serialize())
    console.error('Public consumer cleanup is unconfirmed; the independent non-IDE scope and consumer are preserved.')
    // 保留未完成 scope，让外层正式入口拒绝把空 IDE journal 当作资源终结。
    process.exit(1)
  }
  return result
}

try {
  await withMachineE2ELease(async (lease) => {
    assert.equal(lease.borrowed, true, `Use the formal machine lease wrapper: ${invocation}`)
    temporaryRoot = await createConsumerTemporaryRoot()
    roots.push([temporaryRoot, '<consumer-root>'])
    report.retainedEvidenceRoot = temporaryRoot
    await mkdir(path.join(temporaryRoot, 'results'))
    const candidates = options.tarballs
      ? await readConsumerTarballs(options.tarballs, ['weapp-vite'])
      : await packConsumerTarballs(repositoryRoot, path.join(temporaryRoot, 'tarballs'), ['weapp-vite'])
    report.archive = await verifyPublishedArchive(candidates['weapp-vite'].slice('file:'.length), await readLicenseRequirements())
    const consumerRoot = path.join(temporaryRoot, 'candidate')
    report.installation = await installConsumer(consumerRoot, candidates, false, repositoryRoot)
    await runCandidateValidation({
      report,
      verifyTypes: () => verifyPublicTypes(consumerRoot, ordinaryEnvironment()),
      runScenario: scenario => runWorker(lease, scenario, consumerRoot, 'candidate'),
      persist,
      scenarios,
      nonApplicableReason,
      nativePlatform: process.platform,
      signal: controller.signal,
    })
    controller.signal.throwIfAborted()
    if (options.baselineTarballs && process.platform === 'win32') {
      const baseline = await readConsumerTarballs(options.baselineTarballs, ['weapp-vite'])
      const baselineRoot = path.join(temporaryRoot, 'baseline')
      report.negativeControl.installation = await installConsumer(baselineRoot, baseline, true, repositoryRoot)
      const scenario = scenarios.find(item => item.kind === 'recovery')
      const result = await runWorker(lease, scenario, baselineRoot, 'baseline')
      const rejected = result.status === 'failed' && result.code !== 0 && result.report.status === 'failed'
        && result.report.native.injected === 1 && result.report.bodyError?.originalInjectedError === true
        && result.report.bodyError.code === 'EPERM' && result.cleanupConfirmed
      report.negativeControl = { ...report.negativeControl, status: rejected ? 'confirmed-rejected' : 'failed', reason: 'Original unmodified tarball must reject the same actual Windows recovery contract with the original injected EPERM.', result }
    }
    else if (options.baselineTarballs) {
      report.negativeControl.reason = 'Baseline supplied but not executed: its Windows recovery contract requires an actual Windows host.'
    }
    delete report.currentScenario
    completePublicValidation(report, process.platform, scenarios.length)
  })
}
catch (error) {
  report.status = 'failed'
  report.error = { message: String(error), stack: error?.stack }
}
finally {
  process.off('SIGINT', interrupt)
  process.off('SIGTERM', interrupt)
  if (temporaryRoot && resourcesConfirmed && report.status === 'passed') {
    try {
      await rm(temporaryRoot, { recursive: true, force: true })
      report.cleanup = { status: 'confirmed', consumer: 'removed', forcedCleanup: false }
      delete report.retainedEvidenceRoot
    }
    catch (error) {
      report.status = 'failed'
      report.cleanup = { status: 'failed', consumer: 'preserved', message: String(error) }
    }
  }
  else if (resourcesConfirmed) {
    report.cleanup = { status: 'confirmed', consumer: temporaryRoot ? 'preserved-for-diagnosis' : 'not-created', forcedCleanup: false }
  }
  report.finishedAt = new Date().toISOString()
  report.planned = scenarios.length
  report.passed = report.results.filter(item => item.status === 'passed').length
  report.failed = report.results.filter(item => item.status === 'failed').length
  report.nonApplicable = report.results.filter(item => item.status === 'non-applicable').length
  report.notRun = scenarios.length - report.results.length
  await persist()
  console.log(JSON.stringify({ status: report.status, passed: report.passed, nonApplicable: report.nonApplicable, notRun: report.notRun, negativeControl: report.negativeControl.status }))
  if (report.status !== 'passed') {
    process.exitCode = 1
  }
}
