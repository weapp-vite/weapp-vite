import type { AnalysisCollection } from './collection'
import type { AnalysisVariant } from './control'
import type { AnalysisSample } from './results'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { exec } from 'tinyexec'
import { redactSequenceEvidence } from '../editSequence/evidenceRedaction'
import { collectAnalysisTrials } from './collection'
import { createAnalysisControl, createTemplateAnalysisInputs, instrumentTemplateParser } from './control'

async function main() {
  const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
  const trials = Number(process.argv.find(arg => arg.startsWith('--trials='))?.split('=')[1] ?? 7)
  if (!Number.isInteger(trials) || trials < 1) {
    throw new Error('--trials must be a positive integer.')
  }
  const output = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
  if (!output) {
    throw new Error('Specify --output=<report.json>. Runs are exploratory unless --formal is supplied.')
  }
  const scratchRoot = path.join(root, '.codex-tmp')
  await mkdir(scratchRoot, { recursive: true })
  const scratch = await mkdtemp(path.join(scratchRoot, 'template-analysis-'))
  const sourceHashes: Record<string, string> = {}
  let collection: AnalysisCollection = { status: 'incomplete', expectedSamples: trials * 8, samples: [], summary: [], errors: [] }
  const metadata = {
    schemaVersion: 1,
    evidence: process.argv.includes('--formal') ? 'formal' : 'exploratory',
    generatedAt: new Date().toISOString(),
    commit: (await exec('git', ['rev-parse', 'HEAD'], { nodeOptions: { cwd: root }, throwOnError: true })).stdout.trim(),
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model },
    method: {
      control: 'Same current compiler and dependencies; only component tag collection uses the two-pass algorithm from 585a02c65.',
      cold: 'Fresh process; first complete compilation of the 10/100/1000-row suite. Module import time is recorded separately; OS file caches are not flushed.',
      warm: 'Fresh process; two complete suite warmups before the measured suite.',
      allocation: 'Separate process pass with V8 HeapProfiler 16 KiB sampling, including collected objects; estimated allocated bytes, not retained heap.',
      memory: 'GC before/after; RSS and heap boundaries plus whole-process peak RSS. Peak includes module startup; retained delta includes output objects.',
      timings: 'Complete compileVueFile calls, without profiler sampling. No speedup or memory threshold is assumed.',
    },
    inputHash: createHash('sha256').update(JSON.stringify(createTemplateAnalysisInputs())).digest('hex'),
    sourceHashes,
    trials,
  }
  const checkpoint = async () => {
    await mkdir(path.dirname(path.resolve(output)), { recursive: true })
    await writeFile(output, `${JSON.stringify(redactSequenceEvidence({ ...metadata, ...collection }, root), null, 2)}\n`)
  }
  const recordFailure = (error: unknown) => {
    collection.status = 'failed'
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    if (!collection.errors.includes(message)) {
      collection.errors.push(message)
    }
  }
  try {
    await checkpoint()
    for (const filename of ['pnpm-lock.yaml', 'packages-runtime/wevu-compiler/src/index.ts']) {
      sourceHashes[filename] = createHash('sha256').update(await readFile(path.join(root, filename))).digest('hex')
    }
    const variants: AnalysisVariant[] = ['duplicate-control', 'shared']
    for (const variant of variants) {
      await build({
        entryPoints: [path.join(root, 'packages-runtime/wevu-compiler/src/index.ts')],
        outfile: path.join(scratch, `${variant}.mjs`),
        bundle: true,
        platform: 'node',
        format: 'esm',
        packages: 'external',
        plugins: [{
          name: 'same-source-analysis-control',
          setup(plugin) {
            plugin.onLoad({ filter: /(?:componentSources|vueTemplateTags)\.ts$/ }, async ({ path: filename }) => {
              let source = await readFile(filename, 'utf8')
              sourceHashes[path.relative(root, filename).replaceAll('\\', '/')] = createHash('sha256').update(source).digest('hex')
              if (filename.endsWith('componentSources.ts') && variant === 'duplicate-control') {
                source = createAnalysisControl(source)
              }
              if (filename.endsWith('vueTemplateTags.ts')) {
                source = instrumentTemplateParser(source)
              }
              return { contents: source, loader: 'ts' }
            })
          },
        }],
      })
    }
    await build({
      entryPoints: [path.join(root, 'scripts/benchmarkTemplateAnalysis/worker.ts')],
      outfile: path.join(scratch, 'worker.mjs'),
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
    })
    await collectAnalysisTrials(trials, async ({ variant, condition, metric }) => {
      const result = await exec(process.execPath, ['--expose-gc', path.join(scratch, 'worker.mjs'), path.join(scratch, `${variant}.mjs`), condition, metric], {
        timeout: 120_000,
        throwOnError: true,
      })
      return JSON.parse(result.stdout) as AnalysisSample
    }, async (state) => {
      collection = state
      await checkpoint()
      if (state.status === 'incomplete' && state.samples.length > 0 && state.samples.length % 8 === 0) {
        process.stderr.write(`template analysis: ${state.samples.length / 8}/${trials} paired trials complete\n`)
      }
    })
  }
  catch (error) {
    recordFailure(error)
  }
  finally {
    try {
      await rm(scratch, { recursive: true, force: true })
    }
    catch (error) {
      recordFailure(error)
    }
    await checkpoint()
  }
  if (collection.status !== 'passed') {
    throw new Error('Compiler analysis collection failed; see the saved partial report.')
  }
  process.stdout.write(`${JSON.stringify(collection.summary, null, 2)}\n`)
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
