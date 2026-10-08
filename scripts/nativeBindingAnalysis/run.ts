import type { BindingNative } from './replay'
import type { BindingAnalysis, BindingInput } from './source'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { cpus, loadavg } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { collectIgnoredGlobals } from './globals'
import { balancedOrders } from './orders'
import { replayWithFallback, replayWithJs, replayWithJsSummary } from './replay'
import { loadProductionBindingAnalysis } from './source'

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return { p50: sorted[Math.ceil(sorted.length * 0.5) - 1], p95: sorted[Math.ceil(sorted.length * 0.95) - 1] }
}

async function main() {
  if (process.env.WEAPP_VITE_NATIVE === '1') {
    throw new Error('Run with WEAPP_VITE_NATIVE unset/0 to preserve the independent JS baseline')
  }
  const args = process.argv.slice(2)
  const argument = (name: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const bindingPath = argument('binding')
  const previousBindingPath = argument('previous-binding')
  const inputPath = argument('input')
  const output = argument('output')
  const iterations = Number(argument('iterations') ?? '0')
  if (!bindingPath || !inputPath || !output || !Number.isSafeInteger(iterations) || iterations < 0) {
    throw new Error('Expected --binding=<feature-built .node> --input=<capture.json> --output=<new report.json> [--previous-binding=<earlier .node>] [--iterations=0]')
  }
  const raw = await readFile(inputPath, 'utf8')
  const captured = JSON.parse(raw) as {
    schemaVersion: number
    boundary: string
    sourceSha256: string
    inputs: BindingInput[]
    expected: Array<BindingAnalysis | null>
  }
  if (captured.schemaVersion !== 1 || captured.boundary !== 'collectDependencies:normalized-before-parse'
    || !Array.isArray(captured.inputs) || !captured.inputs.length || !Array.isArray(captured.expected)
    || captured.inputs.length !== captured.expected.length
    || captured.inputs.some(input => typeof input?.expression !== 'string'
      || !Array.isArray(input.locals) || input.locals.some(local => typeof local !== 'string')
      || !Array.isArray(input.safeCallNames) || input.safeCallNames.some(name => typeof name !== 'string'))) {
    throw new TypeError('Invalid captured binding requests')
  }
  const source = await loadProductionBindingAnalysis()
  try {
    if (source.sourceSha256 !== captured.sourceSha256) {
      throw new Error('Production binding analysis changed since capture')
    }
    const binding = createRequire(import.meta.url)(path.resolve(bindingPath)) as BindingNative
    const previousBinding = previousBindingPath
      ? createRequire(import.meta.url)(path.resolve(previousBindingPath)) as BindingNative
      : undefined
    const ignored = collectIgnoredGlobals()
    const { inputs, expected } = captured
    const js = replayWithJs(inputs, source.analyze, false)
    const jsCached = replayWithJs(inputs, source.analyze, true)
    const jsSummary = replayWithJsSummary(inputs, source.summarize)
    const native = replayWithFallback(inputs, binding, ignored, source.analyze)
    const nativePrevious = previousBinding && replayWithFallback(inputs, previousBinding, ignored, source.analyze)
    const failures = inputs.flatMap((input, index) => {
      const actual = native.results[index]
      const matches = {
        capturedOracle: isDeepStrictEqual(js[index], expected[index]),
        jsCached: isDeepStrictEqual(jsCached[index], expected[index]),
        jsSummary: isDeepStrictEqual(jsSummary[index], expected[index]),
        native: isDeepStrictEqual(actual, expected[index]),
        ...(nativePrevious ? { nativePrevious: isDeepStrictEqual(nativePrevious.results[index], expected[index]) } : {}),
      }
      return Object.values(matches).every(Boolean) && !native.fallback && !nativePrevious?.fallback
        ? []
        : [{ index, input, matches, expected: expected[index], actual, fallback: native.fallback, previousFallback: nativePrevious?.fallback }]
    })
    const variants = ['js', 'jsCached', 'jsSummary', 'native', ...previousBinding ? ['nativePrevious'] as const : []] as const
    type Variant = typeof variants[number]
    const samples: Array<{ pair: number, order: Variant[] } & Partial<Record<Variant, number>>> = []
    const orders = balancedOrders(variants)
    let warmupCycles = 0
    const startedAt = new Date().toISOString()
    const initialLoad = loadavg()
    const measure = (variant: Variant) => {
      const start = performance.now()
      const result = variant === 'native' || variant === 'nativePrevious'
        ? replayWithFallback(inputs, variant === 'native' ? binding : previousBinding!, ignored, source.analyze)
        : { results: variant === 'jsSummary'
            ? replayWithJsSummary(inputs, source.summarize)
            : replayWithJs(inputs, source.analyze, variant === 'jsCached'), fallback: undefined }
      const duration = performance.now() - start
      if (result.fallback) {
        throw new Error(`Timed native fallback: ${result.fallback}`)
      }
      return duration
    }
    if (!failures.length && iterations) {
      for (let warmup = 0; warmup < 6; warmup++) {
        for (const variant of variants) {
          measure(variant)
        }
        warmupCycles++
      }
      for (let pair = 0; pair < iterations; pair++) {
        const order = orders[pair % orders.length]!
        const values = Object.fromEntries(order.map(variant => [variant, measure(variant)])) as Record<Variant, number>
        samples.push({ pair, order, ...values })
      }
    }
    const report = {
      schemaVersion: 2,
      scope: 'Captured normalized expression analysis only; excludes template normalization, loop merging, manifest generation and complete compilation.',
      inputSha256: createHash('sha256').update(raw).digest('hex'),
      sourceSha256: source.sourceSha256,
      bindingSha256: createHash('sha256').update(await readFile(bindingPath)).digest('hex'),
      previousBindingSha256: previousBindingPath && createHash('sha256').update(await readFile(previousBindingPath)).digest('hex'),
      inputCount: inputs.length,
      uniqueInputs: native.uniqueInputs,
      uniqueExpressions: new Set(inputs.map(input => input.expression)).size,
      nativeCallsPerBatch: native.nativeCalls,
      fallback: native.fallback,
      failures,
      environment: { node: process.version, platform: process.platform, arch: process.arch, cpus: cpus().length, startedAt, finishedAt: new Date().toISOString(), initialLoad, finalLoad: loadavg() },
      warmupCycles,
      orderPeriod: orders.length,
      completedOrderCycles: Math.floor(samples.length / orders.length),
      orderRemainder: samples.length % orders.length,
      fullyBalanced: samples.length > 0 && samples.length % orders.length === 0,
      measured: samples.length ? Object.fromEntries(variants.map(variant => [variant, stats(samples.map(sample => sample[variant]!))])) : undefined,
      samples,
    }
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
    console.log(JSON.stringify({ inputs: inputs.length, uniqueInputs: native.uniqueInputs, failures: failures.length, fallback: native.fallback, measured: report.measured }))
    if (failures.length) {
      process.exitCode = 1
    }
  }
  finally {
    source.dispose()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
