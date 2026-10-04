import type { RecoverableSession } from './runtimeBench'
import type { BenchScenarioSummary, WorkerResult } from './runtimeBench/types'
import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { assertDevtoolsLoggedIn } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { collectFiles, verifyRuntimeBenchConsumer } from './runtimeBench/consumer'
import { createBenchEvidence, finishBenchEvidence } from './runtimeBench/evidence'
import { median, observedNumber } from './runtimeBench/metrics'
import { measureUpdate as measureUpdateSample } from './runtimeBench/update'
import { createRuntimeBenchSession } from './runtimeBenchSession'

const runtimeProvider = resolveRuntimeProviderName()

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const SAMPLE_COUNT = 3

function logStep(projectRoot: string, step: string) {
  process.stdout.write(`[runtime-bench:${path.basename(projectRoot)}] ${step}\n`)
}

async function runBuild(projectRoot: string) {
  const distRoot = path.join(projectRoot, 'dist')
  await fs.rm(distRoot, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: process.env.WEVU_BENCH_CONSUMER === '1' ? await verifyRuntimeBenchConsumer(projectRoot) : CLI_PATH,
    cwd: projectRoot,
    projectRoot,
    platform: 'weapp',
    skipNpm: true,
    label: `runtime-bench:${path.basename(projectRoot)}`,
  })
}

type MiniProgramSession = RecoverableSession<any>

type EvidenceJournal = ReturnType<typeof createBenchEvidence>

async function createBenchSession(projectRoot: string, journal: EvidenceJournal): Promise<MiniProgramSession> {
  return await createRuntimeBenchSession({
    log: message => logStep(projectRoot, message),
    projectRoot,
    runtimeProvider,
    onCleanupError: journal.onCleanupError,
  })
}

async function measureFirstScreen(session: MiniProgramSession, projectRoot: string, journal: EvidenceJournal): Promise<BenchScenarioSummary> {
  const samples: NonNullable<BenchScenarioSummary['samples']> = []

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const label = `first screen sample ${index + 1}/${SAMPLE_COUNT}`
    logStep(projectRoot, label)
    const sample = await session.run(label, async (miniProgram) => {
      const startedAt = Date.now()
      const page = await miniProgram.reLaunch('/pages/index/index')
      await page.waitFor('#bench-ready-marker')
      await page.waitFor(120)
      const state = await page.callMethod('readBenchState')
      return {
        wallMs: Date.now() - startedAt,
        readyMs: observedNumber(state?.metrics?.loadToReadyMs),
        firstCommitMs: null,
      }
    })
    samples.push(sample)
    await journal.onSample('firstScreen')(sample, index)
  }

  return {
    wallMsMedian: median(samples.map(sample => sample.wallMs)),
    readyMsMedian: median(samples.map(sample => sample.readyMs)),
    firstCommitMsMedian: median(samples.map(sample => sample.firstCommitMs)),
    samples,
  }
}

async function measureDetailNavigation(session: MiniProgramSession, projectRoot: string, journal: EvidenceJournal): Promise<BenchScenarioSummary> {
  const samples: NonNullable<BenchScenarioSummary['samples']> = []

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const label = `detail navigation sample ${index + 1}/${SAMPLE_COUNT}`
    logStep(projectRoot, label)
    const sample = await session.run(label, async (miniProgram) => {
      const indexPage = await miniProgram.reLaunch('/pages/index/index')
      await indexPage.waitFor('#bench-ready-marker')
      const startedAt = Date.now()
      await indexPage.callMethod('navigateToDetail')
      const page = await miniProgram.currentPage()
      await page.waitFor('#bench-ready-marker')
      await page.waitFor(120)
      const state = await page.callMethod('readBenchState')
      return {
        wallMs: Date.now() - startedAt,
        readyMs: observedNumber(state?.metrics?.loadToReadyMs),
        firstCommitMs: null,
      }
    })
    samples.push(sample)
    await journal.onSample('detailNavigation')(sample, index)
  }

  return {
    wallMsMedian: median(samples.map(sample => sample.wallMs)),
    readyMsMedian: median(samples.map(sample => sample.readyMs)),
    firstCommitMsMedian: median(samples.map(sample => sample.firstCommitMs)),
    samples,
  }
}

async function measureUpdate(session: MiniProgramSession, projectRoot: string, route: string, method: 'runSingleCommitBench' | 'runMicroCommitBench', _metricKey: string, _callKey: string, rounds: number, journal: EvidenceJournal, scenario: string) {
  return measureUpdateSample({
    session,
    route,
    method,
    rounds,
    sampleCount: SAMPLE_COUNT,
    provider: runtimeProvider,
    requirePhases: (process.env.WEVU_BENCH_PROJECT ?? path.basename(projectRoot)) === 'runtime-bench-vue',
    log: message => logStep(projectRoot, message),
    onSample: journal.onSample(scenario),
  })
}

