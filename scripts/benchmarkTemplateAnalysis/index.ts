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
import { createAnalysisControl, createTemplateAnalysisInputs, instrumentTemplateParser } from './control'
import { assertAnalysisSamples, summarizeAnalysisSamples } from './results'

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
  try {
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
    const samples: AnalysisSample[] = []
    for (let trial = 0; trial < trials; trial++) {
      const order = trial % 2 ? variants.toReversed() : variants
      for (const condition of ['cold', 'warm'] as const) {
        for (const metric of ['timing', 'allocation'] as const) {
          for (const variant of order) {
            const result = await exec(process.execPath, ['--expose-gc', path.join(scratch, 'worker.mjs'), path.join(scratch, `${variant}.mjs`), condition, metric], {
              timeout: 120_000,
              throwOnError: true,
            })
            samples.push({ ...JSON.parse(result.stdout) as AnalysisSample, variant, trial })
          }
        }
      }
      process.stderr.write(`template analysis: ${trial + 1}/${trials} paired trials complete\n`)
    }
    assertAnalysisSamples(samples)
    const report = {
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
      summary: summarizeAnalysisSamples(samples),
      samples,
    }
    await mkdir(path.dirname(path.resolve(output)), { recursive: true })
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`)
  }
  finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
