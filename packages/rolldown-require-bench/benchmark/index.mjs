/* eslint-disable no-console */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { bundleRequire } from 'rolldown-require'
import { unrun } from 'unrun'

const iterations = Number.parseInt(process.env.BENCH_ITERATIONS ?? '5', 10)
const reportDir = path.join(process.cwd(), 'benchmark')
const reportJson = path.join(reportDir, 'report.json')
const reportMd = path.join(reportDir, 'report.md')

const scenarios = [
  { name: 'tiny-static', moduleCount: 25 },
  { name: 'medium-mixed', moduleCount: 100, dynamicEvery: 10 },
  { name: 'large-static', moduleCount: 200 },
]

const modes = ['cold', 'warm', 'rebuild']

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error(`Invalid BENCH_ITERATIONS value: ${iterations}`)
}

async function main() {
  console.log(
    `Running ${iterations} iteration(s) per library per mode. Set BENCH_ITERATIONS to override.\n`,
  )

  const allResults = []

  for (const scenario of scenarios) {
    const fixture = await createFixtureGraph(scenario)
    const scenarioResults = { name: scenario.name, modes: {} }

    for (const mode of modes) {
      const modeResults = []

      modeResults.push(
        await benchLibrary('rolldown-require', mode, fixture, opts =>
          bundleRequire(opts)),
      )

      modeResults.push(
        await benchLibrary('unrun', mode, fixture, async (opts) => {
          await cleanUnrunCache()
          return unrun(opts)
        }),
      )

      scenarioResults.modes[mode] = modeResults
      printScenarioStats(scenario, mode, modeResults)
    }

    allResults.push(scenarioResults)
    await rm(fixture.root, { recursive: true, force: true })
  }

  await writeReport(allResults)
}

async function createFixtureGraph(scenario) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), `rolldown-bench-${scenario.name}-`),
  )
  const dynamicTargets = []
  const moduleFiles = []

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

    const modPath = path.join(root, `mod${i}.ts`)
    moduleFiles.push(modPath)
    await writeFile(modPath, body, 'utf8')
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

  return { root, entry, moduleFiles }
}

function dynamicModuleSource(index) {
  return `
export async function loadDynamic() {
  const mod = await import('./mod${index - 1}.ts')
  return mod.value + ${index}
}
`
}

async function benchLibrary(library, mode, fixture, runner) {
  const durations = []
  const rss = []
  let dependencies = 0
  const cacheDir = path.join(fixture.root, '.cache', library, mode)

  for (let i = 0; i < iterations; i += 1) {
    if (mode === 'rebuild') {
      const target = fixture.moduleFiles.at(-1) || fixture.entry
      await writeFile(
        target,
        `export const value = ${i};`,
        'utf8',
      )
    }

    const opts = makeOptions(library, fixture, mode, cacheDir)
    const sample = await timeCall(() => runner(opts))
    durations.push(sample.durationMs)
    rss.push(sample.rssDelta)
    dependencies = sample.dependencies
  }

  return {
    library,
    mode,
    duration: summarize(durations),
    rss: summarize(rss),
    dependencies,
  }
}

function makeOptions(library, fixture, mode, cacheDir) {
  const base = {
    filepath: fixture.entry,
    cwd: fixture.root,
  }
  if (library === 'rolldown-require') {
    const cacheEnabled = mode !== 'cold'
    return {
      ...base,
      format: 'esm',
      cache: cacheEnabled
        ? { enabled: true, dir: cacheDir, reset: mode === 'rebuild' }
        : false,
    }
  }
  return {
    path: fixture.entry,
    preset: 'bundle-require',
    debug: false,
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

function printScenarioStats(scenario, mode, stats) {
  console.log(
    `Scenario: ${scenario.name} (${scenario.moduleCount} modules${
      scenario.dynamicEvery
        ? `, dynamic import every ${scenario.dynamicEvery}`
        : ''
    }) [${mode}]`,
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

async function writeReport(results) {
  await writeFile(reportJson, JSON.stringify({ iterations, results }, null, 2))

  const lines = []
  lines.push(`# Benchmark Report (iterations: ${iterations})`)
  for (const scenario of results) {
    lines.push(`\n## ${scenario.name}`)
    for (const mode of modes) {
      const stats = scenario.modes[mode]
      lines.push(`\n### ${mode}`)
      lines.push('| library | avg (ms) | median (ms) | min | max | rssΔ median (MB) | deps |')
      lines.push('| --- | --- | --- | --- | --- | --- | --- |')
      for (const stat of stats) {
        const { duration, rss, dependencies } = stat
        lines.push(
          `| ${stat.library} | ${duration.mean.toFixed(2)} | ${duration.median.toFixed(2)} | ${duration.min.toFixed(2)} | ${duration.max.toFixed(2)} | ${rss.median.toFixed(2)} | ${dependencies} |`,
        )
      }
    }
  }

  await writeFile(reportMd, lines.join('\n'), 'utf8')
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
