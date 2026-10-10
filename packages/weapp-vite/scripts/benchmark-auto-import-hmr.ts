/* eslint-disable ts/no-use-before-define */
import type { DevHeapUsage } from '../../../e2e/utils/dev-memory'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE } from '@weapp-core/constants'
import path from 'pathe'
import { sampleHeapAfterGc, waitForInspectorUrl } from '../../../e2e/utils/dev-memory'
import { startDevProcess } from '../../../e2e/utils/dev-process'
import { runWithCleanup } from '../../../e2e/utils/runWithCleanup'
import { createBenchmarkDevEnv } from '../../../scripts/benchmarkTemplatesHmr/environment'
import { serializeSequenceError } from '../../../scripts/editSequence/errorEvidence'
import { parseStatefulHmrControlSource } from '../../../scripts/workspace-hmr/scenarios'
import { measureStatefulTemplateArtifact } from '../../../scripts/workspace-hmr/statefulArtifactMeasurement'
import { StatefulHmrAuditClient } from '../../../scripts/workspace-hmr/statefulAuditClient'
import vantComponents from '../src/auto-import-components/resolvers/json/vant.json'
import { writeBenchmarkResolverFile } from './utils/benchmark-tsconfig'
import { linkBenchmarkDependencies } from './utils/benchmarkDependencies'
import { benchmarkModeSelected, benchmarkReportResults } from './utils/benchmarkSelection'
import { createBenchmarkPath, resolveBenchmarkTarget } from './utils/benchmarkTarget'
import { patchProjectConfigFile } from './utils/config-file'
import {
  AUTO_IMPORT_HMR_DIAGNOSTIC_OWNER_ENV,
  AUTO_IMPORT_HMR_DIAGNOSTIC_PHASE_ENV,
  AUTO_IMPORT_HMR_DIAGNOSTIC_ROOT_ENV,
  isAutoImportHmrDiagnosticEnabled,
  isAutoImportHmrDiagnosticPairEnabled,
  isAutoImportHmrDiagnosticProfileEnabled,
} from './utils/hmrDiagnostic'
import { readDiagnosticProfile, snapshotOutputCheckpoint, snapshotPublishedOutputs } from './utils/hmrDiagnosticEvidence'
import { HMR_OUTPUT_POLL_INTERVAL_MS, measureFileMarkerUpdate } from './utils/hmrOutput'
import { formatMemoryMiB, summarizeOptionalMemory } from './utils/process-memory'

const iterations = Number.parseInt(process.env.BENCH_ITERATIONS ?? '3', 10)
const scenarioValues = parseScenarioValues(process.env.BENCH_SCENARIOS)
const disableCurrentSupportOutputs = process.env.BENCH_DISABLE_CURRENT_SUPPORT_OUTPUTS === '1'
const diagnosticEnabled = isAutoImportHmrDiagnosticEnabled()
const diagnosticProfileEnabled = isAutoImportHmrDiagnosticProfileEnabled()
const diagnosticPairEnabled = isAutoImportHmrDiagnosticPairEnabled()
const diagnosticPairPhase = process.env[AUTO_IMPORT_HMR_DIAGNOSTIC_PHASE_ENV]
const diagnosticPairRoot = process.env[AUTO_IMPORT_HMR_DIAGNOSTIC_ROOT_ENV]
const diagnosticPairOwner = process.env[AUTO_IMPORT_HMR_DIAGNOSTIC_OWNER_ENV]
const fixtureSource = path.resolve(import.meta.dirname, '../../../test/fixture-projects/weapp-vite/auto-import')
const { workspaceRootDir, workspaceRootNodeModulesDir, workspaceWeappViteDir } = resolveBenchmarkTarget(import.meta.dirname)
const reportDir = resolveReportDir('auto-import-hmr')
const reportJsonPath = path.join(reportDir, 'report.json')
const reportMdPath = path.join(reportDir, 'report.md')
const resolverComponents = createVantResolverComponents()
const allResolverTags = Object.keys(resolverComponents).sort((a, b) => a.localeCompare(b))
const DEFINE_CONFIG_IMPORT = pathToFileURL(path.join(workspaceWeappViteDir, 'dist/config.mjs')).href
const BENCHMARK_RESOLVER_PATH = './benchmark-vant-resolver'
const VANT_PACKAGE_PREFIX_RE = /^@vant\/weapp\/?/
const ORIGINAL_AUTO_IMPORT_BLOCK = [
  '      autoImportComponents: {',
  '        globs: [\'components/**/*\'],',
  '        resolvers: [',
  '          VantResolver()',
  '        ]',
  '      }',
].join('\n')
const CLI_PATH = path.join(workspaceWeappViteDir, 'bin/weapp-vite.js')
const DEV_TIMEOUT_MS = Number.parseInt(process.env.AUTO_IMPORT_HMR_TIMEOUT_MS ?? '90000', 10)
const INITIAL_BUILD_READY_RE = /小程序初次构建完成[\s\S]*开发服务已就绪/
const memoryNodeOptions = '--expose-gc --inspect=127.0.0.1:0'

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error(`Invalid BENCH_ITERATIONS value: ${iterations}`)
}

