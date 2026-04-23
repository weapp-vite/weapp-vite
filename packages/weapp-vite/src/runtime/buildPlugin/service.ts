import type PQueue from 'p-queue'
import type {
  RolldownOutput,
  RolldownWatcher,
} from 'rolldown'
import type { InlineConfig } from 'vite'
import type { BuildTarget, MutableCompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import { appendFile, mkdir } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { build } from 'vite'
import { debug, logger } from '../../context/shared'
import { createCompilerContext } from '../../createContext'
import { touch } from '../../utils/file'
import { resolveHmrProfileJsonPath as resolveHmrProfileJsonOutputPath } from '../../utils/hmrProfile'
import { resolveCompilerOutputExtensions } from '../../utils/outputExtensions'
import { syncProjectConfigToOutput } from '../../utils/projectConfig'
import { generateLibDts } from '../libDts'
import { hasLocalSubPackageNpmConfig } from '../npmPlugin/service'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { createIndependentBuilder } from './independent'
import { cleanOutputs, isOutputRootInsideOutDir, resetEmittedOutputCaches } from './outputs'
import { resolveTouchAppWxssEnabled } from './touchAppWxss'
import { buildWorkers, checkWorkersOptions, devWorkers, watchWorkers } from './workers'

export interface BuildOptions {
  skipNpm?: boolean
}

export interface BuildService {
  queue: PQueue
  build: (options?: BuildOptions) => Promise<RolldownOutput | RolldownOutput[] | RolldownWatcher>
  buildIndependentBundle: (root: string, meta: SubPackageMetaValue) => Promise<RolldownOutput>
  getIndependentOutput: (root: string) => RolldownOutput | undefined
  invalidateIndependentOutput: (root: string) => void
}

interface HmrProfileJsonSample {
  timestamp: string
  totalMs: number
  event?: string
  file?: string
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
  dirtyReasonSummary?: string[]
  pendingReasonSummary?: string[]
}

interface HmrPhaseRegressionCandidate {
  label: 'watch->dirty' | 'emit' | 'shared'
  currentMs: number
  averageMs: number
  ratio: number
}

export function createBuildService(ctx: MutableCompilerContext): BuildService {
  let lastHmrSlowTipProfileCount = 0

  function formatReasonLabel(reason: string) {
    if (reason.startsWith('entry-direct:')) {
      return 'entry'
    }
    if (reason.startsWith('sidecar-direct:')) {
      return 'sidecar'
    }
    if (reason.startsWith('importer-graph:')) {
      return 'importer'
    }
    if (reason.startsWith('layout-self:')) {
      return 'layout-self'
    }
    if (reason.startsWith('layout-dependent:')) {
      return 'layout-dependent'
    }
    if (reason.startsWith('layout-propagation:')) {
      return 'layout'
    }
    if (reason.startsWith('layout-fallback-full:')) {
      return 'layout-full'
    }
    if (reason.startsWith('auto-routes-topology:')) {
      return 'routes-topology'
    }
    if (reason.startsWith('shared-chunk(')) {
      const countMatch = reason.match(/\+(\d+):/)
      return countMatch ? `shared+${countMatch[1]}` : 'shared'
    }
    return reason
  }

  function formatReasonSummary(reasons?: string[]) {
    if (!reasons?.length) {
      return undefined
    }
    const labels = reasons.map(formatReasonLabel)
    const [first, ...rest] = labels
    return rest.length ? `${first}+${rest.length}` : first
  }

  function recordHmrProfile(totalMs: number) {
    const hmrState = ctx.runtimeState.build.hmr
    hmrState.recentProfiles.push({
      totalMs,
      watchToDirtyMs: hmrState.profile.watchToDirtyMs,
      emitMs: hmrState.profile.emitMs,
      sharedChunkResolveMs: hmrState.profile.sharedChunkResolveMs,
      dirtyCount: hmrState.profile.dirtyCount,
      pendingCount: hmrState.profile.pendingCount,
      emittedCount: hmrState.profile.emittedCount,
    })
    if (hmrState.recentProfiles.length > 5) {
      hmrState.recentProfiles.splice(0, hmrState.recentProfiles.length - 5)
    }
  }

  function formatHmrRecentSummary() {
    const recentProfiles = ctx.runtimeState.build.hmr.recentProfiles
    if (recentProfiles.length < 2) {
      return ''
    }

    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    const totalValues = recentProfiles.map(item => item.totalMs)
    const segments = [
      `近${recentProfiles.length}次 avg ${average(totalValues).toFixed(0)} ms`,
      `max ${Math.max(...totalValues).toFixed(2)} ms`,
    ]

    return `；${segments.join('，')}`
  }

  function formatHmrProfileSummary() {
    const profile = ctx.runtimeState.build.hmr.profile
    const segments: string[] = []

    if (profile.watchToDirtyMs !== undefined) {
      segments.push(`watch->dirty ${profile.watchToDirtyMs.toFixed(2)} ms`)
    }
    if (profile.emitMs !== undefined) {
      segments.push(`emit ${profile.emitMs.toFixed(2)} ms`)
    }
    if (profile.sharedChunkResolveMs !== undefined) {
      segments.push(`shared ${profile.sharedChunkResolveMs.toFixed(2)} ms`)
    }
    if (
      profile.dirtyCount !== undefined
      || profile.pendingCount !== undefined
      || profile.emittedCount !== undefined
    ) {
      segments.push(`d/p/e ${profile.dirtyCount ?? 0}/${profile.pendingCount ?? 0}/${profile.emittedCount ?? 0}`)
    }
    const dirtyReason = formatReasonSummary(profile.dirtyReasonSummary)
    const pendingReason = formatReasonSummary(profile.pendingReasonSummary)
    if (dirtyReason || pendingReason) {
      segments.push(`cause ${dirtyReason ?? '-'} -> ${pendingReason ?? '-'}`)
    }
    if (!segments.length) {
      return ''
    }
    return `，${segments.join('，')}`
  }

  function resetHmrProfile() {
    ctx.runtimeState.build.hmr.profile = {}
  }

  function resolveHmrProfileJsonPath() {
    return resolveHmrProfileJsonOutputPath({
      cwd: ctx.configService.cwd,
      option: ctx.configService?.weappViteConfig.hmr?.profileJson,
    })
  }

  function formatHmrPhaseRegressionHint(
    currentProfile: NonNullable<MutableCompilerContext['runtimeState']>['build']['hmr']['recentProfiles'][number],
    previousProfiles: NonNullable<MutableCompilerContext['runtimeState']>['build']['hmr']['recentProfiles'],
  ) {
    const candidates: HmrPhaseRegressionCandidate[] = []
    const phases = [
      {
        key: 'watchToDirtyMs',
        label: 'watch->dirty',
      },
      {
        key: 'emitMs',
        label: 'emit',
      },
      {
        key: 'sharedChunkResolveMs',
        label: 'shared',
      },
    ] as const

    for (const phase of phases) {
      const currentValue = currentProfile[phase.key]
      if (currentValue === undefined || currentValue < 5) {
        continue
      }
      const previousValues = previousProfiles.flatMap(item => item[phase.key] === undefined ? [] : [item[phase.key]])
      if (!previousValues.length) {
        continue
      }
      const averageMs = previousValues.reduce((sum, value) => sum + value, 0) / previousValues.length
      if (averageMs <= 0) {
        continue
      }
      candidates.push({
        label: phase.label,
        currentMs: currentValue,
        averageMs,
        ratio: currentValue / averageMs,
      })
    }

    const bestCandidate = candidates
      .filter(candidate => candidate.currentMs >= 10 && candidate.ratio >= 1.3)
      .sort((left, right) => right.ratio - left.ratio || right.currentMs - left.currentMs)[0]

    if (!bestCandidate) {
      return ''
    }

    return `；疑似慢段 ${bestCandidate.label} ${bestCandidate.currentMs.toFixed(2)} ms（近${previousProfiles.length}次均值 ${bestCandidate.averageMs.toFixed(2)} ms）`
  }

  function shouldLogSlowHmrTip() {
    const outputPath = resolveHmrProfileJsonPath()
    if (!outputPath) {
      return false
    }

    const recentProfiles = ctx.runtimeState.build.hmr.recentProfiles
    if (recentProfiles.length < 4) {
      return false
    }
    if (recentProfiles.length - lastHmrSlowTipProfileCount < 3) {
      return false
    }

    const currentProfile = recentProfiles.at(-1)
    if (!currentProfile) {
      return false
    }

    const previousProfiles = recentProfiles.slice(0, -1)
    const previousAverage = previousProfiles.reduce((sum, item) => sum + item.totalMs, 0) / previousProfiles.length

    if (currentProfile.totalMs < 120) {
      return false
    }
    if (currentProfile.totalMs < previousAverage * 1.5) {
      return false
    }

    lastHmrSlowTipProfileCount = recentProfiles.length
    logger.info(
      `检测到 HMR 重建明显变慢：当前 ${currentProfile.totalMs.toFixed(2)} ms，近${previousProfiles.length}次均值 ${previousAverage.toFixed(2)} ms${formatHmrPhaseRegressionHint(currentProfile, previousProfiles)}；建议运行 weapp-vite analyze --hmr-profile 查看阶段统计。`,
    )
    return true
  }

  function createHmrProfileJsonSample(totalMs: number): HmrProfileJsonSample {
    const profile = ctx.runtimeState.build.hmr.profile
    return {
      timestamp: new Date().toISOString(),
      totalMs,
      event: profile.event,
      file: profile.file,
      watchToDirtyMs: profile.watchToDirtyMs,
      emitMs: profile.emitMs,
      sharedChunkResolveMs: profile.sharedChunkResolveMs,
      dirtyCount: profile.dirtyCount,
      pendingCount: profile.pendingCount,
      emittedCount: profile.emittedCount,
      dirtyReasonSummary: profile.dirtyReasonSummary,
      pendingReasonSummary: profile.pendingReasonSummary,
    }
  }

  async function writeHmrProfileJsonSample(totalMs: number) {
    const outputPath = resolveHmrProfileJsonPath()
    if (!outputPath) {
      return
    }

    await mkdir(path.dirname(outputPath), { recursive: true })
    await appendFile(outputPath, `${JSON.stringify(createHmrProfileJsonSample(totalMs))}\n`, 'utf8')
  }

  function assertRuntimeServices(target: MutableCompilerContext): asserts target is MutableCompilerContext & {
    configService: NonNullable<MutableCompilerContext['configService']>
    watcherService: NonNullable<MutableCompilerContext['watcherService']>
    npmService: NonNullable<MutableCompilerContext['npmService']>
    scanService: NonNullable<MutableCompilerContext['scanService']>
  } {
    if (!target.configService || !target.watcherService || !target.npmService || !target.scanService) {
      throw new Error('构建服务需要先初始化 config、watcher、npm 和 scan 服务。')
    }
  }

  assertRuntimeServices(ctx)

  const { configService, watcherService, npmService, scanService } = ctx
  const buildState = ctx.runtimeState.build
  const { queue } = buildState
  let autoTouchResolved = false
  let autoTouchChecked = false

  const {
    buildIndependentBundle,
    getIndependentOutput,
    invalidateIndependentOutput,
  } = createIndependentBuilder(configService, buildState)

  function shouldTouchAppWxss() {
    const option = configService.weappViteConfig.hmr?.touchAppWxss ?? 'auto'
    if (option === true) {
      return true
    }
    if (option === false) {
      return false
    }
    if (!autoTouchChecked) {
      autoTouchChecked = true
      autoTouchResolved = resolveTouchAppWxssEnabled({
        option,
        platform: configService.platform,
        packageJson: configService.packageJson,
        cwd: configService.cwd,
      })
    }
    return autoTouchResolved
  }

  async function runDev(target: BuildTarget) {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }
    debug?.(`[${target}] dev build watcher start`)
    const { hasWorkersDir, workersDir } = checkWorkersOptions(target, configService, scanService)
    // eslint-disable-next-line ts/no-use-before-define
    const buildOptions = applyTargetBuildOverride(
      configService.merge(
        undefined,
        createSharedBuildConfig(configService, scanService),
        // eslint-disable-next-line ts/no-use-before-define
        resolveTargetBuildOverride(target),
      ),
      target,
    )
    const watcherPromise = build(
      buildOptions,
    ) as unknown as Promise<RolldownWatcher>
    const workerPromise = target === 'app' && hasWorkersDir && workersDir
      ? devWorkers(configService, watcherService, workersDir)
      : Promise.resolve()
    const [watcher] = await Promise.all([watcherPromise, workerPromise])
    const isTestEnv = process.env.VITEST === 'true'
      || process.env.NODE_ENV === 'test'

    if (target === 'app' && hasWorkersDir && workersDir && !isTestEnv) {
      watchWorkers(configService, watcherService, workersDir)
    }

    debug?.('dev build watcher end')
    debug?.('dev watcher listen start')

    let startTime: DOMHighResTimeStamp
    let firstBuildCompleted = false

    let resolveWatcher: (value: unknown) => void
    let rejectWatcher: (reason?: any) => void
    const promise = new Promise((res, rej) => {
      resolveWatcher = res
      rejectWatcher = rej
    })
    const { styleExtension } = resolveCompilerOutputExtensions(configService.outputExtensions)
    const appWxssPath = target === 'app'
      ? path.join(configService.outDir, `app.${styleExtension}`)
      : undefined

    watcher.on('event', (e) => {
      if (e.code === 'START') {
        startTime = performance.now()
      }
      else if (e.code === 'END') {
        const durationMs = performance.now() - startTime
        void (async () => {
          const duration = durationMs.toFixed(2)
          if (firstBuildCompleted) {
            recordHmrProfile(durationMs)
            await writeHmrProfileJsonSample(durationMs).catch((error) => {
              debug?.(`write hmr profile json failed: ${String(error)}`)
            })
            logger.success(`小程序已重新构建（${duration} ms${formatHmrProfileSummary()}${formatHmrRecentSummary()}）`)
            shouldLogSlowHmrTip()
          }
          else {
            firstBuildCompleted = true
          }
          resetHmrProfile()
          if (appWxssPath && shouldTouchAppWxss()) {
            void touch(appWxssPath).catch(() => {})
          }
          resolveWatcher(e)
        })().catch((error) => {
          resetHmrProfile()
          rejectWatcher(error)
        })
      }
      else if (e.code === 'ERROR') {
        resetHmrProfile()
        rejectWatcher(e)
      }
    })
    await promise

    const watcherRoot = target === 'plugin'
      ? configService.absolutePluginRoot ?? configService.absoluteSrcRoot
      : '/'
    watcherService.setRollupWatcher(watcher, watcherRoot)
    return watcher
  }

  async function runProd(target: BuildTarget) {
    debug?.(`[${target}] prod build start`)
    const { hasWorkersDir } = checkWorkersOptions(target, configService, scanService)
    const bundlerPromise = build(
      // eslint-disable-next-line ts/no-use-before-define
      applyTargetBuildOverride(
        configService.merge(
          undefined,
          createSharedBuildConfig(configService, scanService),
          // eslint-disable-next-line ts/no-use-before-define
          resolveTargetBuildOverride(target),
        ),
        target,
      ),
    )
    const workerPromise = target === 'app' && hasWorkersDir ? buildWorkers(configService) : Promise.resolve()
    const [output] = await Promise.all([bundlerPromise, workerPromise])

    debug?.(`[${target}] prod build end`)
    return output as RolldownOutput | RolldownOutput[]
  }

  function scheduleNpmBuild(options?: BuildOptions) {
    if (options?.skipNpm) {
      return Promise.resolve()
    }

    const runTask = () => queue.add(async () => {
      await npmService.build()
      if (configService.isDev) {
        buildState.npmBuilt = true
      }
    })

    if (configService.isDev) {
      return (async () => {
        const isDependenciesOutdated = await npmService.checkDependenciesCacheOutdate()
        if (!isDependenciesOutdated && buildState.npmBuilt) {
          return
        }
        if (isDependenciesOutdated) {
          buildState.npmBuilt = false
        }
        const task = runTask()
        queue.start()
        await task
      })()
    }

    const task = runTask()
    queue.start()
    return task
  }

  function resolveTargetBuildOverride(target: BuildTarget) {
    if (target !== 'plugin') {
      return undefined
    }

    const pluginOutputRoot = configService.absolutePluginOutputRoot
    if (!pluginOutputRoot) {
      return undefined
    }

    if (isOutputRootInsideOutDir(configService.outDir, pluginOutputRoot)) {
      return undefined
    }

    return {
      build: {
        outDir: pluginOutputRoot,
      },
    }
  }

  function applyTargetBuildOverride<T extends { build?: { outDir?: string } }>(config: T, target: BuildTarget): T {
    const override = resolveTargetBuildOverride(target)
    if (!override?.build?.outDir) {
      return config
    }

    return {
      ...config,
      build: {
        ...(config.build ?? {}),
        outDir: override.build.outDir,
      },
    }
  }

  async function runIsolatedPluginBuild(options?: BuildOptions) {
    const pluginOutputRoot = configService.absolutePluginOutputRoot
    if (!pluginOutputRoot) {
      return undefined
    }

    const inlineConfig: InlineConfig = {
      build: {
        outDir: pluginOutputRoot,
      },
    }
    const isolatedKey = `plugin-build:${configService.cwd}`
    const isolatedCtx = await createCompilerContext({
      key: isolatedKey,
      cwd: configService.cwd,
      isDev: configService.isDev,
      mode: configService.mode,
      pluginOnly: true,
      configFile: configService.configFilePath,
      cliPlatform: configService.platform,
      projectConfigPath: configService.projectConfigPath,
      inlineConfig,
    })

    isolatedCtx.currentBuildTarget = 'plugin'
    const result = await isolatedCtx.buildService.build(options)
    if (configService.isDev && result && typeof (result as RolldownWatcher).on === 'function') {
      const watcherRoot = configService.absolutePluginRoot ?? configService.absoluteSrcRoot
      watcherService.setRollupWatcher(result as RolldownWatcher, watcherRoot)
    }
    return result
  }

  async function runBuildTarget(target: BuildTarget) {
    ctx.currentBuildTarget = target
    if (configService.isDev) {
      return await runDev(target)
    }
    return await runProd(target)
  }

  async function buildEntry(options?: BuildOptions) {
    const shouldCleanOutputs = !configService.isDev || configService.weappViteConfig.cleanOutputsInDev !== false
    if (shouldCleanOutputs) {
      await cleanOutputs(configService)
      resetEmittedOutputCaches(ctx.runtimeState)
    }
    const pluginOnly = configService.pluginOnly
    const isMultiPlatformEnabled = configService.multiPlatform.enabled
    const isLibMode = configService.weappLibConfig?.enabled
    const shouldEmitLibDts = Boolean(
      isLibMode
      && configService.weappLibConfig?.dts?.enabled !== false
      && !configService.isDev,
    )
    if (!isLibMode && !pluginOnly) {
      await syncProjectConfigToOutput({
        outDir: configService.outDir,
        projectConfigPath: configService.projectConfigPath,
        projectPrivateConfigPath: configService.projectPrivateConfigPath,
        enabled: isMultiPlatformEnabled,
      })
    }
    const shouldPreloadAppEntry = (
      !configService.isDev
      && !isLibMode
      && !pluginOnly
      && (
        (options?.skipNpm !== true && hasLocalSubPackageNpmConfig(ctx))
        || configService.weappViteConfig.worker?.entry !== undefined
      )
    )
    if (shouldPreloadAppEntry) {
      await scanService.loadAppEntry()
      scanService.loadSubPackages()
    }
    debug?.('build start')
    const npmBuildTask = isLibMode ? Promise.resolve() : scheduleNpmBuild(options)
    const result = await runBuildTarget(pluginOnly ? 'plugin' : 'app')
    if (shouldEmitLibDts) {
      await generateLibDts(configService)
    }
    await npmBuildTask
    if (!pluginOnly && !isLibMode && configService.absolutePluginRoot) {
      await runIsolatedPluginBuild(options)
    }
    debug?.('build end')
    return result
  }

  return {
    queue,
    build: buildEntry,
    buildIndependentBundle,
    getIndependentOutput,
    invalidateIndependentOutput,
  }
}
