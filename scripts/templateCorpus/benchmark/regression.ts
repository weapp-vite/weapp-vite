import type { ProfileCheckpointWriter } from './checkpoint'
import type { RegressionPolicy } from './regressionOptions'
import type { RegressionFailure } from './regressionSelection'
import type { ProfileMeasurement, ProfileOptions } from './types'
import assert from 'node:assert/strict'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine'
import { profileCoreEntry } from '../../benchmarkWxmlParser/coreEntryProfile'
import { assertNodeStackBudget } from '../../benchmarkWxmlParser/runtime'
import { readCorpusArchive } from '../archive'
import { corpusHash } from '../integrity'
import { repositoryRoot } from '../paths'
import { isDirectExecution } from '../test/harness'
import { createProfileCheckpoint } from './checkpoint'
import { profileFixtures, profileGroups } from './fixtures'
import { readProfileInputs } from './inputs'
import { reserveProfileOutput } from './output'
import { assertProfileArtifacts, prepareProfile } from './prepare'
import { REGRESSION_PROGRESS_PREFIX } from './progress'
import { prepareRegressionConsumers } from './regressionConsumers'
import { captureRegressionCurrent } from './regressionCurrent'
import { verifyRegressionBaseline } from './regressionIdentity'
import { assertRegressionExpectations, oldRegressionInputs, regressionGroups } from './regressionInputs'
import { regressionIntegrity } from './regressionIntegrity'
import { parseRegressionOptions } from './regressionOptions'
import { regressionMarkdown } from './regressionReport'
import { regressionCheckpointHandler, selectRegressionWorkload } from './regressionSelection'
import { atomicReport, saveFinalReport } from './reportSave'
import { createWorkloadPlan } from './workload'

function gateComplete(result: ProfileMeasurement): boolean {
  return result.errors.length === 0 && result.summaries.length > 0 && result.summaries.every(summary => summary.status === 'complete' || summary.status === 'passed')
}

/**
 * 比较冻结 main 与当前 built 入口。该入口不构建任何产品包，采样失败时保留部分报告并返回非零。
 */