if (!Number.isFinite(DEV_TIMEOUT_MS) || DEV_TIMEOUT_MS <= 0) {
  throw new Error(`Invalid AUTO_IMPORT_HMR_TIMEOUT_MS value: ${DEV_TIMEOUT_MS}`)
}

if (diagnosticPairEnabled && (!diagnosticPairRoot || !['control', 'probe'].includes(diagnosticPairPhase ?? ''))) {
  throw new Error('Output equivalence diagnostic requires an explicit fixture root and control/probe phase')
}

if (diagnosticPairEnabled && diagnosticPairPhase === 'control' && (diagnosticEnabled || diagnosticProfileEnabled)) {
  throw new Error('Diagnostic control must run with timing and profile probes disabled')
}

if (diagnosticPairEnabled && diagnosticPairPhase === 'probe' && (!diagnosticEnabled || !diagnosticProfileEnabled)) {
  throw new Error('Diagnostic probe requires timing and candidate profile probes enabled')
}

async function main() {
  console.log(`[auto-import-hmr-bench] iterations=${iterations}`)
  console.log(`[auto-import-hmr-bench] total resolver components=${allResolverTags.length}`)
  console.log(`[auto-import-hmr-bench] scenarios=${scenarioValues.join(',')}`)
  if (disableCurrentSupportOutputs) {
    console.log('[auto-import-hmr-bench] current support outputs disabled')
  }

  const results = []
  for (const usedCount of scenarioValues) {
    const result = await runScenario(usedCount)
    results.push(result)
    if (!process.env.BENCH_CONFIGURATIONS) {
      printScenario(result)
    }
    await mkdir(reportDir, { recursive: true })
    await writeFile(reportJsonPath, JSON.stringify({ iterations, results: benchmarkReportResults(results) }, null, 2))
  }

  await mkdir(reportDir, { recursive: true })
  await writeFile(reportJsonPath, JSON.stringify({
    iterations,
    generatedAt: new Date().toISOString(),
    updateMeasurement: {
      completion: 'emitted-template-marker',
      clock: 'performance.now',
      pollIntervalMs: HMR_OUTPUT_POLL_INTERVAL_MS,
    },
    results: benchmarkReportResults(results),
  }, null, 2))
  await writeFile(reportMdPath, process.env.BENCH_CONFIGURATIONS ? '配置确认原始样本；未执行的配置不生成比较摘要。\n' : renderMarkdown(results), 'utf8')

  console.log(`[auto-import-hmr-bench] report.json -> ${reportJsonPath}`)
  console.log(`[auto-import-hmr-bench] report.md -> ${reportMdPath}`)
}

