import type { RecoverableSession } from './runtimeBench'
import type { BenchScenarioSummary, WorkerResult } from './runtimeBench/types'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { assertDevtoolsLoggedIn } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { collectFiles, verifyRuntimeBenchConsumer } from './runtimeBench/consumer'
import { createBenchEvidence, finishBenchEvidence } from './runtimeBench/evidence'
import { median } from './runtimeBench/metrics'
import { prepareNativeInspectorBench } from './runtimeBench/nativeInspectorHeap/installation'
import { readReadyBenchPage } from './runtimeBench/navigation'
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
    onRetry: journal.onRetry,
    onResource: journal.onResource,
  })
}

async function measureFirstScreen(session: MiniProgramSession, projectRoot: string, journal: EvidenceJournal): Promise<BenchScenarioSummary> {
  const samples: NonNullable<BenchScenarioSummary['samples']> = []

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const label = `first screen sample ${index + 1}/${SAMPLE_COUNT}`
    logStep(projectRoot, label)
    const sample = await session.run(label, async (miniProgram) => {
      const startedAt = Date.now()
      await miniProgram.reLaunch('/pages/index/index')
      const { readyMs } = await readReadyBenchPage(miniProgram, '/pages/index/index', process.env.WEVU_BENCH_PROJECT ?? path.basename(projectRoot))
      return {
        wallMs: Date.now() - startedAt,
        readyMs,
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
      const project = process.env.WEVU_BENCH_PROJECT ?? path.basename(projectRoot)
      await miniProgram.reLaunch('/pages/index/index')
      const { page: indexPage } = await readReadyBenchPage(miniProgram, '/pages/index/index', project, { settleMs: 0 })
      const startedAt = Date.now()
      await indexPage.callMethod('navigateToDetail')
      const { readyMs } = await readReadyBenchPage(miniProgram, '/pages/detail/index', project)
      return {
        wallMs: Date.now() - startedAt,
        readyMs,
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

async function measureUpdate(session: MiniProgramSession, projectRoot: string, route: string, method: 'runSingleCommitBench' | 'runMicroCommitBench', _metricKey: string, _callKey: string, rounds: number, journal: EvidenceJournal, scenario: string, nativeInstallation?: Awaited<ReturnType<typeof prepareNativeInspectorBench>>) {
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
    nativeHeap: nativeInstallation && { collector: nativeInstallation.collector, preset: process.env.WEVU_BENCH_PRESET ?? 'normal', scenario },
  })
}

async function main() {
  const projectRoot = process.argv[2]
  if (!projectRoot) {
    throw new Error('Missing project root argument')
  }

  const journal = createBenchEvidence(process.env.WEVU_BENCH_EVIDENCE_PATH ?? path.join(projectRoot, '.tmp/runtime-bench-worker-evidence.json'))
  let activeSession: MiniProgramSession | undefined
  let nativeInstallation: Awaited<ReturnType<typeof prepareNativeInspectorBench>> | undefined
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
    const nativeDirectory = process.env.WEAPP_VITE_BENCH_NATIVE_INSPECTOR_DIRECTORY
    if (nativeDirectory) {
      assert.equal(runtimeProvider, 'devtools', 'Native Inspector sampling requires the real DevTools provider')
      assert.equal(project, 'runtime-bench-vue', 'Native Inspector sampling is reserved for the original Vue preset workloads')
      const owned = journal.evidence.resources.filter(resource => resource.status === 'owned')
      assert.equal(owned.length, 1, 'Native Inspector sampling requires exactly one owned project')
      const resource = owned[0]!
      assert(resource.managedProject?.id && resource.wsEndpoint && resource.port, 'Native Inspector sampling requires confirmed session ownership')
      const info = await session.run<Partial<Record<'version' | 'SDKVersion', unknown>> | null | undefined>('native Inspector metadata', miniProgram => miniProgram.toolInfo())
      assert(typeof info?.version === 'string' && typeof info?.SDKVersion === 'string', 'Native Inspector sampling requires actual IDE and SDK versions')
      const acceptedVersion = process.env.WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION
      const acceptedSdk = process.env.WEAPP_VITE_BENCH_NATIVE_INSPECTOR_SDK_VERSION
      assert(acceptedVersion && acceptedSdk, 'Native Inspector sampling requires explicit approved IDE and SDK versions')
      assert.equal(info.version, acceptedVersion, 'Native Inspector IDE differs from the approved performance target')
      assert.equal(info.SDKVersion, acceptedSdk, 'Native Inspector SDK differs from the approved performance target')
      const preset = process.env.WEVU_BENCH_PRESET ?? 'normal'
      await fs.mkdir(nativeDirectory, { recursive: true })
      nativeInstallation = await prepareNativeInspectorBench({
        directory: path.join(nativeDirectory, `${preset}-${resource.managedProject.id}`),
        identity: { sessionId: resource.managedProject.id, toolVersion: info.version, sdkVersion: info.SDKVersion },
        preset,
        resource: { projectPath: resource.projectPath, wsEndpoint: resource.wsEndpoint, port: resource.port },
        log: message => logStep(projectRoot, message),
      })
    }
    logStep(projectRoot, 'measure first screen')
    const result: WorkerResult = {
      schemaVersion: 2,
      project,
      preset: process.env.WEVU_BENCH_PRESET ?? 'normal',
      ...journal.evidence.metadata,
      firstScreen: await measureFirstScreen(session, projectRoot, journal),
      detailNavigation: (logStep(projectRoot, 'measure detail navigation'), await measureDetailNavigation(session, projectRoot, journal)),
      updateSingleCommit: {
        diff: (logStep(projectRoot, 'measure single commit update diff'), await measureUpdate(session, projectRoot, '/pages/update/index', 'runSingleCommitBench', 'singleCommitMs', 'singleCommitSetDataCalls', 180, journal, 'updateSingleCommit.diff', nativeInstallation)),
      },
      updateMicroCommit: {
        diff: (logStep(projectRoot, 'measure micro commit update diff'), await measureUpdate(session, projectRoot, '/pages/update/index', 'runMicroCommitBench', 'microCommitMs', 'microCommitSetDataCalls', 40, journal, 'updateMicroCommit.diff', nativeInstallation)),
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
          nativeHeap: nativeInstallation && { collector: nativeInstallation.collector, preset: process.env.WEVU_BENCH_PRESET ?? 'normal', scenario: `workloads.${workload}` },
        })
      }
      result.updateSingleCommit.patch = (logStep(projectRoot, 'measure single commit update patch'), await measureUpdate(session, projectRoot, '/pages/update-patch/index', 'runSingleCommitBench', 'singleCommitMs', 'singleCommitSetDataCalls', 180, journal, 'updateSingleCommit.patch', nativeInstallation))
      result.updateMicroCommit.patch = (logStep(projectRoot, 'measure micro commit update patch'), await measureUpdate(session, projectRoot, '/pages/update-patch/index', 'runMicroCommitBench', 'microCommitMs', 'microCommitSetDataCalls', 40, journal, 'updateMicroCommit.patch', nativeInstallation))
    }

    if (project === 'runtime-bench-react') {
      result.staticBinding = {
        updateSingleCommit: (logStep(projectRoot, 'measure single commit static binding'), await measureUpdate(session, projectRoot, '/pages/static-update/index', 'runSingleCommitBench', 'singleCommitMs', 'singleCommitSetDataCalls', 180, journal, 'staticBinding.updateSingleCommit')),
        updateMicroCommit: (logStep(projectRoot, 'measure micro commit static binding'), await measureUpdate(session, projectRoot, '/pages/static-update/index', 'runMicroCommitBench', 'microCommitMs', 'microCommitSetDataCalls', 40, journal, 'staticBinding.updateMicroCommit')),
      }
    }

    return result
  }, async () => {
    const errors: unknown[] = []
    try {
      await nativeInstallation?.close()
    }
    catch (error) {
      errors.push(error)
    }
    try {
      await activeSession?.close()
    }
    catch (error) {
      errors.push(error)
    }
    if (errors.length) {
      throw new AggregateError(errors, 'Benchmark native collector and session cleanup failed')
    }
  })
  process.stdout.write(`RUNTIME_BENCH_RESULT ${JSON.stringify(result)}\n`)
}

void withMachineE2ELease(main)
