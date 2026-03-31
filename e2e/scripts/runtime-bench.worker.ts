import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

process.env.WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK = '1'
process.env.WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP = '1'

const runtimeProvider = resolveRuntimeProviderName()

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const SAMPLE_COUNT = 3

interface BenchScenarioSummary {
  wallMsMedian: number
  readyMsMedian: number
  firstCommitMsMedian: number
  samples: Array<{
    wallMs: number
    readyMs: number
    firstCommitMs: number
  }>
}

interface BenchUpdateSummary {
  wallMsMedian: number
  metricMsMedian: number
  computeMsMedian: number
  commitMsMedian: number
  setDataCallsMedian: number
  samples: Array<{
    wallMs: number
    metricMs: number
    computeMs: number
    commitMs: number
    setDataCalls: number
  }>
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
  }
  return sorted[middle] ?? 0
}

function logStep(projectRoot: string, step: string) {
  process.stdout.write(`[runtime-bench:${path.basename(projectRoot)}] ${step}\n`)
}

async function runBuild(projectRoot: string) {
  const distRoot = path.join(projectRoot, 'dist')
  await fs.rm(distRoot, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    skipNpm: true,
    label: `runtime-bench:${path.basename(projectRoot)}`,
  })
}

async function measureFirstScreen(miniProgram: any, projectRoot: string): Promise<BenchScenarioSummary> {
  const samples: BenchScenarioSummary['samples'] = []

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    logStep(projectRoot, `first screen sample ${index + 1}/${SAMPLE_COUNT}`)
    const startedAt = Date.now()
    const page = await miniProgram.reLaunch('/pages/index/index')
    await page.waitFor('#bench-ready-marker')
    await page.waitFor(120)
    const state = await page.callMethod('readBenchState')
    samples.push({
      wallMs: Date.now() - startedAt,
      readyMs: Number(state?.metrics?.loadToReadyMs ?? 0),
      firstCommitMs: Number(state?.metrics?.firstCommitMs ?? 0),
    })
  }

  return {
    wallMsMedian: median(samples.map(sample => sample.wallMs)),
    readyMsMedian: median(samples.map(sample => sample.readyMs)),
    firstCommitMsMedian: median(samples.map(sample => sample.firstCommitMs)),
    samples,
  }
}

async function measureDetailNavigation(miniProgram: any, projectRoot: string): Promise<BenchScenarioSummary> {
  const samples: BenchScenarioSummary['samples'] = []

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    logStep(projectRoot, `detail navigation sample ${index + 1}/${SAMPLE_COUNT}`)
    const indexPage = await miniProgram.reLaunch('/pages/index/index')
    await indexPage.waitFor('#bench-ready-marker')
    const startedAt = Date.now()
    await indexPage.callMethod('navigateToDetail')
    const page = await miniProgram.currentPage()
    await page.waitFor('#bench-ready-marker')
    await page.waitFor(120)
    const state = await page.callMethod('readBenchState')
    samples.push({
      wallMs: Date.now() - startedAt,
      readyMs: Number(state?.metrics?.loadToReadyMs ?? 0),
      firstCommitMs: Number(state?.metrics?.firstCommitMs ?? 0),
    })
  }

  return {
    wallMsMedian: median(samples.map(sample => sample.wallMs)),
    readyMsMedian: median(samples.map(sample => sample.readyMs)),
    firstCommitMsMedian: median(samples.map(sample => sample.firstCommitMs)),
    samples,
  }
}

async function measureUpdate(miniProgram: any, projectRoot: string, method: 'runSingleCommitBench' | 'runMicroCommitBench', metricKey: 'singleCommitMs' | 'microCommitMs', callKey: 'singleCommitSetDataCalls' | 'microCommitSetDataCalls', rounds: number): Promise<BenchUpdateSummary> {
  const samples: BenchUpdateSummary['samples'] = []

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    logStep(projectRoot, `${method} sample ${index + 1}/${SAMPLE_COUNT}`)
    const page = await miniProgram.reLaunch('/pages/update/index')
    await page.waitFor('#bench-ready-marker')
    await page.waitFor(100)
    const startedAt = Date.now()
    const state = await page.callMethod(method, rounds)
    samples.push({
      wallMs: Date.now() - startedAt,
      metricMs: Number(state?.metrics?.[metricKey] ?? 0),
      computeMs: Number(state?.metrics?.[metricKey === 'singleCommitMs' ? 'singleCommitComputeMs' : 'microCommitComputeMs'] ?? 0),
      commitMs: Number(state?.metrics?.[metricKey === 'singleCommitMs' ? 'singleCommitCommitMs' : 'microCommitCommitMs'] ?? 0),
      setDataCalls: Number(state?.metrics?.[callKey] ?? 0),
    })
  }

  return {
    wallMsMedian: median(samples.map(sample => sample.wallMs)),
    metricMsMedian: median(samples.map(sample => sample.metricMs)),
    computeMsMedian: median(samples.map(sample => sample.computeMs)),
    commitMsMedian: median(samples.map(sample => sample.commitMs)),
    setDataCallsMedian: median(samples.map(sample => sample.setDataCalls)),
    samples,
  }
}

async function main() {
  const projectRoot = process.argv[2]
  if (!projectRoot) {
    throw new Error('Missing project root argument')
  }

  logStep(projectRoot, `build start provider=${runtimeProvider}`)
  await runBuild(projectRoot)
  logStep(projectRoot, 'launch automator')
  const miniProgram = await launchAutomator({
    projectPath: projectRoot,
    runtimeProvider,
    trustProject: true,
  })

  try {
    logStep(projectRoot, 'measure first screen')
    const result = {
      project: path.basename(projectRoot),
      firstScreen: await measureFirstScreen(miniProgram, projectRoot),
      detailNavigation: (logStep(projectRoot, 'measure detail navigation'), await measureDetailNavigation(miniProgram, projectRoot)),
      updateSingleCommit: (logStep(projectRoot, 'measure single commit update'), await measureUpdate(miniProgram, projectRoot, 'runSingleCommitBench', 'singleCommitMs', 'singleCommitSetDataCalls', 180)),
      updateMicroCommit: (logStep(projectRoot, 'measure micro commit update'), await measureUpdate(miniProgram, projectRoot, 'runMicroCommitBench', 'microCommitMs', 'microCommitSetDataCalls', 40)),
    }

    process.stdout.write(`RUNTIME_BENCH_RESULT ${JSON.stringify(result)}\n`)
  }
  finally {
    await miniProgram.close()
  }
}

void main()