async function runScenario(usedCount: number) {
  const requestedCount = usedCount
  const usedTags = allResolverTags.slice(0, usedCount)
  usedCount = usedTags.length
  const raw: { manual: Awaited<ReturnType<typeof measureHmr>>[], automatic: Awaited<ReturnType<typeof measureHmr>>[] } = { manual: [], automatic: [] }
  const baselineStartupSamples: number[] = []
  const currentStartupSamples: number[] = []
  const baselineUpdateSamples: number[] = []
  const currentUpdateSamples: number[] = []
  const baselineStartupMemorySamples: Array<DevHeapUsage | undefined> = []
  const currentStartupMemorySamples: Array<DevHeapUsage | undefined> = []
  const baselineUpdateMemorySamples: Array<DevHeapUsage | undefined> = []
  const currentUpdateMemorySamples: Array<DevHeapUsage | undefined> = []

  for (let i = 0; i < iterations; i += 1) {
    if (benchmarkModeSelected(usedCount, 'manual')) {
      console.log(`[auto-import-progress] ${usedCount}:manual ${i + 1}/${iterations}`)
      const baseline = await measureHmr({ usedTags, mode: 'baseline', iteration: i })
      raw.manual.push(baseline)
      baselineStartupSamples.push(baseline.startupMs)
      baselineUpdateSamples.push(baseline.updateMs)
      baselineStartupMemorySamples.push(baseline.startupMemory)
      baselineUpdateMemorySamples.push(baseline.updateMemory)
    }
    if (benchmarkModeSelected(usedCount, 'automatic')) {
      console.log(`[auto-import-progress] ${usedCount}:automatic ${i + 1}/${iterations}`)
      const current = await measureHmr({ usedTags, mode: 'current', iteration: i })
      raw.automatic.push(current)
      currentStartupSamples.push(current.startupMs)
      currentUpdateSamples.push(current.updateMs)
      currentStartupMemorySamples.push(current.startupMemory)
      currentUpdateMemorySamples.push(current.updateMemory)
    }
  }

  const baselineStartup = summarizeNumbers(baselineStartupSamples)
  const currentStartup = summarizeNumbers(currentStartupSamples)
  const baselineUpdate = summarizeNumbers(baselineUpdateSamples)
  const currentUpdate = summarizeNumbers(currentUpdateSamples)

  return {
    usedCount,
    requestedCount,
    raw,
    startup: {
      baseline: baselineStartup,
      baselineMemory: summarizeHeapSamples(baselineStartupMemorySamples),
      current: currentStartup,
      currentMemory: summarizeHeapSamples(currentStartupMemorySamples),
      delta: {
        extraMs: currentStartup.mean - baselineStartup.mean,
        extraPercent: baselineStartup.mean > 0 ? ((currentStartup.mean - baselineStartup.mean) / baselineStartup.mean) * 100 : 0,
        ratio: baselineStartup.mean > 0 ? currentStartup.mean / baselineStartup.mean : 0,
      },
    },
    update: {
      baseline: baselineUpdate,
      baselineMemory: summarizeHeapSamples(baselineUpdateMemorySamples),
      current: currentUpdate,
      currentMemory: summarizeHeapSamples(currentUpdateMemorySamples),
      delta: {
        extraMs: currentUpdate.mean - baselineUpdate.mean,
        extraPercent: baselineUpdate.mean > 0 ? ((currentUpdate.mean - baselineUpdate.mean) / baselineUpdate.mean) * 100 : 0,
        ratio: baselineUpdate.mean > 0 ? currentUpdate.mean / baselineUpdate.mean : 0,
      },
    },
  }
}

