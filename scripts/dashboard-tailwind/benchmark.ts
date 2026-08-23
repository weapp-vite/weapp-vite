import type { AnalyzedBuild, WorkerResult } from './report'
import type { DashboardTailwindScenario } from './scenarios'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { x } from 'tinyexec'
import {
  analyzeCss,
  assertEqualSets,
  createScenarioReport,
  printReports,
  validateGeneratedCss,
} from './report'
import {
  dashboardTailwindConfigScenarios,
  dashboardTailwindPerformanceScenarios,
} from './scenarios'

type BenchmarkSuite = 'all' | 'config' | 'performance'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const workerFile = path.resolve(import.meta.dirname, 'worker.ts')
const iconComponentFile = path.resolve(
  repoRoot,
  'packages/dashboard/src/features/dashboard/components/DashboardIcon.vue',
)

function readArg(name: string) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function parsePositiveInteger(name: string, fallback: number) {
  const value = readArg(name)
  if (value === undefined) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  return parsed
}

function parseSuite(): BenchmarkSuite {
  const suite = readArg('--suite') ?? 'all'
  if (suite === 'all' || suite === 'config' || suite === 'performance') {
    return suite
  }
  throw new Error(`Unknown benchmark suite: ${suite}`)
}

async function runWorker(
  scenario: DashboardTailwindScenario,
  temporaryRoot: string,
  sequence: number,
) {
  const runRoot = path.resolve(temporaryRoot, `${scenario}-${sequence}`)
  const outDir = path.resolve(runRoot, 'dist')
  const resultFile = path.resolve(runRoot, 'result.json')

  await x(process.execPath, [
    '--import',
    'tsx',
    workerFile,
    '--scenario',
    scenario,
    '--out-dir',
    outDir,
    '--result-file',
    resultFile,
  ], {
    nodeOptions: {
      cwd: repoRoot,
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    },
    throwOnError: true,
  })

  const workerResult = JSON.parse(await readFile(resultFile, 'utf8')) as WorkerResult
  const css = await readFile(workerResult.cssFile, 'utf8')
  const analyzed = analyzeCss(css, scenario)
  analyzed.sample.buildMs = workerResult.buildMs
  analyzed.sample.createMs = workerResult.createMs
  analyzed.sample.importMs = workerResult.importMs
  return analyzed
}

async function readExpectedIcons() {
  const source = await readFile(iconComponentFile, 'utf8')
  return new Set(
    [...source.matchAll(/icon-\[mdi--([a-z0-9-]+)\]/g)]
      .map(match => `icon-[mdi--${match[1]}]`),
  )
}

async function runScenarioSet(
  scenarios: DashboardTailwindScenario[],
  options: {
    expectedIcons: Set<string>
    runs: number
    temporaryRoot: string
    warmup: number
  },
) {
  const buildsByScenario = new Map<DashboardTailwindScenario, AnalyzedBuild[]>()

  for (const scenario of scenarios) {
    for (let index = 0; index < options.warmup; index++) {
      await runWorker(scenario, options.temporaryRoot, -(index + 1))
    }

    const builds: AnalyzedBuild[] = []
    for (let index = 0; index < options.runs; index++) {
      const build = await runWorker(scenario, options.temporaryRoot, index)
      builds.push(build)
      if (scenario === 'official' || scenario === 'weapp-app-type-target-web' || scenario === 'weapp-full' || scenario === 'weapp-full-no-source-candidates') {
        validateGeneratedCss(build, options.expectedIcons)
      }
      if (builds.length > 1) {
        assertEqualSets(build.selectors, builds[0].selectors, `${scenario} repeated selector output`)
      }
    }
    buildsByScenario.set(scenario, builds)
  }

  const official = buildsByScenario.get('official')?.[0]
  if (!official) {
    throw new Error('Official Tailwind baseline was not executed')
  }

  for (const scenario of ['weapp-app-type-target-web', 'weapp-full', 'weapp-full-no-source-candidates'] as const) {
    const build = buildsByScenario.get(scenario)?.[0]
    if (build) {
      assertEqualSets(build.selectors, official.selectors, `${scenario} selector parity`)
      assertEqualSets(build.classes, official.classes, `${scenario} class parity`)
    }
  }

  return Object.fromEntries(
    [...buildsByScenario].map(([scenario, builds]) => [scenario, createScenarioReport(builds, official)]),
  )
}

async function main() {
  const suite = parseSuite()
  const output = readArg('--output')
  const performanceRuns = parsePositiveInteger('--runs', 5)
  const warmup = parsePositiveInteger('--warmup', 1)
  if (performanceRuns === 0) {
    throw new Error('--runs must be at least 1')
  }

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'weapp-vite-dashboard-tailwind-'))
  const expectedIcons = await readExpectedIcons()
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    suite,
  }

  try {
    if (suite === 'all' || suite === 'config') {
      const config = await runScenarioSet(dashboardTailwindConfigScenarios, {
        expectedIcons,
        runs: 1,
        temporaryRoot,
        warmup: 0,
      })
      report.config = config
      process.stdout.write('\nConfiguration matrix\n')
      printReports(config)
    }

    if (suite === 'all' || suite === 'performance') {
      const performance = await runScenarioSet(dashboardTailwindPerformanceScenarios, {
        expectedIcons,
        runs: performanceRuns,
        temporaryRoot,
        warmup,
      })
      report.performance = performance
      process.stdout.write('\nPerformance samples\n')
      printReports(performance)
    }

    if (output) {
      const outputFile = path.isAbsolute(output) ? output : path.resolve(repoRoot, output)
      await mkdir(path.dirname(outputFile), { recursive: true })
      await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
      process.stdout.write(`Report written to ${path.relative(repoRoot, outputFile)}\n`)
    }
  }
  finally {
    await rm(temporaryRoot, { force: true, recursive: true })
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
