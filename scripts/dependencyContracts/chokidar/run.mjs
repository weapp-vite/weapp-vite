import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { withMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine.ts'
import { completeContractReport, createContractCleanupKey, hashText, installedChokidar, normalizeReport, parseContractArguments } from './report.mjs'
import { nonApplicableReason, scenarios } from './scenarios.mjs'
import { runScenario, workerEnvironment } from './supervisor.mjs'

const { reportFile } = parseContractArguments(process.argv.slice(2))
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const report = {
  schemaVersion: 1,
  node: process.version,
  nativePlatform: process.platform,
  status: 'running',
  startedAt: new Date().toISOString(),
  notice: 'Every applicable scenario runs sequentially in a separate Node process. Platform overrides exercise classification on the native host filesystem; they are not Windows CI evidence. Non-applicable native branches are never counted as passed.',
  results: [],
}
const roots = [[repositoryRoot, '<repo>'], [reportFile, '<report>']]
const serialize = () => `${JSON.stringify(normalizeReport(report, roots), null, 2)}\n`
await mkdir(path.dirname(reportFile), { recursive: true })
const persist = () => writeFile(reportFile, serialize())
const cancellation = new AbortController()
const interrupt = () => cancellation.abort()
process.on('SIGINT', interrupt)
process.on('SIGTERM', interrupt)

try {
  await withMachineE2ELease(async (lease) => {
    const installed = await installedChokidar()
    roots.push([installed.directory, '<chokidar>'])
    report.installed = { version: installed.version, hashes: installed.hashes }
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'chokidar-contracts-'))
    roots.push([fixtureRoot, '<fixture>'])
    const cleanupKey = createContractCleanupKey(reportFile, fixtureRoot, process.pid)
    const scope = await lease.createChildScope({ cleanupKey })
    report.ownership = { domain: 'chokidar-contract', bindingSha256: hashText(cleanupKey), pid: process.pid, scope: 'active' }
    const preserveAndExit = async (error) => {
      report.status = 'failed'
      report.error = { message: String(error), stack: error?.stack }
      report.cleanup = { status: 'unconfirmed', lease: 'preserved', fixture: 'preserved', bindingSha256: hashText(cleanupKey) }
      try {
        await scope.seal()
        report.ownership.scope = 'sealed'
      }
      catch (sealError) {
        report.cleanup.sealError = { message: String(sealError), stack: sealError?.stack }
      }
      report.finishedAt = new Date().toISOString()
      try {
        writeFileSync(reportFile, serialize())
      }
      catch (reportError) { console.error('Could not persist the final contract report:', reportError) }
      console.error('Chokidar cleanup is unconfirmed; preserving the independent non-IDE scope and fixture')
      // 未完成的非 IDE scope 阻止父入口用空 journal 代替真实资源终结。
      process.exit(1)
    }
    const environment = workerEnvironment(scope.environment)
    let failure
    try {
      for (const scenario of scenarios) {
        assert.equal(cancellation.signal.aborted, false, 'Contract supervisor was interrupted')
        report.currentContract = scenario.id
        await persist()
        console.log(`contract:start:${scenario.id}`)
        const reason = nonApplicableReason(scenario, report.nativePlatform)
        if (reason) {
          report.results.push({ id: scenario.id, status: 'non-applicable', reason, workerStarted: false, durationMs: 0 })
        }
        else {
          const result = await runScenario(scenario, fixtureRoot, environment, installed, cancellation.signal)
          report.results.push(result)
          await persist()
          if (!result.cleanupConfirmed) {
            await preserveAndExit(new Error(`Resource cleanup is unconfirmed for ${scenario.id}; later scenarios were not started`))
          }
        }
        await persist()
        console.log(`contract:${report.results.at(-1).status}:${scenario.id}`)
      }
      delete report.currentContract
    }
    catch (error) {
      failure = error
    }
    try {
      assert.deepEqual(await readdir(fixtureRoot), [], 'The supervisor cannot repair worker fixture cleanup')
      await rm(fixtureRoot, { recursive: true, force: true })
      await scope.seal()
      report.ownership.scope = 'sealed'
      await scope.complete()
      report.ownership.scope = 'completed'
      report.cleanup = { status: 'confirmed', repairedWorkerRoots: false }
    }
    catch (error) {
      await preserveAndExit(failure ? new AggregateError([failure, error], 'Contract failed and cleanup is unconfirmed') : error)
    }
    if (failure) {
      throw failure
    }
  })
  Object.assign(report, completeContractReport(report))
}
catch (error) {
  report.status = 'failed'
  report.error = { message: String(error), stack: error?.stack }
  process.exitCode = 1
}
finally {
  process.off('SIGINT', interrupt)
  process.off('SIGTERM', interrupt)
  report.finishedAt = new Date().toISOString()
  report.planned = scenarios.length
  report.passed = report.results.filter(item => item.status === 'passed').length
  report.failed = report.results.filter(item => item.status === 'failed').length
  report.nonApplicable = report.results.filter(item => item.status === 'non-applicable').length
  report.notRun = report.planned - report.results.length
  await persist()
  console.log(JSON.stringify({ status: report.status, planned: report.planned, passed: report.passed, failed: report.failed, nonApplicable: report.nonApplicable, notRun: report.notRun }))
}