async function measureHmr(options: {
  usedTags: string[]
  mode: 'baseline' | 'current'
  iteration: number
}) {
  const { usedTags, mode, iteration } = options
  const project = await createTempFixtureProject(
    fixtureSource,
    `auto-import-hmr-${mode}-${usedTags.length}-${iteration}`,
    diagnosticPairEnabled ? path.join(diagnosticPairRoot!, String(usedTags.length)) : undefined,
    diagnosticPairEnabled ? diagnosticPairRoot : undefined,
    diagnosticPairOwner,
  )
  const pagePath = path.join(project.tempDir, 'src/pages/bench-hmr-auto-import/index.vue')
  const profilePath = path.join(project.tempDir, '.diagnostics/hmr-profile.jsonl')
  let measured: {
    startupMs: number
    cycles: Array<{ editMs: number, restoreMs: number }>
    startupMemory?: DevHeapUsage
    updateMs: number
    updateMemory?: DevHeapUsage
    diagnostic?: Record<string, unknown>
    pairEvidence?: Record<string, unknown>
  } | undefined
  let canRemoveFixture = true

  return runWithCleanup(async () => {
    const acknowledgementObservations: Array<{ phase: 'start' | 'complete', targetVersion: number, buildIdFingerprint: string, observedAt: number, clock: string }> = []
    const pairCycles: Array<{ cycle: number, edit: Record<string, unknown>, restore: Record<string, unknown> }> = []
    const seededSource = await seedFixture(project.tempDir, usedTags, mode)
    await rm(path.join(project.tempDir, 'dist'), { recursive: true, force: true })
    await rm(path.join(project.tempDir, '.weapp-vite'), { recursive: true, force: true })

    const startupStart = performance.now()
    canRemoveFixture = false
    const dev = startDevProcess(process.execPath, [CLI_PATH, 'dev', project.tempDir, '--platform', 'weapp', '--skipNpm'], {
      cwd: workspaceRootDir,
      env: {
        ...createBenchmarkDevEnv(memoryNodeOptions),
        ...(diagnosticProfileEnabled ? { WEAPP_VITE_HMR_PROFILE_JSON: profilePath } : {}),
        DEBUG: 'weapp-vite:load-entry',
        PATH: createBenchmarkPath(path.join(workspaceRootNodeModulesDir, '.bin')),
      },
      stdout: 'pipe',
      stderr: 'pipe',
      all: true,
    })

    await runWithCleanup(async () => {
      await dev.waitForOutput(INITIAL_BUILD_READY_RE, `${mode} initial bench output`, DEV_TIMEOUT_MS)
      const startupMs = performance.now() - startupStart
      const inspectorUrl = await waitForInspectorUrl(dev.getOutput, `${mode} auto-import HMR benchmark`, DEV_TIMEOUT_MS)
      const startupMemory = await sampleHeapAfterGc(inspectorUrl).catch(() => undefined)

      const outputPath = path.join(project.tempDir, 'dist/pages/bench-hmr-auto-import/index.wxml')
      const distDir = path.join(project.tempDir, 'dist')
      const originalOutput = await readFile(outputPath, 'utf8')
      const originalOutputSha256 = diagnosticEnabled ? hashWxmlOutput(originalOutput) : undefined
      const controlPath = path.join(distDir, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE)
      const controlSource = await readFile(controlPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          return undefined
        }
        throw error
      })
      const client = controlSource === undefined ? undefined : new StatefulHmrAuditClient()
      if (client && controlSource !== undefined) {
        await client.ensureRegistered(parseStatefulHmrControlSource(controlSource), DEV_TIMEOUT_MS)
      }
      const initialOutputSnapshot = diagnosticPairEnabled
        ? await snapshotOutputCheckpoint(distDir, { type: 'initial-build-ready' }, controlSource)
        : undefined
      const measureArtifact = async (marker: string, source: string, signal: AbortSignal, absent = false) => {
        let observation: { sourceWriteStartedAt: number, wxmlObservedAt: number, elapsedMs: number, output: string } | undefined
        const acknowledgementOffset = acknowledgementObservations.length
        const publishSignals: Array<{ type: string, targetVersion?: number, observedAt: number, clock: string }> = []
        const helperResult = await measureStatefulTemplateArtifact({
          client,
          readControl: async signal => parseStatefulHmrControlSource(await readFile(controlPath, { encoding: 'utf8', signal })),
          isCurrentUpdate: async (signal) => {
            const output = await readFile(outputPath, { encoding: 'utf8', signal })
            signal?.throwIfAborted()
            return absent ? output === originalOutput : output.includes(marker)
          },
          timeoutMs: DEV_TIMEOUT_MS,
          signal,
          onEvent: diagnosticEnabled || diagnosticPairEnabled
            ? (event) => {
                publishSignals.push({ type: event.type, targetVersion: event.targetVersion, observedAt: performance.now(), clock: 'benchmark-process-performance.now' })
              }
            : undefined,
          onAcknowledgement: diagnosticEnabled || diagnosticPairEnabled
            ? (event) => {
                acknowledgementObservations.push({
                  phase: event.phase,
                  targetVersion: event.targetVersion,
                  buildIdFingerprint: hashWxmlOutput(event.buildId),
                  observedAt: performance.now(),
                  clock: 'benchmark-process-performance.now',
                })
              }
            : undefined,
          measure: signal => dev.waitFor(measureFileMarkerUpdate({
            outputPath,
            marker,
            expectedOutput: absent ? originalOutput : undefined,
            update: () => writeFile(pagePath, source, 'utf8'),
            timeoutMs: DEV_TIMEOUT_MS,
            signal,
            onObserved: diagnosticEnabled ? (value) => { observation = value } : undefined,
          }), `${mode} ${absent ? 'restored hmr output' : 'emitted hmr marker'}`),
        })
        if (!diagnosticEnabled) {
          if (!diagnosticPairEnabled) {
            return { ms: helperResult, diagnostic: undefined, pairEvidence: undefined }
          }
          return { ms: helperResult, diagnostic: undefined, pairEvidence: await snapshotPublishedOutputs(distDir, publishSignals, client?.supportsExplicitAcknowledgement ?? false, controlSource) }
        }
        const helperCompletedAt = performance.now()
        if (!observation) {
          throw new Error('HMR diagnostic did not capture the complete WXML observation')
        }
        const outputMatchesOriginal = observation.output === originalOutput
        const outputContainsMarker = observation.output.includes(marker)
        if (absent && !outputMatchesOriginal) {
          throw new Error('HMR diagnostic restore output differs from the initial WXML')
        }
        if (!absent && !outputContainsMarker) {
          throw new Error('HMR diagnostic edit output is missing its marker')
        }
        const diagnostic = {
          clock: { source: 'benchmark-process-performance.now', timeOrigin: performance.timeOrigin },
          sourceWriteStartedAt: observation.sourceWriteStartedAt,
          wxmlObservedAt: observation.wxmlObservedAt,
          helperCompletedAt,
          helperTailMs: helperCompletedAt - observation.wxmlObservedAt,
          observedElapsedMs: observation.elapsedMs,
          outputSha256: hashWxmlOutput(observation.output),
          outputBytes: Buffer.byteLength(observation.output, 'utf8'),
          outputMatchesInitial: outputMatchesOriginal,
          outputContainsMarker,
          completionBoundary: 'artifact-consumer-helper-resolved',
          publicationObservations: publishSignals,
          acknowledgementObservations: acknowledgementObservations.slice(acknowledgementOffset),
        }
        const pairEvidence = diagnosticPairEnabled
          ? await snapshotPublishedOutputs(distDir, publishSignals, client?.supportsExplicitAcknowledgement ?? false, controlSource)
          : undefined
        return {
          ms: helperResult,
          diagnostic,
          pairEvidence,
        }
      }
      const cycles: Array<{ editMs: number, restoreMs: number }> = []
      const diagnosticCycles: Array<{ cycle: number, edit: Record<string, unknown>, restore: Record<string, unknown> }> = []
      for (let cycle = 0; cycle < (process.env.AUTO_IMPORT_BENCH_PAIRED === '1' ? 2 : 1); cycle++) {
        const marker = `auto-import-hmr-${mode}-${usedTags.length}-${iteration}-${cycle}`
        const updatedSource = insertMarkerBeforeClosingView(seededSource, marker)
        const measurementAbort = new AbortController()
        try {
          const edit = await measureArtifact(marker, updatedSource, measurementAbort.signal)
          const restore = await measureArtifact(marker, seededSource, measurementAbort.signal, true)
          cycles.push({ editMs: edit.ms, restoreMs: restore.ms })
          if (diagnosticEnabled) {
            diagnosticCycles.push({ cycle, edit: edit.diagnostic!, restore: restore.diagnostic! })
          }
          if (diagnosticPairEnabled) {
            pairCycles.push({ cycle, edit: edit.pairEvidence!, restore: restore.pairEvidence! })
          }
        }
        finally {
          measurementAbort.abort()
        }
      }
      const updateMs = cycles[0]!.editMs
      const updateMemory = await sampleHeapAfterGc(inspectorUrl).catch(() => undefined)

      measured = {
        startupMs,
        cycles,
        startupMemory,
        updateMs,
        updateMemory,
      }
      if (diagnosticEnabled) {
        measured.diagnostic = {
          schemaVersion: 1,
          initialArtifact: { sha256: originalOutputSha256, bytes: Buffer.byteLength(originalOutput, 'utf8') },
          cycles: diagnosticCycles,
          ...(diagnosticProfileEnabled ? {} : { profileCapture: 'not-requested' }),
          profileInterpretation: 'candidate attribution only; not performance gate evidence',
        }
      }
      if (diagnosticPairEnabled) {
        measured.pairEvidence = {
          schemaVersion: 1,
          phase: diagnosticPairPhase,
          fixtureKey: usedTags.length,
          outputCompletion: 'stateful batch-published event observed; helper then resolves, including its existing acknowledgement behavior',
          initial: initialOutputSnapshot,
          cycles: pairCycles,
          acknowledgementObservations,
          snapshotsOutsideMeasuredIntervals: true,
          postObservationSnapshotCanAffectNextCyclePollPhase: true,
        }
      }
    }, async () => {
      await dev.stop()
      canRemoveFixture = true
    })
    if (!measured) {
      throw new Error('Auto-import HMR benchmark completed without a measurement')
    }
    if (diagnosticProfileEnabled) {
      const targetVersions = pairCycles.flatMap(cycle => [cycle.edit, cycle.restore])
        .map(checkpoint => (checkpoint as { completionSignal?: { targetVersion?: number } }).completionSignal?.targetVersion)
        .filter((version): version is number => typeof version === 'number')
      const profile = await readDiagnosticProfile(profilePath, pagePath, project.tempDir, targetVersions, acknowledgementObservations)
      if (profile.status !== 'available' || profile.invalidLineCount > 0 || profile.matchingSourceEventCount === 0 || profile.sessionMatchedSampleCount === 0) {
        throw new Error('Candidate HMR profile is missing, invalid, or has no matching page source events')
      }
      measured.diagnostic!.profileCapture = profile.status
      measured.diagnostic!.profile = profile
    }
    return measured
  }, async () => {
    // 进程退出及输出排空未核验时保留 fixture，避免删除存活 watcher 的输入。
    if (canRemoveFixture) {
      await project.cleanup()
    }
  })
}

