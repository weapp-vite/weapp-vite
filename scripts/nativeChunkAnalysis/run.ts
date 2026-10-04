import type { ChunkBinding, ChunkInput } from './rewrite'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { cpus, loadavg } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { createChunkFixtures } from './fixtures'
import { createChunk, rewriteWithNative, rewriteWithProduction } from './rewrite'

const require = createRequire(import.meta.url)
const options = { dependencies: { 'ui-lib': '1.0.0', 'tdesign-miniprogram': '1.0.0' }, globalName: 'wpi' }

async function collectInputs(directory: string, prefix = ''): Promise<ChunkInput[]> {
  const inputs: ChunkInput[] = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const filename = `${prefix}${entry.name}`
    if (entry.isDirectory()) {
      inputs.push(...await collectInputs(path.join(directory, entry.name), `${filename}/`))
    }
    else if (entry.isFile() && /\.[cm]?js$/.test(entry.name)) {
      inputs.push({ filename, code: await readFile(path.join(directory, entry.name), 'utf8') })
    }
  }
  return inputs
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return { p50: sorted[Math.ceil(sorted.length * 0.5) - 1], p95: sorted[Math.ceil(sorted.length * 0.95) - 1] }
}

async function main() {
  if (process.env.WEAPP_VITE_NATIVE === '1') {
    throw new Error('Run with WEAPP_VITE_NATIVE unset/0 to keep the production baseline independent')
  }
  const args = process.argv.slice(2)
  const bindingPath = args.find(arg => arg.startsWith('--binding='))?.slice('--binding='.length)
  const inputDirectory = args.find(arg => arg.startsWith('--input-dir='))?.slice('--input-dir='.length)
  const inputBundle = args.find(arg => arg.startsWith('--input-bundle='))?.slice('--input-bundle='.length)
  const output = args.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
  const iterations = Number(args.find(arg => arg.startsWith('--iterations='))?.slice('--iterations='.length) ?? '0')
  if (!bindingPath || !output || !Number.isSafeInteger(iterations) || iterations < 0 || (inputBundle && inputDirectory)) {
    throw new Error('Expected --binding=<feature-built .node> --output=<new report.json> [--input-dir=<JavaScript corpus> | --input-bundle=<capture.json>] [--iterations=0]')
  }
  const binding = require(path.resolve(bindingPath)) as ChunkBinding
  if (typeof binding.analyzeChunkRewritesNative !== 'function') {
    throw new TypeError('Binding lacks experimental-chunk-analysis; use a feature-enabled build')
  }
  let inputs = inputDirectory ? await collectInputs(inputDirectory) : createChunkFixtures()
  let assetsIgnored: number | undefined
  let captureConfiguration: unknown
  if (inputBundle) {
    const captured = JSON.parse(await readFile(inputBundle, 'utf8')) as { schemaVersion?: number, boundary?: string, assetsIgnored?: number, inputs?: ChunkInput[], configuration?: unknown }
    if (captured.schemaVersion !== 1 || captured.boundary !== 'resolveDevHmrRewriteBundle:before-script-analysis'
      || !Array.isArray(captured.inputs) || captured.inputs.some(input => typeof input?.filename !== 'string' || !input.filename || typeof input?.code !== 'string')
      || new Set(captured.inputs.map(input => input.filename)).size !== captured.inputs.length) {
      throw new TypeError('Invalid production chunk capture')
    }
    inputs = captured.inputs
    assetsIgnored = captured.assetsIgnored
    captureConfiguration = captured.configuration
  }
  if (!inputs.length) {
    throw new Error('The input corpus is empty')
  }
  const initialLoad = loadavg()
  const checks: Array<{ filename: string, inline: boolean, code: boolean, map: boolean, fallback?: string }> = []
  let requireLiterals = 0
  let platformApiObjects = 0
  let nativeInputs = 0
  let skippedInputs = 0
  for (const inline of [false, true]) {
    const expected = rewriteWithProduction(inputs.map(input => createChunk(input, inline)), options)
    const actual = rewriteWithNative(inputs.map(input => createChunk(input, inline)), binding, options)
    if (!inline) {
      requireLiterals = actual.summaries?.reduce((total, summary) => total + summary.requireLiterals.length, 0) ?? 0
      platformApiObjects = actual.summaries?.reduce((total, summary) => total + summary.platformApiObjects.length, 0) ?? 0
      nativeInputs = actual.nativeInputs
      skippedInputs = actual.skippedInputs
    }
    for (const [index, chunk] of actual.chunks.entries()) {
      checks.push({
        filename: inputs[index]!.filename,
        inline,
        code: chunk.code === expected[index]!.code,
        map: isDeepStrictEqual(JSON.parse(JSON.stringify(chunk.map)), JSON.parse(JSON.stringify(expected[index]!.map))),
        fallback: actual.fallback,
      })
    }
  }

  const failures = checks.filter(check => !check.code || !check.map || check.fallback)
  const samples: Array<{ pair: number, order: string, jsMs: number, nativeMs: number }> = []
  if (!failures.length && iterations) {
    const measure = (native: boolean) => {
      const chunks = inputs.map(input => createChunk(input))
      const start = performance.now()
      const result = native ? rewriteWithNative(chunks, binding, options) : undefined
      if (!native) {
        rewriteWithProduction(chunks, options)
      }
      const duration = performance.now() - start
      if (result?.fallback) {
        throw new Error(`Timed native fallback: ${result.fallback}`)
      }
      return duration
    }
    for (let warmup = 0; warmup < 8; warmup++) {
      measure(warmup % 2 === 0)
      measure(warmup % 2 !== 0)
    }
    for (let pair = 0; pair < iterations; pair++) {
      const nativeFirst = pair % 2 !== 0
      const first = measure(nativeFirst)
      const second = measure(!nativeFirst)
      samples.push({ pair, order: nativeFirst ? 'native-js' : 'js-native', jsMs: nativeFirst ? second : first, nativeMs: nativeFirst ? first : second })
    }
  }
  const report = {
    schemaVersion: 1,
    scope: 'production platform npm/API rewrite functions versus feature-gated native summary adapter; not an end-to-end build',
    corpus: inputBundle ? 'captured-production-output-chunks' : inputDirectory ? 'emitted-javascript-including-assets' : 'synthetic-semantic-fixtures',
    replayOptions: { platform: 'alipay', ...options },
    assetsIgnored,
    captureConfiguration,
    inputs: inputs.map(input => ({ filename: input.filename, bytes: Buffer.byteLength(input.code), sha256: createHash('sha256').update(input.code).digest('hex') })),
    bindingSha256: createHash('sha256').update(await readFile(bindingPath)).digest('hex'),
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpus: cpus().length, initialLoad, finalLoad: loadavg() },
    checks,
    requireLiterals,
    platformApiObjects,
    nativeInputs,
    skippedInputs,
    failures: failures.length,
    measured: samples.length ? { js: stats(samples.map(sample => sample.jsMs)), native: stats(samples.map(sample => sample.nativeMs)) } : undefined,
    samples,
  }
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`${JSON.stringify({ inputs: inputs.length, checks: checks.length, failures, measured: report.measured })}\n`)
  if (failures.length) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
