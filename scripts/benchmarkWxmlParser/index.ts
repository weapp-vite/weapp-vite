import type { MeasurementResult, Operation } from './types'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { measureCold } from './cold'
import { assertBrowserColdIntegrity, assertNodeColdIntegrity } from './coldIntegrity'
import { hash, repositoryRoot } from './freeze'
import { assertIntegrity, assertPassed } from './measurement'
import { argumentsFor, corpusSummary, prepare } from './prepare'
import { assertNodeStackBudget, STACK_SIZE_KB } from './runtime'
import { createWorkload } from './workload'

const configuration = argumentsFor(process.argv.slice(2))
const output = path.resolve(repositoryRoot, configuration.output ?? `.tmp/current-run/wxml/benchmark-${Date.now()}`)
await mkdir(path.dirname(output), { recursive: true })
await mkdir(output)
const startedAt = new Date().toISOString()
const report: Record<string, unknown> = {
  schemaVersion: 1,
  startedAt,
  status: 'running',
  purpose: configuration.quick ? 'exploratory' : 'formal',
  environment: { node: process.version, platform: process.platform, arch: process.arch, stackSizeKb: STACK_SIZE_KB, execArgv: process.execArgv },
  boundary: 'Built public APIs; default complete WXML metadata; XML syntax shared-subset comparison. Scan collects identical tag/attribute facts. Fresh ASTs for edit. No-op preserve is informational. OS file cache is not cleared.',
}
const save = () => writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
try {
  await withMachineE2ELease(async () => {
    await save()
    assertNodeStackBudget(process.execArgv)
    const prepared = await prepare(output, configuration.browser, configuration.consumers)
    report.identity = { manifest: prepared.manifest, artifacts: prepared.artifacts, versions: prepared.versions, browserTransport: prepared.browserTransport, lockSha256: hash(await readFile(path.join(repositoryRoot, 'pnpm-lock.yaml'))) }
    report.corpus = corpusSummary(prepared.manifest.files)
    report.bundle = prepared.bundle
    const suite = await import(pathToFileURL(prepared.suite).href) as {
      operations: (fixtures: typeof prepared.fixtures) => Operation[]
      measure: (operations: Operation[], fixtures: typeof prepared.fixtures, quick: boolean, checkpoint: (state: MeasurementResult) => Promise<void>, expectedOperations?: readonly string[]) => Promise<MeasurementResult>
    }
    const operations = suite.operations(prepared.fixtures)
    const workload = createWorkload(operations, prepared.fixtures, configuration.quick, prepared.expectedOperations)
    report.workload = workload
    await save()
    report.memoryBefore = process.memoryUsage()
    const result = await suite.measure(operations, prepared.fixtures, configuration.quick, async (state) => {
      report.node = state
      await save()
      process.stdout.write(`WXML benchmark: ${state.summaries.length} completed cells, ${state.errors.length} errors\n`)
    }, prepared.expectedOperations)
    report.node = result
    report.memoryAfter = process.memoryUsage()
    report.memoryBoundary = 'Whole runner process snapshots including imports, corpus, ASTs and report; not retained allocation or per-operation peak RSS.'
    const cold = await measureCold(prepared.coldEntries, prepared.fixtures, output, configuration.quick, async (state) => {
      report.cold = state
      await save()
    })
    report.cold = cold
    if (configuration.browser) {
      const { runBrowser } = await import('./browser')
      report.browser = await runBrowser(prepared.browserSuite!, prepared.fixtures, configuration.quick, async (state) => {
        report.browser = state
        await save()
      }, prepared.expectedOperations)
    }
    for (const [file, expected] of Object.entries(prepared.artifacts)) {
      if (file.endsWith('-browser-bundle')) {
        continue
      }
      if (hash(await readFile(path.join(repositoryRoot, file))) !== expected) {
        throw new Error(`Artifact identity drift during measurement: ${file}`)
      }
    }
    if ((report.identity as { lockSha256: string }).lockSha256 !== hash(await readFile(path.join(repositoryRoot, 'pnpm-lock.yaml')))) {
      throw new Error('Lockfile identity drift during measurement.')
    }
    const assert = configuration.check ? assertPassed : assertIntegrity
    assert(result, workload)
    if (report.browser) {
      assert((report.browser as { result: MeasurementResult }).result, workload)
    }
    assertNodeColdIntegrity(cold, prepared.fixtures, configuration.quick)
    if (report.browser) {
      assertBrowserColdIntegrity((report.browser as Awaited<ReturnType<typeof import('./browser').runBrowser>>).cold, prepared.fixtures, configuration.quick)
    }
    report.status = configuration.quick ? 'exploratory-complete' : 'passed'
  })
}
catch (error) {
  report.status = 'failed'
  report.error = String(error instanceof Error ? error.stack : error).replaceAll(repositoryRoot, '<repository>')
  process.exitCode = 1
}
finally {
  report.finishedAt = new Date().toISOString()
  await save()
  process.stdout.write(`WXML benchmark ${String(report.status)}; ${path.relative(repositoryRoot, output)}/report.json\n`)
}