async function seedFixture(projectRoot: string, usedTags: string[], mode: 'baseline' | 'current') {
  const pageDir = path.join(projectRoot, 'src/pages/bench-hmr-auto-import')
  const pagePath = path.join(pageDir, 'index.vue')
  const appJsonPath = path.join(projectRoot, 'src/app.json')
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const tags = usedTags
    .map(tag => `    <${tag} data-bench="${tag}" />`)
    .join('\n')
  const source = [
    '<template>',
    '  <view class="bench-hmr-auto-import">',
    tags,
    '  </view>',
    '</template>',
    '',
    '<json>',
    JSON.stringify({
      navigationBarTitleText: 'Auto Import HMR Bench',
      ...(mode === 'baseline' ? { usingComponents: createUsingComponentsMap(usedTags) } : {}),
    }, null, 2),
    '</json>',
    '',
  ].join('\n')

  await ensureProjectConfigFiles(projectRoot)
  await patchBenchmarkConfigImports(projectRoot)
  await patchViteConfig(projectRoot, mode)
  await ensureBenchmarkResolverPackage(projectRoot, usedTags)
  await mkdir(pageDir, { recursive: true })
  await writeFile(pagePath, source, 'utf8')

  const appJson = JSON.parse(await readFile(appJsonPath, 'utf8')) as { pages?: string[] }
  appJson.pages = ['pages/bench-hmr-auto-import/index']
  await writeFile(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, 'utf8')

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  packageJson.dependencies = {
    ...(packageJson.dependencies ?? {}),
    '@vant/weapp': '1.0.0-benchmark',
  }
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')

  return source
}

