/* eslint-disable no-console */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { bundleRequire } from 'rolldown-require'
import { unrun } from 'unrun'

const iterations = Number.parseInt(process.env.BENCH_ITERATIONS ?? '5', 10)

const scenarios = [
  { name: 'tiny-static', moduleCount: 25 },
  { name: 'medium-mixed', moduleCount: 100, dynamicEvery: 10 },
  { name: 'large-static', moduleCount: 200 },
]

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error(`Invalid BENCH_ITERATIONS value: ${iterations}`)
}

async function main() {
  console.log(
    `Running ${iterations} iteration(s) per library. Set BENCH_ITERATIONS to override.\n`,
  )

  for (const scenario of scenarios) {
    const fixture = await createFixtureGraph(scenario)
    const stats = []

    stats.push(
      await benchLibrary(
        'rolldown-require',
        () =>
          timeCall(() =>
            bundleRequire({
              filepath: fixture.entry,
              cwd: fixture.root,
              format: 'esm',
            }),
          ),
      ),
    )

    stats.push(
      await benchLibrary(
        'unrun',
        async () => {
          await cleanUnrunCache()
          return timeCall(() =>
            unrun({
              path: fixture.entry,
              preset: 'bundle-require',
            }),
          )
        },
      ),
    )

    await rm(fixture.root, { recursive: true, force: true })
    printScenarioStats(scenario, stats)
  }
}

async function createFixtureGraph(scenario) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), `rolldown-bench-${scenario.name}-`),
  )
  const dynamicTargets = []

  for (let i = 0; i < scenario.moduleCount; i += 1) {
    const header = i === 0 ? '' : `import { value as prev } from './mod${i - 1}.ts'\n`
    const dynamic = scenario.dynamicEvery && i > 0 && i % scenario.dynamicEvery === 0
      ? dynamicModuleSource(i)
      : ''
    if (dynamic) {
      dynamicTargets.push(i)
    }

    const body = `${header}export const value = ${i === 0 ? 0 : `prev + ${i}`}
${dynamic}`

    await writeFile(path.join(root, `mod${i}.ts`), body, 'utf8')
  }

  const dynamicImports = dynamicTargets
    .map(idx => `import * as dyn${idx} from './mod${idx}.ts'`)
    .join('\n')
  const dynamicAccumulator = dynamicTargets.length
    ? `const dynTotal = (await Promise.all([
  ${dynamicTargets
    .map(idx => `dyn${idx}.loadDynamic ? dyn${idx}.loadDynamic() : Promise.resolve(0)`)
    .join(',\n  ')}
])).reduce((sum, val) => sum + (Number(val) || 0), 0)`
    : 'const dynTotal = 0'

  const entrySource = `${dynamicImports}
import { value as baseValue } from './mod${scenario.moduleCount - 1}.ts'

export async function run() {
  ${dynamicAccumulator}
  return baseValue + dynTotal
}
`

  const entry = path.join(root, 'index.ts')
  await writeFile(entry, entrySource, 'utf8')

  return { root, entry }
}

function dynamicModuleSource(index) {
  return `
export async function loadDynamic() {
  const mod = await import('./mod${index - 1}.ts')
  return mod.value + ${index}
}
`
}

async function benchLibrary(library, run) {
  const durations = []
  const rss = []
  let dependencies = 0

  for (let i = 0; i < iterations; i += 1) {
    const sample = await run()
    durations.push(sample.durationMs)
    rss.push(sample.rssDelta)
    dependencies = sample.dependencies
  }

  return {
    library,
    duration: summarize(durations),
    rss: summarize(rss),
    dependencies,
  }
}

async function timeCall(fn) {
  maybeGc()
  const startRss = process.memoryUsage().rss
  const start = performance.now()
  const result = await fn()
  const durationMs = performance.now() - start
  const rssDelta = Math.max(0, process.memoryUsage().rss - startRss)

  return {
    durationMs,
    rssDelta,
    dependencies: Array.isArray(result.dependencies)
      ? result.dependencies.length
      : 0,
  }
}

async function cleanUnrunCache() {
  const localCache = path.join(process.cwd(), 'node_modules', '.unrun')
  const fallbackCache = path.join(os.tmpdir(), 'unrun-cache')
  await Promise.all([
    rm(localCache, { recursive: true, force: true }),
    rm(fallbackCache, { recursive: true, force: true }),
  ])
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const total = values.reduce((sum, val) => sum + val, 0)
  const mid = Math.floor(sorted.length / 2)
  return {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean: values.length ? total / values.length : 0,
    median:
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid] ?? 0,
  }
}

function printScenarioStats(scenario, stats) {
  console.log(
    `Scenario: ${scenario.name} (${scenario.moduleCount} modules${
      scenario.dynamicEvery
        ? `, dynamic import every ${scenario.dynamicEvery}`
        : ''
    })`,
  )

  for (const stat of stats) {
    const { duration, rss } = stat
    console.log(
      [
        `${stat.library.padEnd(17)}`,
        `avg ${duration.mean.toFixed(2)}ms`,
        `median ${duration.median.toFixed(2)}ms`,
        `min ${duration.min.toFixed(2)}ms`,
        `max ${duration.max.toFixed(2)}ms`,
        `rssΔ median ${bytesToMb(rss.median)} MB`,
        `deps ${stat.dependencies}`,
      ].join(' | '),
    )
  }

  console.log('')
}

function bytesToMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2)
}

function maybeGc() {
  const { gc } = globalThis
  if (typeof gc === 'function') {
    gc()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
