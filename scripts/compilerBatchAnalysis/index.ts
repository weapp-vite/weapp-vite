import type { Collection } from './collection'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { cpus, loadavg } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { redactSequenceEvidence } from '../editSequence/evidenceRedaction'
import { collect, timingSummary } from './collection'
import { createFixtures } from './fixtures'
import { captureIdentity } from './identity'
import { createLauncher } from './launch'
import { hash } from './outcome'
import { CONTRACT, PAIRS, WARMUP } from './types'

export function parseOptions(args: string[]) {
  const values = new Map<string, string>()
  for (const arg of args) {
    const index = arg.indexOf('=')
    const key = arg.slice(0, index)
    const value = arg.slice(index + 1)
    if (index < 0 || !['--mode', '--output', '--native-path'].includes(key) || !value || values.has(key)) {
      throw new Error('Expected --mode=check|full --output=<new directory> --native-path=<binding>; pair count is fixed')
    }
    values.set(key, value)
  }
  const mode = values.get('--mode') ?? 'check'
  if (!['check', 'full'].includes(mode) || !values.get('--output') || !values.get('--native-path')) {
    throw new Error('Expected check/full mode, new output directory and native binding path')
  }
  return { mode: mode as 'check' | 'full', output: path.resolve(values.get('--output')!), nativePath: path.resolve(values.get('--native-path')!) }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const root = fileURLToPath(new URL('../../', import.meta.url))
  await mkdir(path.dirname(options.output), { recursive: true })
  await mkdir(options.output)
  const privateDirectory = path.join(options.output, '.private')
  await mkdir(privateDirectory, { mode: 0o700 })
  const abort = new AbortController()
  const interrupt = () => abort.abort()
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', interrupt)
  const startedAt = new Date().toISOString()
  const initialLoad = loadavg()
  let state: Collection = { diagnostics: [], pairs: [] }
  let fixtures: Awaited<ReturnType<typeof createFixtures>> = []
  let identity: Awaited<ReturnType<typeof captureIdentity>> | undefined
  let finalIdentity: typeof identity
  let fixtureIdentity: string | undefined
  let failure: string | undefined
  let complete = false
  const persist = async () => {
    const summary = {
      schemaVersion: 1,
      contract: CONTRACT,
      status: failure ? 'failed' : complete ? 'complete' : 'incomplete',
      mode: options.mode,
      scope: 'Real production compileVueFile entry; no experimental transform loader or source replacement. Not build/HMR performance acceptance.',
      requestedPairs: options.mode === 'full' ? PAIRS : 0,
      completedPairs: state.pairs.length,
      warmupsPerFixture: WARMUP,
      identity,
      finalIdentity,
      identitiesUnchanged: identity && finalIdentity ? JSON.stringify(identity) === JSON.stringify(finalIdentity) : null,
      fixtures: fixtures.map(({ source, ...fixture }) => ({ ...fixture, sourceSha256: hash(source) })),
      fixtureIdentity,
      environment: { node: process.version, platform: process.platform, arch: process.arch, logicalCpus: cpus().length, startedAt, observedAt: new Date().toISOString(), initialLoad, currentLoad: loadavg() },
      diagnostics: state.diagnostics,
      pairs: state.pairs,
      timing: timingSummary(state, fixtures),
      failure,
      limitations: [
        'Each side of every pair starts a fresh Node process and runs the same fixture order; each fixture is measured after two complete warmups. This is warm compiler entry timing, not cold startup, clean OS caches, or project build time.',
        'Wall timing covers only the complete production call. Output serialization, hashing, comparison and RSS snapshots are outside the timing window; no observer or binding wrapper is installed in timing workers.',
        'Separate off/on diagnostic workers use the same two warmups and observe CPU, GC, Babel wrappers and native calls. Diagnostic overhead and wall values never enter paired timing summaries.',
        'Babel counters cover compiler wrappers only, not Vue/Oxc/Rust internal parses. Native call/input counts are not parse counts. Stage wall spans overlap and must not be added. Root CPU includes the entire worker process, not per-phase CPU.',
        'GC is scoped to the independent diagnostic call and its wrapper. GC entry duration is not CPU time; wall minus CPU is not inferred wait time. Worker threads and child processes are not profiled separately.',
        'RSS is a worker snapshot after compilation, not peak RSS or process-tree RSS. The fixed fault worker calls the no-default-export fixture once without warmup.',
        'Full returned objects, maps, warnings and supported error own fields, descriptors and prototypes are compared on every measured call and warmup. Babel clone closures use function structure/source plus three behavior probes, not reference identity; unsupported shapes fail closed. These probes are not a proof of arbitrary function equivalence. Original error inspections and stacks are retained privately; stacks are excluded from semantic equality.',
        'Within each worker, comparison uses actual returned objects. Cross-process comparison and stable tagged hashes use full V8-transferred data snapshots; arbitrary user prototype methods are not preserved. Error prototypes and descriptors are explicitly encoded before transfer.',
        'Source, consumed AST dist, addon and input hashes are rechecked at completion. Installed transitive dependency contents are not exhaustively hashed; lockfile identity is retained.',
        'The private directory contains full V8-serialized results, input jobs and error stacks with original paths. Only summary.json is intended for sharing; no performance threshold is evaluated by this diagnostic tool.',
      ],
    }
    await writeFile(path.join(options.output, 'summary.json'), `${JSON.stringify(redactSequenceEvidence(summary, options.output), null, 2)}\n`)
  }
  try {
    fixtures = await createFixtures(root)
    fixtureIdentity = hash(JSON.stringify(fixtures))
    identity = await captureIdentity(root, options.nativePath)
    const binding = createRequire(import.meta.url)(options.nativePath) as { analyzeCompilerScriptsNative?: (inputs: Array<{ code: string, filename: string }>) => Array<{ hasDefaultExport?: boolean } | null> }
    if (binding.analyzeCompilerScriptsNative?.([{ code: 'export default {}', filename: 'probe.ts' }])?.[0]?.hasDefaultExport !== true) {
      throw new Error('Native compiler batch entry is missing or failed its correctness probe')
    }
    await persist()
    state = await collect(fixtures, options.mode === 'full', createLauncher(root, privateDirectory, options.nativePath, abort.signal), async (next) => {
      state = next
      await persist()
      if (next.pairs.length) {
        process.stderr.write(`compiler batch: ${next.pairs.length}/${PAIRS} pairs complete\n`)
      }
    })
    finalIdentity = await captureIdentity(root, options.nativePath)
    if (JSON.stringify(identity) !== JSON.stringify(finalIdentity) || fixtureIdentity !== hash(JSON.stringify(await createFixtures(root)))) {
      throw new Error('Compiler source, addon, driver or fixtures changed during collection')
    }
    complete = true
  }
  catch (error) {
    failure = error instanceof Error ? error.message : String(error)
    await writeFile(path.join(privateDirectory, 'failure.txt'), error instanceof Error ? error.stack ?? error.message : String(error), { mode: 0o600 })
    if (identity && !finalIdentity) {
      finalIdentity = await captureIdentity(root, options.nativePath).catch(() => undefined)
    }
  }
  finally {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
    await persist()
  }
  process.stdout.write(`${JSON.stringify({ status: complete ? 'complete' : 'failed', mode: options.mode, pairs: state.pairs.length, summary: 'summary.json' })}\n`)
  if (!complete) {
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