async function patchViteConfig(projectRoot: string, mode: 'baseline' | 'current') {
  const replacement = mode === 'baseline'
    ? '      autoImportComponents: false,'
    : [
        '      autoImportComponents: {',
        ...(disableCurrentSupportOutputs
          ? [
              '        output: false,',
              '        typedComponents: false,',
              '        htmlCustomData: false,',
              '        vueComponents: false,',
            ]
          : []),
        '        resolvers: [',
        '          VantResolver()',
        '        ]',
        '      }',
      ].join('\n')
  await patchProjectConfigFile(
    projectRoot,
    content => content.replace(ORIGINAL_AUTO_IMPORT_BLOCK, replacement),
    {
      errorMessage: 'Failed to patch benchmark config for hmr benchmark',
    },
  )
}

async function patchBenchmarkConfigImports(projectRoot: string) {
  await patchProjectConfigFile(
    projectRoot,
    content => content
      .replace(`import { defineConfig } from 'weapp-vite'`, `import { defineConfig } from '${DEFINE_CONFIG_IMPORT}'`)
      .replace(`import { VantResolver } from 'weapp-vite/auto-import-components/resolvers'`, `import { VantResolver } from '${BENCHMARK_RESOLVER_PATH}'`),
    {
      allowUnchanged: true,
      errorMessage: 'Failed to patch benchmark config imports for hmr benchmark',
    },
  )

  await writeBenchmarkResolverFile(projectRoot, renderBenchmarkVantResolver())
}

async function ensureProjectConfigFiles(projectRoot: string) {
  for (const fileName of ['project.config.json', 'project.private.config.json']) {
    const sourcePath = path.join(fixtureSource, fileName)
    const targetPath = path.join(projectRoot, fileName)
    const content = await readFile(sourcePath, 'utf8')
    await writeFile(targetPath, content, 'utf8')
  }
}

function createUsingComponentsMap(usedTags: string[]) {
  return Object.fromEntries(
    usedTags.map((tag) => {
      const from = resolverComponents[tag]
      if (!from) {
        throw new Error(`Missing resolver mapping for benchmark tag: ${tag}`)
      }
      return [tag, from]
    }),
  )
}

async function ensureBenchmarkResolverPackage(projectRoot: string, usedTags: string[]) {
  const tempRoot = path.dirname(projectRoot)
  const packageRoot = path.join(tempRoot, 'node_modules/@vant/weapp')
  await mkdir(packageRoot, { recursive: true })
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: '@vant/weapp',
    version: '1.0.0-benchmark',
  }, null, 2))

  for (const tag of usedTags) {
    const from = resolverComponents[tag]
    if (!from) {
      throw new Error(`Missing resolver mapping for benchmark tag: ${tag}`)
    }
    const relativeEntry = from.replace(VANT_PACKAGE_PREFIX_RE, '')
    const componentDir = path.join(packageRoot, relativeEntry)
    await mkdir(componentDir, { recursive: true })
    await writeFile(path.join(componentDir, 'index.json'), `${JSON.stringify({ component: true }, null, 2)}\n`, 'utf8')
    await writeFile(path.join(componentDir, 'index.js'), 'Component({})\n', 'utf8')
    await writeFile(path.join(componentDir, 'index.wxml'), `<view data-bench="${tag}">${tag}</view>\n`, 'utf8')
    await writeFile(path.join(componentDir, 'index.wxss'), '', 'utf8')
  }
}