async function main() {
  const projectRoot = process.argv[2]
  if (!projectRoot) {
    throw new Error('Missing project root argument')
  }

  const journal = createBenchEvidence(process.env.WEVU_BENCH_EVIDENCE_PATH ?? path.join(projectRoot, '.tmp/runtime-bench-worker-evidence.json'))
  let activeSession: MiniProgramSession | undefined
  const result = await finishBenchEvidence(journal, async () => {
    logStep(projectRoot, `build start provider=${runtimeProvider}`)
    await runBuild(projectRoot)
    const files = await collectFiles(path.join(projectRoot, 'dist'))
    journal.evidence.metadata = { artifact: { files, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0) } }
    await journal.save()
    if (runtimeProvider === 'devtools') {
      await assertDevtoolsLoggedIn(projectRoot)
    }
    logStep(projectRoot, 'launch automator')
    const launchStartedAt = Date.now()
    const session = activeSession = await createBenchSession(projectRoot, journal)
    const launchMs = Date.now() - launchStartedAt
    const project = process.env.WEVU_BENCH_PROJECT ?? path.basename(projectRoot)
    const systemInfo = await session.run('runtime metadata', async miniProgram => miniProgram.systemInfo())
    journal.evidence.metadata.runtime = { provider: runtimeProvider, systemInfo, launchMs }
    await journal.save()
    logStep(projectRoot, 'measure first screen')
    const result: WorkerResult = {
      schemaVersion: 2,
      project,
      preset: process.env.WEVU_BENCH_PRESET ?? 'normal',
      ...journal.evidence.metadata,
      firstScreen: await measureFirstScreen(session, projectRoot, journal),
      detailNavigation: (logStep(projectRoot, 'measure detail navigation'), await measureDetailNavigation(session, projectRoot, journal)),
      updateSingleCommit: {
        diff: (logStep(projectRoot, 'measure single commit update diff'), await measureUpdate(session, projectRoot, '/pages/update/index', 'runSingleCommitBench', 'singleCommitMs', 'singleCommitSetDataCalls', 180, journal, 'updateSingleCommit.diff')),
      },
      updateMicroCommit: {
        diff: (logStep(projectRoot, 'measure micro commit update diff'), await measureUpdate(session, projectRoot, '/pages/update/index', 'runMicroCommitBench', 'microCommitMs', 'microCommitSetDataCalls', 40, journal, 'updateMicroCommit.diff')),
      },
    }

    if (project === 'runtime-bench-vue') {
      result.workloads = {}
      for (const workload of ['small-field', 'batch', 'append', 'reorder']) {
        result.workloads[workload] = await measureUpdateSample({
          session,
          route: '/pages/update/index',
          method: 'runSingleCommitBench',
          rounds: 1,
          sampleCount: SAMPLE_COUNT,
          requirePhases: true,
          provider: runtimeProvider,
          workload,
          log: message => logStep(projectRoot, message),
          onSample: journal.onSample(`workloads.${workload}`),
        })
      }
      result.updateSingleCommit.patch = (logStep(projectRoot, 'measure single commit update patch'), await measureUpdate(session, projectRoot, '/pages/update-patch/index', 'runSingleCommitBench', 'singleCommitMs', 'singleCommitSetDataCalls', 180, journal, 'updateSingleCommit.patch'))
      result.updateMicroCommit.patch = (logStep(projectRoot, 'measure micro commit update patch'), await measureUpdate(session, projectRoot, '/pages/update-patch/index', 'runMicroCommitBench', 'microCommitMs', 'microCommitSetDataCalls', 40, journal, 'updateMicroCommit.patch'))
    }

    if (project === 'runtime-bench-react') {
      result.staticBinding = {
        updateSingleCommit: (logStep(projectRoot, 'measure single commit static binding'), await measureUpdate(session, projectRoot, '/pages/static-update/index', 'runSingleCommitBench', 'singleCommitMs', 'singleCommitSetDataCalls', 180, journal, 'staticBinding.updateSingleCommit')),
        updateMicroCommit: (logStep(projectRoot, 'measure micro commit static binding'), await measureUpdate(session, projectRoot, '/pages/static-update/index', 'runMicroCommitBench', 'microCommitMs', 'microCommitSetDataCalls', 40, journal, 'staticBinding.updateMicroCommit')),
      }
    }

    return result
  }, async () => activeSession?.close())
  process.stdout.write(`RUNTIME_BENCH_RESULT ${JSON.stringify(result)}\n`)
}

void withMachineE2ELease(main)