export async function regressionMain(args = process.argv.slice(2)): Promise<void> {
  const options = parseRegressionOptions(args)
  assertNodeStackBudget(process.execArgv)
  const policy = JSON.parse(await readFile(path.join(repositoryRoot, 'scripts/templateCorpus/benchmark/regression-policy.json'), 'utf8')) as RegressionPolicy
  const rounds = options.check ? policy.sampling.rounds : options.rounds
  const warmup = options.check ? policy.sampling.warmup : options.warmup
  const report: Record<string, unknown> = {
    schemaVersion: 1,
    purpose: 'built-main-regression',
    status: 'running',
    startedAt: new Date().toISOString(),
    sampleBudget: { rounds, warmup },
    formalCheck: options.check,
    diagnostic: options.quick ? 'quick' : options.check ? false : 'exploratory',
    formalBudget: rounds === policy.sampling.rounds && warmup === policy.sampling.warmup,
    baselineRef: policy.baselineRef,
    boundary: policy.boundary,
  }
  await reserveProfileOutput(options.output)
  const reportFile = path.join(options.output, 'report.json')
  const save = () => atomicReport(reportFile, report)
  const measurements: Record<string, ProfileMeasurement> = {}
  const checkpoints: ProfileCheckpointWriter[] = []
  let stopped: RegressionFailure | undefined
  let totalCells = 0
  let interrupted: string | undefined
  const interrupt = () => {
    interrupted ??= 'SIGINT'
  }
  const terminate = () => {
    interrupted ??= 'SIGTERM'
  }
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', terminate)
  const assertRunning = () => {
    if (interrupted) {
      throw new Error(`Regression interrupted by ${interrupted}; completed-cell evidence is preserved.`)
    }
  }
  const checkpointHandler = (runtime: string, checkpoint: ProfileCheckpointWriter) => regressionCheckpointHandler(runtime, checkpoint, {
    keepGoing: options.keepGoing,
    assertRunning,
    onFailure: async (failure) => {
      if (!report.firstFailure) {
        report.firstFailure = failure
        await save()
      }
    },
    onStop: (failure) => {
      stopped = failure
      console.info(`${REGRESSION_PROGRESS_PREFIX} stopped after durable ${runtime} ${checkpoint.reference.completedCells}/${checkpoint.reference.totalCells} ${failure.operation} ${failure.group} ${failure.status}`)
    },
  })
  try {
    await withMachineE2ELease(async () => {
      const baselineSource = await verifyRegressionBaseline(options.baselineSource, options.baselineIdentity, policy)
      const currentSource = await captureRegressionCurrent()
      for (const entry of [options.baseline, options.current]) {
        const metadata = await stat(entry)
        assert.ok(metadata.isFile(), `Built entry is not a file: ${entry}`)
      }
      const manifestPath = path.join(options.corpus, 'manifest.json')
      const manifestHash = corpusHash(await readFile(manifestPath))
      const { manifest, documents } = await readCorpusArchive(options.corpus)
      assert.equal(manifest.id, policy.corpusId, 'Regression corpus id differs from reviewed policy.')
      const inputs = await readProfileInputs(options.corpus, manifest, documents)
      const selected = profileFixtures(documents, manifest, inputs)
      report.inputExpectations = { excluded: selected.excluded, controlled: selected.matrixExpectations }
      await save()
      assertRegressionExpectations(selected.excluded)
      const platformFixtures = selected.fixtures.filter(fixture => fixture.quotaEligible || fixture.matrix?.length).map(fixture => ({ ...fixture, suite: 'all-platform' as const }))
      const old464 = await oldRegressionInputs()
      const fixtures = [...old464.fixtures, ...platformFixtures]
      assert.ok(fixtures.length, 'Frozen corpus has no valid regression fixtures.')
      const groups = [...old464.groups, ...regressionGroups(platformFixtures, profileGroups(platformFixtures, true))]
      const workload = selectRegressionWorkload(fixtures, groups, policy.operations, options)
      totalCells = workload.report.selected.cells
      report.selection = workload.report
      report.coreEntryProfile = { status: workload.coreProfile ? 'not-started' : 'skipped', reason: workload.coreProfile ? 'Core research starts only after the requested primary runtimes complete.' : 'Filtered diagnostic; --core-profile is required to opt in.' }
      const consumers = await prepareRegressionConsumers(options.output, { sourceRoot: options.baselineSource, builtEntry: options.baseline }, { sourceRoot: repositoryRoot, builtEntry: options.current })
      const prepared = await prepareProfile(options.current, options.output, options.runtime !== 'node', options.baseline, consumers)
      for (const file of [options.baselineIdentity, path.join(repositoryRoot, 'scripts/templateCorpus/benchmark/regression-policy.json')]) {
        prepared.artifacts[path.relative(repositoryRoot, file).replaceAll('\\', '/')] = corpusHash(await readFile(file))
      }
      const lockHash = corpusHash(await readFile(path.join(repositoryRoot, 'pnpm-lock.yaml')))
      assert.equal(policy.measurementProtocol, 'exact-workload-v2', 'Unsupported regression measurement protocol')
      const scopeIdentity = corpusHash(JSON.stringify({ run: report.startedAt, output: path.relative(repositoryRoot, options.output), baselineSource, currentSource, artifacts: prepared.artifacts, lockHash, policy, manifestHash }))
      report.identity = {
        corpusId: manifest.id,
        manifestSha256: manifestHash,
        contentSha256: manifest.contentSha256,
        documents: documents.length,
        validFixtures: fixtures.length,
        old464Corpus: old464.identity,
        frozenComparisonSource: baselineSource,
        currentSource,
        excluded: selected.excluded,
        baseline: { entry: path.relative(repositoryRoot, options.baseline).replaceAll('\\', '/'), sha256: corpusHash(await readFile(options.baseline)) },
        current: { entry: path.relative(repositoryRoot, options.current).replaceAll('\\', '/'), sha256: corpusHash(await readFile(options.current)) },
        lockSha256: lockHash,
        policy,
        artifacts: prepared.artifacts,
        versions: prepared.versions,
        measurementScopeSha256: scopeIdentity,
      }
      report.groups = groups
      report.selectedGroups = workload.groups.map(group => group.id)
      report.bundle = prepared.bundle
      report.moduleLoadMs = prepared.moduleLoadMs
      report.fixtureInventory = fixtures.map(({ source: _source, ...fixture }) => fixture)
      report.boundary = policy.boundary
      report.consumerBoundary = consumers.boundary
      report.consumerScope = 'Every old464 cohort exercises all three real production consumers. New all-platform groups exercise full parser APIs with their frozen per-profile options; this does not claim that Web or the WeChat simulator accepts every foreign template dialect.'
      await writeFile(path.join(options.output, 'baseline-source-identity.json'), await readFile(options.baselineIdentity))
      await save()
      const measurementOptions: ProfileOptions = {
        rounds,
        warmup,
        gate: policy.thresholds,
        operations: workload.operations,
        progress: true,
      }
      const runtimeOptions = (runtime: string): ProfileOptions => ({ ...measurementOptions, workload: { protocol: policy.measurementProtocol, runtime, identitySha256: scopeIdentity } })
      const workloadCounts = createWorkloadPlan(workload.fixtures, workload.groups, runtimeOptions(options.runtime === 'chromium' ? 'chromium' : 'node'))!
      report.measurementPlan = { protocol: policy.measurementProtocol, logicalCells: workloadCounts.logicalCells, physicalJobs: workloadCounts.physicalJobs, avoidedJobs: workloadCounts.logicalCells - workloadCounts.physicalJobs, savedFraction: 1 - workloadCounts.physicalJobs / workloadCounts.logicalCells, primaryArmSamples: workloadCounts.physicalJobs * rounds * 2, logicalPrimaryArmReferences: workloadCounts.logicalCells * rounds * 2, boundary: 'Each physical job executes once; logical classifications reference the same raw evidence and do not constitute independent repetitions.' }
      if (options.runtime !== 'chromium') {
        const nodeOptions = runtimeOptions('node')
        const checkpoint = await createProfileCheckpoint(options.output, 'node', workload.groups, nodeOptions, workload.fixtures)
        checkpoints.push(checkpoint)
        report.checkpoints = { node: checkpoint.reference }
        await save()
        report.memoryBefore = process.memoryUsage()
        const result = await prepared.runWithCheckpoint(workload.fixtures, workload.groups, nodeOptions, checkpointHandler('node', checkpoint))
        await checkpoint.complete(result)
        report.memoryAfter = process.memoryUsage()
        report.memoryBoundary = 'Whole Node runner snapshots include imports, fixtures, prebuilt trees and reports; they are not retained allocations or peak per-operation RSS.'
        measurements.node = result
        report.node = result
        report.nodeIntegrity = regressionIntegrity(result, workload.fixtures, workload.groups, nodeOptions)
        await save()
      }
      if (options.runtime !== 'node') {
        const browserOptions = runtimeOptions('chromium')
        const checkpoint = await createProfileCheckpoint(options.output, 'chromium', workload.groups, browserOptions, workload.fixtures)
        checkpoints.push(checkpoint)
        report.checkpoints = { ...(report.checkpoints as object | undefined), chromium: checkpoint.reference }
        await save()
        const { profileChromium } = await import('./browser')
        const browser = await profileChromium(prepared.browserCode!, workload.fixtures, workload.groups, browserOptions, checkpointHandler('chromium', checkpoint))
        await checkpoint.complete(browser.result)
        measurements.chromium = browser.result
        report.chromium = browser
        report.chromiumIntegrity = regressionIntegrity(browser.result, workload.fixtures, workload.groups, browserOptions)
        await save()
      }
      assertRunning()
      const core = workload.coreProfile
        ? await profileCoreEntry({ baselineEntry: options.baseline, rootEntry: options.current, coreEntry: options.core, output: path.join(options.output, 'core-entry-profile'), runtime: options.runtime, fixtures: workload.coreFixtures, rounds: 3, warmup: 1 }, async (partial) => {
            report.coreEntryProfile = partial
            await save()
            assertRunning()
          })
        : { status: 'skipped', reason: 'Filtered diagnostic: add --core-profile to explicitly profile only the selected fixture union.' }
      report.coreEntryProfile = core
      for (const checkpoint of checkpoints) {
        await checkpoint.assertUnchanged()
      }
      await assertProfileArtifacts(prepared.artifacts)
      assert.deepEqual(await captureRegressionCurrent(), currentSource, 'Current HEAD, production source inventory or configuration changed during sampling.')
      assert.equal(corpusHash(await readFile(manifestPath)), manifestHash, 'Frozen corpus manifest changed during regression sampling.')
      assert.equal(corpusHash(await readFile(options.baseline)), (report.identity as { baseline: { sha256: string } }).baseline.sha256, 'Baseline built entry changed during regression sampling.')
      assert.equal(corpusHash(await readFile(options.current)), (report.identity as { current: { sha256: string } }).current.sha256, 'Current built entry changed during regression sampling.')
      assert.equal(corpusHash(await readFile(path.join(repositoryRoot, 'pnpm-lock.yaml'))), lockHash, 'Lockfile changed during regression sampling.')
      await readCorpusArchive(options.corpus)
      assertRunning()
      const integrityErrors = [...((report.nodeIntegrity as string[] | undefined) ?? []), ...((report.chromiumIntegrity as string[] | undefined) ?? [])]
      const summaries = Object.values(measurements).flatMap(result => result.summaries)
      report.status = integrityErrors.length || (workload.coreProfile && core.status !== 'profile-complete') ? 'incomplete' : summaries.some(summary => summary.status === 'regression') ? 'regression' : summaries.some(summary => summary.status === 'unstable') ? 'unstable' : Object.values(measurements).every(gateComplete) ? options.check ? 'passed' : 'exploratory-complete' : 'incomplete'
      await writeFile(path.join(options.output, 'report.md'), regressionMarkdown({ corpus: manifest.id, documents: documents.length, cases: workload.fixtures.length, baseline: policy.baselineRef, current: path.relative(repositoryRoot, options.current).replaceAll('\\', '/') }, measurements))
      if (!['passed', 'exploratory-complete'].includes(String(report.status))) {
        process.exitCode = 1
      }
    })
  }
  catch (error) {
    report.status = interrupted ? 'interrupted' : stopped?.status ?? 'failed'
    report.error = String(error instanceof Error ? error.stack : error).replaceAll(repositoryRoot, '<repository>')
    process.exitCode = interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : 1
  }
  finally {
    try {
      for (const checkpoint of checkpoints) {
        try {
          await checkpoint.close(interrupted ? 'interrupted' : 'failed', interrupted ?? String(report.error ?? 'Collection did not complete'))
        }
        catch (error) {
          const errors = (report.checkpointCloseErrors ??= []) as string[]
          errors.push(String(error).replaceAll(repositoryRoot, '<repository>'))
          report.status = 'failed'
          process.exitCode = 1
        }
      }
      const runtimes = options.runtime === 'both' ? ['node', 'chromium'] : [options.runtime]
      report.execution = { failFast: !options.keepGoing, stopped: Boolean(stopped), runtimes: runtimes.map((runtime) => {
        const reference = checkpoints.find(checkpoint => checkpoint.reference.runtime === runtime)?.reference
        return { runtime, status: reference?.status ?? 'not-started', completedCells: reference?.completedCells ?? 0, totalCells, unexecutedCells: totalCells - (reference?.completedCells ?? 0), completedJobs: reference?.completedJobs, totalJobs: reference?.totalJobs }
      }) }
      report.finishedAt = new Date().toISOString()
      const writeFinalSnapshot = async () => {
        if (interrupted) {
          report.status = 'interrupted'
          report.interruptedBy = interrupted
          process.exitCode = interrupted === 'SIGINT' ? 130 : 143
        }
        return saveFinalReport(reportFile, report, error => String(error).replaceAll(repositoryRoot, '<repository>'))
      }
      let saved = await writeFinalSnapshot()
      if (saved.saved && interrupted && report.interruptedBy !== interrupted) {
        saved = await writeFinalSnapshot()
      }
      if (!saved.saved) {
        report.status = 'failed'
        process.exitCode = 1
        process.stderr.write(`Final regression report save failed: ${saved.error}; evidence ${path.relative(repositoryRoot, saved.evidence)}${saved.evidenceError ? ` also failed: ${saved.evidenceError}` : ''}\n`)
      }
      process.stdout.write(`Template corpus regression benchmark: ${String(report.status)}; ${path.relative(repositoryRoot, options.output)}/report.json\n`)
    }
    finally {
      process.off('SIGINT', interrupt)
      process.off('SIGTERM', terminate)
    }
  }
}

if (isDirectExecution(import.meta.url)) {
  await regressionMain()
}