async function createTempFixtureProject(sourceRoot: string, prefix: string, stableRoot?: string, ownedRoot?: string, owner?: string) {
  const base = path.join(workspaceRootDir, '.tmp/auto-import-workspaces')
  const tempRoot = stableRoot ? path.resolve(stableRoot) : await createTemporaryRoot(base, prefix)
  const tempDir = path.join(tempRoot, 'project')
  if (stableRoot) {
    const resolvedOwnedRoot = path.resolve(ownedRoot ?? '')
    const sentinelPath = path.join(resolvedOwnedRoot, '.auto-import-hmr-diagnostic-owner')
    const ownedRootStat = ownedRoot ? await lstat(resolvedOwnedRoot).catch(() => undefined) : undefined
    const sentinelStat = await lstat(sentinelPath).catch(() => undefined)
    const sentinel = sentinelStat?.isFile() && !sentinelStat.isSymbolicLink() ? await readFile(sentinelPath, 'utf8') : undefined
    const fixtureRootStat = await lstat(tempRoot).catch(() => undefined)
    if (!ownedRoot || !owner || !ownedRootStat?.isDirectory() || ownedRootStat.isSymbolicLink()
      || path.dirname(tempRoot) !== resolvedOwnedRoot || sentinel !== `${owner}\n`
      || (fixtureRootStat && (!fixtureRootStat.isDirectory() || fixtureRootStat.isSymbolicLink()))) {
      throw new Error('Refusing to reset a diagnostic fixture without this workflow run ownership sentinel')
    }
    await mkdir(tempRoot, { recursive: true })
    await rm(tempDir, { recursive: true, force: true })
  }
  const ignored = new Set(['.weapp-vite', 'dist', 'node_modules'])

  await cp(sourceRoot, tempDir, {
    dereference: true,
    force: true,
    recursive: true,
    filter: (src) => {
      const relative = path.relative(sourceRoot, src).replaceAll('\\', '/')
      if (!relative) {
        return true
      }
      return !Array.from(ignored).some(entry => relative === entry || relative.startsWith(`${entry}/`))
    },
  })

  await linkBenchmarkDependencies(tempDir, workspaceRootNodeModulesDir, workspaceWeappViteDir)

  return {
    tempDir,
    cleanup: async () => {
      if (!stableRoot) {
        await rm(tempRoot, { recursive: true, force: true })
      }
    },
  }
}

async function createTemporaryRoot(base: string, prefix: string) {
  await mkdir(base, { recursive: true })
  return mkdtemp(path.join(base, `${prefix}-`))
}

function createVantResolverComponents() {
  return Object.fromEntries(vantComponents.map(component => [toVantTag(component), `@vant/weapp/${component}`]))
}

function hashWxmlOutput(output: string) {
  return createHash('sha256').update(Buffer.from(output, 'utf8')).digest('hex')
}

function toVantTag(component: string) {
  return `van-${component}`
}

function renderBenchmarkVantResolver() {
  return [
    `const components = Object.freeze(${JSON.stringify(resolverComponents, null, 2)} as const)`,
    '',
    'export function VantResolver() {',
    '  return {',
    '    components,',
    '    supportFilesStrategy: \'full\',',
    '    resolve(componentName: string) {',
    '      const from = components[componentName as keyof typeof components]',
    '      if (!from) {',
    '        return undefined',
    '      }',
    '      return { name: componentName, from }',
    '    },',
    '  }',
    '}',
    '',
  ].join('\n')
}

function resolveReportDir(reportName: string) {
  if (process.env.BENCH_REPORT_DIR) {
    return path.resolve(process.env.BENCH_REPORT_DIR)
  }
  return path.resolve(
    import.meta.dirname,
    `../benchmark/${reportName}`,
    formatTimestamp(new Date()),
  )
}

function parseScenarioValues(input: string | undefined) {
  const parsed = (input ?? '1,5,20')
    .split(',')
    .map(value => Number.parseInt(value.trim(), 10))
    .filter(value => Number.isFinite(value) && value > 0)
  if (parsed.length === 0) {
    throw new Error(`Invalid BENCH_SCENARIOS value: ${input ?? ''}`)
  }
  return parsed
}

function insertMarkerBeforeClosingView(source: string, marker: string) {
  const needle = '  </view>\n</template>'
  const markerLine = `    <view data-bench-marker="${marker}">${marker}</view>\n`
  if (!source.includes(needle)) {
    throw new Error('Unexpected benchmark page structure while inserting hmr marker.')
  }
  return source.replace(needle, `${markerLine}${needle}`)
}

function summarizeNumbers(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const total = values.reduce((sum, value) => sum + value, 0)
  const mid = Math.floor(sorted.length / 2)
  return {
    samples: [...values],
    min: sorted[0] ?? 0,
    max: sorted.at(-1) ?? 0,
    mean: values.length ? total / values.length : 0,
    median: sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0),
  }
}

function summarizeHeapSamples(samples: Array<DevHeapUsage | undefined>) {
  return {
    heapUsed: summarizeOptionalMemory(samples.map(sample => sample?.heapUsed)),
    rss: summarizeOptionalMemory(samples.map(sample => sample?.rss)),
  }
}

