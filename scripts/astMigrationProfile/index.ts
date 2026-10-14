import type { Collection, Measurement } from './types'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { deserialize, serialize } from 'node:v8'
// 取消必须等待当前 worker 终结再释放机器租约，避免遗留采样进程。
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { redactSequenceEvidence } from '../editSequence/evidenceRedaction'
import { compilerCases } from './cases'
import { collectCompilerTrials } from './collection'
import { assertFrozenIdentity, defaultAddonPath, freezeIdentity } from './identity'
import { sha256, summarize } from './results'

export function parseArguments(args: string[]) {
  const values = new Map<string, string>()
  for (const arg of args) {
    const match = /^--(trials|output|addon|build-receipt)=(.+)$/.exec(arg)
    if (match) {
      if (values.has(match[1]!)) {
        throw new Error(`Duplicate argument: --${match[1]}`)
      }
      values.set(match[1]!, match[2]!)
    }
    else if (arg !== '--diagnostic') {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  const trials = Number(values.get('trials') ?? 40)
  if (!Number.isInteger(trials) || trials < 40) {
    throw new Error('--trials must be an integer of at least 40.')
  }
  return { trials, output: values.get('output'), addon: values.get('addon'), receipt: values.get('build-receipt') }
}

async function runOwnedCompilerProfile(args: string[], root: string, environment: NodeJS.ProcessEnv, signal: AbortSignal) {
  const options = parseArguments(args)
  const output = path.resolve(root, options.output ?? '.tmp/real-compiler-entry-profile/report.json')
  const addon = options.addon ? path.resolve(root, options.addon) : defaultAddonPath(root)
  const receiptFile = path.resolve(root, options.receipt ?? '.tmp/real-compiler-entry-profile/build-receipt.json')
  const scratchRoot = path.join(root, '.tmp/real-compiler-entry-profile')
  await mkdir(scratchRoot, { recursive: true })
  const scratch = await mkdtemp(path.join(scratchRoot, 'workers-'))
  let collection: Collection = { status: 'incomplete', expectedWallSamples: options.trials * compilerCases.length * 8, expectedDiagnosticSamples: compilerCases.length * 8, samples: [], errors: [] }
  let frozen: Awaited<ReturnType<typeof freezeIdentity>> | undefined
  const metadata = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: 'Real compileVueFile SFC entry; excludes CLI build/HMR, native-only apps, Tailwind final CSS, host runtime.',
    entry: 'packages-runtime/wevu-compiler/dist/index.mjs#compileVueFile',
    trials: options.trials,
    cases: compilerCases,
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model },
    method: {
      pairs: 'Serial fresh children; off/on for even trials, on/off for odd trials; identical source/path/options.',
      cold: 'First complete target compilation after package import and production config/resolver/registry preparation; OS cache is not flushed.',
      warm: 'Independent child, same options and two complete identical warmups, then one measured compilation.',
      wall: 'Only awaited public compileVueFile; raw release addon; no GC forcing, inspector, native proxy or counters.',
      addon: 'addonLoadMs measures the first raw release addon require before compiler import, including dlopen/initialization; off is zero. This cost is excluded from compileMs and reported separately.',
      diagnostic: 'Separate pass after all wall samples; exact output parity with raw addon; V8 sampling, CPU/GC and pass-through CJS/native counters.',
      gc: 'Only GC events whose startTime lies inside the actual awaited compileVueFile interval; excludes earlier forced/preparation GC even when delivered later.',
      parity: 'Raw v8-serialized outcomes compared before report redaction; includes full map/sourcesContent, warnings order, diagnostics and metadata. Error stack is excluded; code/location/cause retained.',
      counters: 'Rust parse and total JS fallback counts are null: release binding does not expose them. Rejected batch items and thrown native calls are measured separately.',
      memory: 'RSS at compile boundaries and whole child process maxRSS, including preparation/import; not allocation or retained memory.',
    },
  }
  const rawDirectory = `${output}.raw`
  const savedOutcomes = new WeakMap<object, { sha256: string, file: string }>()
  const checkpoint = async () => {
    await mkdir(path.dirname(output), { recursive: true })
    await mkdir(rawDirectory, { recursive: true })
    const samples = []
    for (const sample of collection.samples) {
      let reference = savedOutcomes.get(sample.outcome)
      if (!reference) {
        const bytes = serialize(sample.outcome)
        const digest = sha256(bytes)
        const artifact = path.join(rawDirectory, `${digest}.bin`)
        await writeFile(artifact, bytes)
        reference = { sha256: digest, file: path.relative(root, artifact).replaceAll('\\', '/') }
        savedOutcomes.set(sample.outcome, reference)
      }
      samples.push({ ...sample, outcome: { status: sample.outcome.status, rawEvidence: reference } })
    }
    const report = redactSequenceEvidence({ ...metadata, frozen, ...collection, samples, summary: summarize(collection) }, root)
    const temporary = `${output}.partial`
    await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`)
    await rename(temporary, output)
  }
  try {
    await checkpoint()
    frozen = await freezeIdentity(root, compilerCases, addon)
    const receipt: unknown = JSON.parse(await readFile(receiptFile, 'utf8'))
    if (!receipt || typeof receipt !== 'object' || !('release' in receipt) || receipt.release !== true
      || !('status' in receipt) || receipt.status !== 'passed' || !('frozen' in receipt)
      || JSON.stringify(receipt.frozen) !== JSON.stringify(frozen)) {
      throw new Error('Successful fresh release build receipt does not match current inputs/artifacts. Run scripts/astMigrationProfile/prepare.ts before collecting.')
    }
    let sampleIndex = 0
    await collectCompilerTrials(compilerCases, options.trials, true, async (cell) => {
      const fixture = compilerCases.find(item => item.id === cell.caseId)!
      const requestFile = path.join(scratch, `${sampleIndex}.request.bin`)
      const resultFile = path.join(scratch, `${sampleIndex}.result.bin`)
      const diagnosticProxy = path.join(scratch, `${sampleIndex}.native.cjs`)
      sampleIndex++
      await writeFile(requestFile, serialize({ root, addon, fixture, cell, output: resultFile, diagnosticProxy }))
      const workerArgs = [...(cell.metric === 'diagnostic' ? ['--expose-gc'] : []), '--import', 'tsx', path.join(root, 'scripts/astMigrationProfile/worker.ts'), requestFile]
      const env = { ...process.env, ...environment }
      delete env.WEAPP_VITE_NATIVE
      delete env.WEAPP_VITE_NATIVE_AST_PATH
      delete env.NAPI_RS_NATIVE_LIBRARY_PATH
      await execa(process.execPath, workerArgs, { cwd: root, env, timeout: 120_000, cancelSignal: signal })
      const sample = deserialize(await readFile(resultFile)) as Measurement
      await rm(requestFile)
      await rm(resultFile)
      await rm(diagnosticProxy, { force: true })
      return sample
    }, async (state) => {
      collection = state
      await checkpoint()
      if (state.samples.length && state.samples.length % 64 === 0) {
        process.stderr.write(`real compiler entry: ${state.samples.length}/${state.expectedWallSamples + state.expectedDiagnosticSamples}\n`)
      }
    })
    await assertFrozenIdentity(root, compilerCases, addon, frozen)
  }
  catch (error) {
    collection.status = 'failed'
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    if (!collection.errors.includes(message)) {
      collection.errors.push(message)
    }
  }
  finally {
    try {
      await rm(scratch, { recursive: true, force: true })
    }
    catch (error) {
      collection.status = 'failed'
      collection.errors.push(`Worker cleanup failed: ${String(error)}`)
    }
    await checkpoint()
  }
  if (collection.status !== 'passed') {
    throw new Error('Real compiler profile failed; saved partial report contains completed samples and the original failure.')
  }
  process.stdout.write(`${JSON.stringify(summarize(collection), null, 2)}\n`)
  return collection
}

export async function runCompilerProfile(args: string[], root = fileURLToPath(new URL('../..', import.meta.url))) {
  parseArguments(args)
  const { withMachineE2ELease } = await import('../../packages/devtools-runtime/src/lease/machine')
  const { createSuiteSignalScope } = await import('../../e2e/scripts/suiteRunner/signals')
  const scope = createSuiteSignalScope()
  try {
    return await withMachineE2ELease(lease => runOwnedCompilerProfile(args, root, lease.environment, scope.signal))
  }
  finally {
    scope.dispose()
  }
}
