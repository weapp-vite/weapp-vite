/* eslint-disable e18e/ban-dependencies -- 只读冻结 Git 身份，不使用 shell。 */
import type { Run } from './contract'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { cpus, loadavg, release, totalmem } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { normalizeRoots } from './artifacts'
import { collectRun } from './collect'
import { assertCollectionActive, CONTRACT, INPUTS, parseOptions, sideOrder, TARGET } from './contract'
import { validNativeDiagnostic } from './diagnosticObservation'
import { confirmationInputs, evaluateRuns, pairRuns } from './evaluate'
import { verifyNativeBinding } from './native'
import { renderReport } from './report'
import { captureIdentity } from './stage'

const options = parseOptions(process.argv.slice(2))
const interruption = new AbortController()
options.signal = interruption.signal
const onSignal = () => interruption.abort()
process.on('SIGINT', onSignal)
process.on('SIGTERM', onSignal)
const startedAt = new Date().toISOString()
const initialLoad = loadavg()
const processors = cpus()
let finishedAt: string | undefined
await mkdir(path.dirname(options.output), { recursive: true })
await mkdir(options.output)
const runs: Run[] = []
const diagnostics: Run[] = []
const confirmations: string[] = []
let identity: Awaited<ReturnType<typeof captureIdentity>> | undefined
let native: Awaited<ReturnType<typeof verifyNativeBinding>> | undefined
let commit: string | undefined
let failure: string | undefined

async function persist() {
  const verdict = evaluateRuns(runs, options, confirmations, diagnostics)
  if (failure) {
    verdict.status = 'incomplete'
  }
  const report = {
    schemaVersion: 1,
    contract: CONTRACT,
    mode: options.mode,
    runtime: options.runtime,
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    environment: { startedAt, finishedAt, osRelease: release(), cpuModels: [...new Set(processors.map(cpu => cpu.model))], logicalCpuCount: processors.length, totalMemoryBytes: totalmem(), loadavgStart: initialLoad, loadavgEnd: finishedAt ? loadavg() : undefined },
    commit,
    identity,
    native,
    target: TARGET,
    buildPairs: options.buildPairs,
    hmrPairs: options.hmrPairs,
    inputs: INPUTS,
    confirmations,
    diagnostics,
    runs,
    verdict,
    failure,
    runtimeValidation: { headless: 'not-run', stableIde: 'not-run', physicalDevices: 'not-run' },
    crossPlatformValidation: 'not-run',
  }
  await writeFile(path.join(options.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(path.join(options.output, 'README.md'), renderReport(options, verdict, diagnostics))
  return verdict
}

async function collectBatch(batch: Run['batch'], selection?: string[]) {
  for (const input of INPUTS) {
    for (const kind of ['build', 'hmr'] as const) {
      if ((kind === 'build' && !input.build) || (selection && !selection.includes(`${kind}:${input.id}`))) {
        continue
      }
      const count = kind === 'build' ? options.buildPairs : options.hmrPairs
      for (let pair = 0; pair < count; pair++) {
        for (const side of sideOrder(pair)) {
          assertCollectionActive(options)
          console.log(`[native-benchmark] ${batch} ${kind} ${input.id} pair=${pair + 1}/${count} native=${side}`)
          const run = await collectRun(options, input, kind, side, pair, batch)
          runs.push(run)
          await persist()
          if (run.error) {
            throw new Error(`Collection failed; later samples were not started: ${run.error}`)
          }
        }
      }
    }
  }
}

try {
  commit = (await execa('git', ['rev-parse', 'HEAD'], { cwd: options.root })).stdout.trim()
  const dirty = (await execa('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: options.root })).stdout.trim()
  if (options.mode === 'full' && dirty) {
    throw new Error('Full acceptance requires a clean, committed checkout')
  }
  await readFile(path.join(options.root, 'packages/weapp-vite/dist/cli.mjs'))
  native = await verifyNativeBinding(options.nativePath)
  identity = await captureIdentity(options)
  options.inputIdentities = Object.fromEntries(INPUTS.map(input => [input.source, identity![input.source]!]))
  await persist()
  for (const input of INPUTS.filter(input => input.build)) {
    assertCollectionActive(options)
    console.log(`[native-benchmark] diagnostic ${input.id}; excluded from paired timings`)
    const run = await collectRun(options, input, 'build', 'on', 0, 'primary', true)
    diagnostics.push(run)
    await persist()
    if (run.error) {
      throw new Error(`Native diagnostic failed; later samples were not started: ${run.error}`)
    }
  }
  if (diagnostics.some(run => !validNativeDiagnostic(run))) {
    throw new Error('Native process diagnostic failed or the fixed target was not exercised; paired collection was not started')
  }
  await collectBatch('primary')
  assertCollectionActive(options)
  if (options.mode === 'full') {
    confirmations.push(...confirmationInputs(pairRuns(runs, options, 'primary')))
    await persist()
    if (confirmations.length) {
      await collectBatch('confirmation', confirmations)
    }
  }
  assertCollectionActive(options)
  if (JSON.stringify(identity) !== JSON.stringify(await captureIdentity(options)) || native.digest !== (await verifyNativeBinding(options.nativePath)).digest) {
    throw new Error('Frozen source, dist, driver, lockfile or native binding changed during collection')
  }
}
catch (error) {
  failure = normalizeRoots(String(error), [options.output, options.root])
}
finishedAt = new Date().toISOString()
const verdict = await persist()
process.off('SIGINT', onSignal)
process.off('SIGTERM', onSignal)
console.log(`[native-benchmark] ${verdict.status}; report=${path.relative(options.root, path.join(options.output, 'report.json'))}`)
if (!['passed', 'smoke-passed'].includes(verdict.status)) {
  process.exitCode = 1
}