function printScenario(result: Awaited<ReturnType<typeof runScenario>>) {
  console.log(`\n[hmr-scenario] used resolver components=${result.usedCount}`)
  console.log(`startup baseline | avg ${result.startup.baseline.mean.toFixed(2)}ms`)
  console.log(`startup current  | avg ${result.startup.current.mean.toFixed(2)}ms`)
  console.log(`startup memory   | heap ${formatMemoryMiB(result.startup.baselineMemory.heapUsed.mean)} -> ${formatMemoryMiB(result.startup.currentMemory.heapUsed.mean)} | rss ${formatMemoryMiB(result.startup.baselineMemory.rss.mean)} -> ${formatMemoryMiB(result.startup.currentMemory.rss.mean)}`)
  console.log(`startup delta    | extra ${result.startup.delta.extraMs.toFixed(2)}ms | extra ${result.startup.delta.extraPercent.toFixed(2)}%`)
  console.log(`update baseline  | avg ${result.update.baseline.mean.toFixed(2)}ms`)
  console.log(`update current   | avg ${result.update.current.mean.toFixed(2)}ms`)
  console.log(`update memory    | heap ${formatMemoryMiB(result.update.baselineMemory.heapUsed.mean)} -> ${formatMemoryMiB(result.update.currentMemory.heapUsed.mean)} | rss ${formatMemoryMiB(result.update.baselineMemory.rss.mean)} -> ${formatMemoryMiB(result.update.currentMemory.rss.mean)}`)
  console.log(`update delta     | extra ${result.update.delta.extraMs.toFixed(2)}ms | extra ${result.update.delta.extraPercent.toFixed(2)}%`)
}

function renderMarkdown(results: Array<Awaited<ReturnType<typeof runScenario>>>) {
  const lines = [
    '# autoImportComponents HMR 基准报告',
    '',
    `- 迭代次数：\`${iterations}\``,
    '',
    '## 启动阶段',
    '',
    '| 场景 | 基线平均耗时 | 当前平均耗时 | 额外成本 | heap | rss | 比例 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]

  for (const result of results) {
    lines.push(
      `| 使用 ${result.usedCount} 个 Vant 组件 | ${result.startup.baseline.mean.toFixed(2)} ms | ${result.startup.current.mean.toFixed(2)} ms | ${result.startup.delta.extraMs.toFixed(2)} ms (${result.startup.delta.extraPercent.toFixed(2)}%) | ${formatMemoryMiB(result.startup.baselineMemory.heapUsed.mean)} -> ${formatMemoryMiB(result.startup.currentMemory.heapUsed.mean)} | ${formatMemoryMiB(result.startup.baselineMemory.rss.mean)} -> ${formatMemoryMiB(result.startup.currentMemory.rss.mean)} | ${result.startup.delta.ratio.toFixed(2)}x |`,
    )
  }

  lines.push('')
  lines.push('## HMR 更新阶段')
  lines.push('')
  lines.push('| 场景 | 基线平均耗时 | 当前平均耗时 | 额外成本 | heap | rss | 比例 |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')

  for (const result of results) {
    lines.push(
      `| 使用 ${result.usedCount} 个 Vant 组件 | ${result.update.baseline.mean.toFixed(2)} ms | ${result.update.current.mean.toFixed(2)} ms | ${result.update.delta.extraMs.toFixed(2)} ms (${result.update.delta.extraPercent.toFixed(2)}%) | ${formatMemoryMiB(result.update.baselineMemory.heapUsed.mean)} -> ${formatMemoryMiB(result.update.currentMemory.heapUsed.mean)} | ${formatMemoryMiB(result.update.baselineMemory.rss.mean)} -> ${formatMemoryMiB(result.update.currentMemory.rss.mean)} | ${result.update.delta.ratio.toFixed(2)}x |`,
    )
  }

  lines.push('')
  lines.push('## 说明')
  lines.push('')
  lines.push('- `baseline`：关闭 `autoImportComponents`，并手动声明同一批 `usingComponents` 后启动 dev 并执行相同模板改动。')
  lines.push('- `current`：开启当前自动导入实现后启动 dev 并执行相同模板改动。')
  lines.push('- `startup` 表示从启动 dev 到首个 benchmark 页面产物可见的耗时。')
  lines.push('- `update` 表示修改 benchmark 页面后，dist 模板产物出现新标记的耗时。')
  lines.push(`- 更新计时使用单调时钟，产物每 ${HMR_OUTPUT_POLL_INTERVAL_MS} ms 检查一次；编译日志不作为完成证据。`)
  lines.push('- `heap` / `rss` 为触发 GC 后的 dev 进程内存均值，原始 samples 保存在 JSON 报告中。')
  lines.push('')

  return `${lines.join('\n')}\n`
}

function formatTimestamp(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

void main().catch(async (error) => {
  console.error(error)
  await mkdir(reportDir, { recursive: true })
  await writeFile(path.join(reportDir, 'error.txt'), `${JSON.stringify(serializeSequenceError(error), null, 2)}\n`)
  process.exitCode = 1
})
