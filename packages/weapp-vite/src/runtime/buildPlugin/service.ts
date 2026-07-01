import type PQueue from 'p-queue'
import type {
  RolldownOutput,
  RolldownWatcher,
} from 'rolldown'
import type { InlineConfig } from 'vite'
import type { BuildTarget, MutableCompilerContext } from '../../context'
import type { ChangeEvent, SubPackageMetaValue } from '../../types'
import { appendFile, mkdir } from 'node:fs/promises'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { build } from 'vite'
import { debug, logger } from '../../context/shared'
import { createCompilerContext } from '../../createContext'
import { invalidateFileCache } from '../../plugins/utils/cache'
import {
  configSuffixes,
  defaultIgnoredDirNames,
  isSidecarFile,
  watchedCssExts,
  watchedCssSuffixes,
  watchedScriptModuleSuffixes,
  watchedTemplateExts,
  watchedTemplateSuffixes,
} from '../../plugins/utils/invalidateEntry/shared'
import { isLayoutSourcePath } from '../../plugins/utils/layoutSourcePath'
import { findJsEntry, touch } from '../../utils/file'
import { createHmrProfileEventId, recordHmrProfileDuration, resolveHmrProfileJsonEnvOption, resolveHmrProfileJsonPath as resolveHmrProfileJsonOutputPath } from '../../utils/hmrProfile'
import { resolveCompilerOutputExtensions } from '../../utils/outputExtensions'
import { syncProjectConfigToOutput } from '../../utils/projectConfig'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { generateLibDts } from '../libDts'
import { hasLocalSubPackageNpmConfig } from '../npmPlugin/service'
import { createRuntimeState } from '../runtimeState'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { syncProjectSupportFiles } from '../supportFiles'
import { createSidecarWatchOptions } from '../watch/options'
import { createHmrProfileMetricsPlugin } from './hmrProfileMetricsPlugin'
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
  requestConfigRestart: (target?: BuildTarget) => void
  buildIndependentBundle: (root: string, meta: SubPackageMetaValue) => Promise<RolldownOutput>
  getIndependentOutput: (root: string) => RolldownOutput | undefined
  invalidateIndependentOutput: (root: string) => void
}

interface HmrProfileJsonSample {
  timestamp: string
  totalMs: number
  eventId?: string
  event?: string
  file?: string
  relativeFile?: string
  sourceRootFile?: string
  buildCoreMs?: number
  buildStartMs?: number
  transformMs?: number
  coreTransformMs?: number
  wevuTransformMs?: number
  vueTransformMs?: number
  coreLoadMs?: number
  entryLoadMs?: number
  requestGlobalsMs?: number
  weapiResolveMs?: number
  bundlerMs?: number
  renderStartMs?: number
  generateBundleMs?: number
  generateSharedMs?: number
  generateRewriteMs?: number
  generateModuleGraphMs?: number
  snapshotResolveMs?: number
  snapshotBuildMs?: number
  writeMs?: number
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
  chunkEmitCount?: number
  loadCount?: number
  skippedLoadedCount?: number
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
  dirtyReasonSummary?: string[]
  pendingReasonSummary?: string[]
}

interface HmrPhaseRegressionCandidate {
  label: 'build-core'
    | 'build-start'
    | 'transform'
    | 'core-transform'
    | 'wevu-transform'
    | 'vue-transform'
    | 'core-load'
    | 'entry-load'
    | 'request-globals'
    | 'weapi-resolve'
    | 'render-start'
    | 'generate'
    | 'generate-shared'
    | 'generate-rewrite'
    | 'module-graph'
    | 'watch->dirty'
    | 'emit'
    | 'shared'
    | 'write'
  currentMs: number
  averageMs: number
  ratio: number
}

interface SnapshotBuildReason {
  event?: ChangeEvent
  file?: string
}

interface SnapshotBuildBatch {
  reasons: SnapshotBuildReason[]
  startedAt: number
}

function resolveSnapshotSidecarDirtySummary(filePath: string) {
  const normalizedFile = normalizeFsResolvedId(filePath)
  const configSuffix = configSuffixes.find(suffix => normalizedFile.endsWith(suffix))
  if (configSuffix) {
    return 'json-sidecar:1'
  }
  const ext = path.extname(normalizedFile)
  if (ext && watchedCssExts.has(ext)) {
    return 'style-sidecar:1'
  }
  if (ext && watchedTemplateExts.has(ext)) {
    return 'sidecar-direct:1'
  }
  return 'sidecar-direct:1'
}

type ActiveConfigService = NonNullable<MutableCompilerContext['configService']>
const watchedSnapshotScriptExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'])
const SNAPSHOT_BUILD_BATCH_DELAY_MS = 8

function shouldHandleSnapshotSidecarFile(filePath: string, ctx: MutableCompilerContext) {
  const configService = ctx.configService!
  if (isSidecarFile(filePath)) {
    return true
  }
  const normalizedFile = normalizeFsResolvedId(filePath)
  const normalizedSrcRoot = normalizeFsResolvedId(configService.absoluteSrcRoot)
  if (normalizedFile === normalizedSrcRoot || normalizedFile.startsWith(`${normalizedSrcRoot}/`)) {
    return ctx.runtimeState.build.hmr.sharedChunkSourceModuleIds.has(normalizedFile)
  }
  return path.extname(filePath) !== ''
}

function isGeneratedMiniprogramWatchInclude(pattern: string, configService: ActiveConfigService) {
  if (pattern === '**') {
    return true
  }
  const normalizedPattern = normalizeFsResolvedId(
    path.isAbsolute(pattern) ? pattern : path.resolve(configService.cwd, pattern),
  )
  const normalizedSrcRoot = normalizeFsResolvedId(configService.absoluteSrcRoot)
  if (normalizedPattern === normalizedSrcRoot || normalizedPattern.startsWith(`${normalizedSrcRoot}/`)) {
    return true
  }
  if (configService.absolutePluginRoot) {
    const normalizedPluginRoot = normalizeFsResolvedId(configService.absolutePluginRoot)
    if (normalizedPattern === normalizedPluginRoot || normalizedPattern.startsWith(`${normalizedPluginRoot}/`)) {
      return true
    }
  }
  return (configService.configFileDependencies ?? []).some((dependency) => {
    const normalizedDependency = normalizeFsResolvedId(dependency)
    return normalizedPattern === normalizedDependency
  })
}

function resolveUserBuildWatchInclude(configService: ActiveConfigService, inlineConfig?: InlineConfig) {
  const buildWatch = inlineConfig?.build?.watch ?? configService?.inlineConfig?.build?.watch
  if (!buildWatch || typeof buildWatch !== 'object') {
    return []
  }
  const include = buildWatch.include
  const includeList = Array.isArray(include)
    ? include
    : include ? [include] : []
  return includeList
    .filter((pattern): pattern is string => typeof pattern === 'string')
    .filter(pattern => !isGeneratedMiniprogramWatchInclude(pattern, configService))
    .map(pattern => path.normalize(path.isAbsolute(pattern) ? pattern : path.resolve(configService.cwd, pattern)))
}

function createSnapshotSidecarWatchPatterns(configService: ActiveConfigService, inlineConfig?: InlineConfig) {
  const root = configService.absoluteSrcRoot
  const patterns: string[] = [
    ...configSuffixes.map(suffix => path.join(root, `**/*${suffix}`)),
    ...watchedCssSuffixes.map(ext => path.join(root, `**/*${ext}`)),
    ...watchedTemplateSuffixes.map(ext => path.join(root, `**/*${ext}`)),
    ...watchedScriptModuleSuffixes.map(ext => path.join(root, `**/*${ext}`)),
    ...Array.from(watchedSnapshotScriptExts).map(ext => path.join(root, `**/*${ext}`)),
  ]
  for (const include of resolveUserBuildWatchInclude(configService, inlineConfig)) {
    patterns.push(include)
  }
  return patterns
}

function createSnapshotSidecarIgnoredMatcher(ctx: MutableCompilerContext) {
  const configService = ctx.configService
  if (!configService) {
    return undefined
  }
  const ignoredRoots = new Set<string>()
  const watchRoot = normalizeFsResolvedId(configService.absoluteSrcRoot)
  for (const dirName of defaultIgnoredDirNames) {
    ignoredRoots.add(normalizeFsResolvedId(path.join(configService.absoluteSrcRoot, dirName)))
  }
  ignoredRoots.add(normalizeFsResolvedId(configService.outDir))
  if (configService.mpDistRoot) {
    ignoredRoots.add(normalizeFsResolvedId(path.resolve(configService.cwd, configService.mpDistRoot)))
  }
  return (candidate: string) => {
    const normalized = normalizeFsResolvedId(candidate)
    if (normalized === watchRoot) {
      return false
    }
    for (const ignored of ignoredRoots) {
      if (normalized === ignored || normalized.startsWith(`${ignored}/`)) {
        return true
      }
    }
    return false
  }
}

export function createBuildService(ctx: MutableCompilerContext): BuildService {
  let lastHmrSlowTipProfileCount = 0

  function createHmrProfileJsonSample(totalMs: number): HmrProfileJsonSample {
    const profile = ctx.runtimeState.build.hmr.profile
    const relativeFile = profile.file && ctx.configService
      ? ctx.configService.relativeCwd(profile.file)
      : undefined
    const sourceRootFile = profile.file && ctx.configService
      ? ctx.configService.relativeAbsoluteSrcRoot(profile.file)
      : undefined
    return {
      timestamp: new Date().toISOString(),
      totalMs,
      eventId: profile.eventId,
      event: profile.event,
      file: profile.file,
      relativeFile,
      sourceRootFile,
      buildCoreMs: profile.buildCoreMs,
      buildStartMs: profile.buildStartMs,
      transformMs: profile.transformMs,
      coreTransformMs: profile.coreTransformMs,
      wevuTransformMs: profile.wevuTransformMs,
      vueTransformMs: profile.vueTransformMs,
      coreLoadMs: profile.coreLoadMs,
      entryLoadMs: profile.entryLoadMs,
      requestGlobalsMs: profile.requestGlobalsMs,
      weapiResolveMs: profile.weapiResolveMs,
      bundlerMs: profile.bundlerMs,
      renderStartMs: profile.renderStartMs,
      generateBundleMs: profile.generateBundleMs,
      generateSharedMs: profile.generateSharedMs,
      generateRewriteMs: profile.generateRewriteMs,
      generateModuleGraphMs: profile.generateModuleGraphMs,
      snapshotResolveMs: profile.snapshotResolveMs,
      snapshotBuildMs: profile.snapshotBuildMs,
      writeMs: profile.writeMs,
      watchToDirtyMs: profile.watchToDirtyMs,
      emitMs: profile.emitMs,
      sharedChunkResolveMs: profile.sharedChunkResolveMs,
      chunkEmitCount: profile.chunkEmitCount,
      loadCount: profile.loadCount,
      skippedLoadedCount: profile.skippedLoadedCount,
      dirtyCount: profile.dirtyCount,
      pendingCount: profile.pendingCount,
      emittedCount: profile.emittedCount,
      dirtyReasonSummary: profile.dirtyReasonSummary,
      pendingReasonSummary: profile.pendingReasonSummary,
    }
  }

  function recordHmrProfile(totalMs: number) {
    const hmrState = ctx.runtimeState.build.hmr
    hmrState.recentProfiles.push(createHmrProfileJsonSample(totalMs))
    if (hmrState.recentProfiles.length > 5) {
      hmrState.recentProfiles.splice(0, hmrState.recentProfiles.length - 5)
    }
  }

  function resetHmrProfile() {
    ctx.runtimeState.build.hmr.profile = {}
  }

  function resolveHmrProfileJsonPath() {
    const envOption = resolveHmrProfileJsonEnvOption()
    return resolveHmrProfileJsonOutputPath({
      cwd: ctx.configService?.cwd ?? process.cwd(),
      option: envOption ?? ctx.configService?.weappViteConfig.hmr?.profileJson,
    })
  }

  function finalizeHmrProfile(totalMs: number) {
    const profile = ctx.runtimeState.build.hmr.profile
    const measuredMs = [
      profile.transformMs,
      profile.buildStartMs,
      profile.coreLoadMs,
      profile.renderStartMs,
      profile.generateBundleMs,
      profile.watchToDirtyMs,
      profile.emitMs,
      profile.writeMs,
    ].reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0)
    profile.buildCoreMs = Math.max(0, totalMs - measuredMs)
  }

  function appendHmrMetricsPlugin(config: InlineConfig) {
    if (!ctx.configService?.isDev) {
      return config
    }
    const plugins = config.plugins
    return {
      ...config,
      plugins: [
        ...(plugins ? (Array.isArray(plugins) ? plugins : [plugins]) : []),
        createHmrProfileMetricsPlugin(ctx),
      ],
    } satisfies InlineConfig
  }

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

  function resolveHmrLogLevel() {
    return ctx.configService?.weappViteConfig.hmr?.logLevel ?? 'default'
  }

  function formatHmrLogLine(durationMs: number) {
    const duration = durationMs.toFixed(2)
    const profile = ctx.runtimeState.build.hmr.profile
    const logLevel = resolveHmrLogLevel()

    if (logLevel === 'default') {
      return `小程序已重新构建（${duration} ms）`
    }

    if (logLevel === 'concise') {
      const conciseSegments = [
        typeof profile.buildCoreMs === 'number' ? `build-core ${profile.buildCoreMs.toFixed(2)} ms` : undefined,
        typeof profile.buildStartMs === 'number' ? `build-start ${profile.buildStartMs.toFixed(2)} ms` : undefined,
        typeof profile.bundlerMs === 'number' ? `bundler ${profile.bundlerMs.toFixed(2)} ms` : undefined,
        typeof profile.renderStartMs === 'number' ? `render-start ${profile.renderStartMs.toFixed(2)} ms` : undefined,
        typeof profile.generateBundleMs === 'number' ? `generate ${profile.generateBundleMs.toFixed(2)} ms` : undefined,
        typeof profile.generateSharedMs === 'number' ? `generate-shared ${profile.generateSharedMs.toFixed(2)} ms` : undefined,
        typeof profile.generateRewriteMs === 'number' ? `generate-rewrite ${profile.generateRewriteMs.toFixed(2)} ms` : undefined,
        typeof profile.generateModuleGraphMs === 'number' ? `module-graph ${profile.generateModuleGraphMs.toFixed(2)} ms` : undefined,
        typeof profile.coreLoadMs === 'number' ? `core-load ${profile.coreLoadMs.toFixed(2)} ms` : undefined,
        typeof profile.entryLoadMs === 'number' ? `entry-load ${profile.entryLoadMs.toFixed(2)} ms` : undefined,
        typeof profile.requestGlobalsMs === 'number' ? `request-globals ${profile.requestGlobalsMs.toFixed(2)} ms` : undefined,
        typeof profile.weapiResolveMs === 'number' ? `weapi-resolve ${profile.weapiResolveMs.toFixed(2)} ms` : undefined,
        typeof profile.transformMs === 'number' ? `transform ${profile.transformMs.toFixed(2)} ms` : undefined,
        typeof profile.writeMs === 'number' ? `write ${profile.writeMs.toFixed(2)} ms` : undefined,
      ].filter((segment): segment is string => Boolean(segment))

      return conciseSegments.length
        ? `小程序已重新构建（${duration} ms，${conciseSegments.join('，')}）`
        : `小程序已重新构建（${duration} ms）`
    }

    const verboseSegments: string[] = []
    if (profile.buildCoreMs !== undefined) {
      verboseSegments.push(`build-core ${profile.buildCoreMs.toFixed(2)} ms`)
    }
    if (profile.transformMs !== undefined) {
      verboseSegments.push(`transform ${profile.transformMs.toFixed(2)} ms`)
    }
    if (profile.buildStartMs !== undefined) {
      verboseSegments.push(`build-start ${profile.buildStartMs.toFixed(2)} ms`)
    }
    if (profile.bundlerMs !== undefined) {
      verboseSegments.push(`bundler ${profile.bundlerMs.toFixed(2)} ms`)
    }
    if (profile.coreLoadMs !== undefined) {
      verboseSegments.push(`core-load ${profile.coreLoadMs.toFixed(2)} ms`)
    }
    if (profile.entryLoadMs !== undefined) {
      verboseSegments.push(`entry-load ${profile.entryLoadMs.toFixed(2)} ms`)
    }
    if (profile.requestGlobalsMs !== undefined) {
      verboseSegments.push(`request-globals ${profile.requestGlobalsMs.toFixed(2)} ms`)
    }
    if (profile.weapiResolveMs !== undefined) {
      verboseSegments.push(`weapi-resolve ${profile.weapiResolveMs.toFixed(2)} ms`)
    }
    if (profile.renderStartMs !== undefined) {
      verboseSegments.push(`render-start ${profile.renderStartMs.toFixed(2)} ms`)
    }
    if (profile.generateBundleMs !== undefined) {
      verboseSegments.push(`generate ${profile.generateBundleMs.toFixed(2)} ms`)
    }
    if (profile.generateSharedMs !== undefined) {
      verboseSegments.push(`generate-shared ${profile.generateSharedMs.toFixed(2)} ms`)
    }
    if (profile.generateRewriteMs !== undefined) {
      verboseSegments.push(`generate-rewrite ${profile.generateRewriteMs.toFixed(2)} ms`)
    }
    if (profile.generateModuleGraphMs !== undefined) {
      verboseSegments.push(`module-graph ${profile.generateModuleGraphMs.toFixed(2)} ms`)
    }
    if (profile.snapshotResolveMs !== undefined) {
      verboseSegments.push(`snapshot-resolve ${profile.snapshotResolveMs.toFixed(2)} ms`)
    }
    if (profile.snapshotBuildMs !== undefined) {
      verboseSegments.push(`snapshot-build ${profile.snapshotBuildMs.toFixed(2)} ms`)
    }
    if (profile.writeMs !== undefined) {
      verboseSegments.push(`write ${profile.writeMs.toFixed(2)} ms`)
    }
    if (profile.watchToDirtyMs !== undefined) {
      verboseSegments.push(`watch->dirty ${profile.watchToDirtyMs.toFixed(2)} ms`)
    }
    if (profile.emitMs !== undefined) {
      verboseSegments.push(`emit ${profile.emitMs.toFixed(2)} ms`)
    }
    if (profile.sharedChunkResolveMs !== undefined) {
      verboseSegments.push(`shared ${profile.sharedChunkResolveMs.toFixed(2)} ms`)
    }
    if (
      profile.loadCount !== undefined
      || profile.chunkEmitCount !== undefined
      || profile.skippedLoadedCount !== undefined
    ) {
      verboseSegments.push(`load/chunk/skip ${profile.loadCount ?? 0}/${profile.chunkEmitCount ?? 0}/${profile.skippedLoadedCount ?? 0}`)
    }
    if (
      profile.dirtyCount !== undefined
      || profile.pendingCount !== undefined
      || profile.emittedCount !== undefined
    ) {
      verboseSegments.push(`d/p/e ${profile.dirtyCount ?? 0}/${profile.pendingCount ?? 0}/${profile.emittedCount ?? 0}`)
    }
    const dirtyReason = formatReasonSummary(profile.dirtyReasonSummary)
    const pendingReason = formatReasonSummary(profile.pendingReasonSummary)
    if (dirtyReason || pendingReason) {
      verboseSegments.push(`cause ${dirtyReason ?? '-'} -> ${pendingReason ?? '-'}`)
    }

    return verboseSegments.length
      ? `小程序已重新构建（${duration} ms，${verboseSegments.join('，')}${formatHmrRecentSummary()}）`
      : `小程序已重新构建（${duration} ms）`
  }

  function formatHmrPhaseRegressionHint(
    currentProfile: NonNullable<MutableCompilerContext['runtimeState']>['build']['hmr']['recentProfiles'][number],
    previousProfiles: NonNullable<MutableCompilerContext['runtimeState']>['build']['hmr']['recentProfiles'],
  ) {
    const candidates: HmrPhaseRegressionCandidate[] = []
    const phasePriority: Record<HmrPhaseRegressionCandidate['label'], number> = {
      'emit': 0,
      'shared': 1,
      'write': 2,
      'build-start': 3,
      'transform': 4,
      'core-transform': 5,
      'wevu-transform': 6,
      'vue-transform': 7,
      'core-load': 8,
      'entry-load': 9,
      'request-globals': 10,
      'weapi-resolve': 11,
      'render-start': 12,
      'generate': 13,
      'generate-shared': 14,
      'generate-rewrite': 15,
      'module-graph': 16,
      'watch->dirty': 17,
      'build-core': 18,
    }
    const phases = [
      {
        key: 'buildCoreMs',
        label: 'build-core',
      },
      {
        key: 'transformMs',
        label: 'transform',
      },
      {
        key: 'buildStartMs',
        label: 'build-start',
      },
      {
        key: 'coreTransformMs',
        label: 'core-transform',
      },
      {
        key: 'wevuTransformMs',
        label: 'wevu-transform',
      },
      {
        key: 'vueTransformMs',
        label: 'vue-transform',
      },
      {
        key: 'coreLoadMs',
        label: 'core-load',
      },
      {
        key: 'entryLoadMs',
        label: 'entry-load',
      },
      {
        key: 'requestGlobalsMs',
        label: 'request-globals',
      },
      {
        key: 'weapiResolveMs',
        label: 'weapi-resolve',
      },
      {
        key: 'renderStartMs',
        label: 'render-start',
      },
      {
        key: 'generateBundleMs',
        label: 'generate',
      },
      {
        key: 'generateSharedMs',
        label: 'generate-shared',
      },
      {
        key: 'generateRewriteMs',
        label: 'generate-rewrite',
      },
      {
        key: 'generateModuleGraphMs',
        label: 'module-graph',
      },
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
      {
        key: 'writeMs',
        label: 'write',
      },
    ] as const

    for (const phase of phases) {
      const currentValue = currentProfile[phase.key]
      if (currentValue === undefined || currentValue < 5) {
        continue
      }
      const previousValues = previousProfiles.flatMap<number>((item) => {
        const value = item[phase.key]
        return value === undefined ? [] : [value]
      })
      if (!previousValues.length) {
        continue
      }
      const averageMs = previousValues.reduce<number>((sum, value) => sum + value, 0) / previousValues.length
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
      .sort((left, right) => {
        return right.ratio - left.ratio
          || right.currentMs - left.currentMs
          || phasePriority[left.label] - phasePriority[right.label]
      })[0]

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

    const currentProfile = recentProfiles[recentProfiles.length - 1]
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

  function attachSidecarWatcherToWatcherClose(options: {
    watcher: RolldownWatcher
    watcherRoot: string
    sidecarRoot: string
    waitForPendingSnapshotBuilds: () => Promise<unknown>
    markClosed: () => void
  }) {
    const { watcher, watcherRoot, sidecarRoot, waitForPendingSnapshotBuilds, markClosed } = options
    const originalClose = watcher.close.bind(watcher)
    let closePromise: Promise<void> | undefined

    watcher.close = () => {
      if (!closePromise) {
        closePromise = (async () => {
          markClosed()
          await waitForPendingSnapshotBuilds().catch(() => {})
          const sidecarWatcher = watcherService.sidecarWatcherMap.get(sidecarRoot)
          if (sidecarWatcher) {
            watcherService.sidecarWatcherMap.delete(sidecarRoot)
            await Promise.resolve(sidecarWatcher.close()).catch(() => {})
          }
          watcherService.rollupWatcherMap.delete(watcherRoot)
          await originalClose()
        })()
      }
      return closePromise
    }
  }
  const buildState = ctx.runtimeState.build
  const { queue } = buildState
  const requestedConfigRestartBuilds = new Set<BuildTarget>()
  let autoTouchResolved = false
  let autoTouchChecked = false

  const {
    buildIndependentBundle,
    getIndependentOutput,
    invalidateIndependentOutput,
  } = createIndependentBuilder(configService, buildState)

  function shouldTouchAppWxss() {
    const dirtyReasonSummary = ctx.runtimeState.build.hmr.profile.dirtyReasonSummary
    if (
      dirtyReasonSummary?.length
      && !dirtyReasonSummary.some(reason =>
        reason.startsWith('style-sidecar:')
        || reason.startsWith('css-importer:')
        || reason.startsWith('entry-style-only:'),
      )
    ) {
      return false
    }
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

  function isDevOutputFile(filePath: string) {
    const normalizedOutDir = normalizeFsResolvedId(configService.outDir)
    const normalizedFile = normalizeFsResolvedId(filePath)
    return normalizedFile === normalizedOutDir || normalizedFile.startsWith(`${normalizedOutDir}/`)
  }

  function shouldRestartDevBuild(target: BuildTarget) {
    if (!configService.isDev) {
      return false
    }
    return requestedConfigRestartBuilds.delete(target)
  }

  function resetRuntimeStateForConfigRestart() {
    const fresh = createRuntimeState()

    const autoRoutes = ctx.runtimeState.autoRoutes
    autoRoutes.routes = fresh.autoRoutes.routes
    autoRoutes.serialized = fresh.autoRoutes.serialized
    autoRoutes.moduleCode = fresh.autoRoutes.moduleCode
    autoRoutes.typedDefinition = fresh.autoRoutes.typedDefinition
    autoRoutes.watchFiles.clear()
    autoRoutes.watchDirs.clear()
    autoRoutes.dirty = fresh.autoRoutes.dirty
    autoRoutes.initialized = fresh.autoRoutes.initialized
    autoRoutes.candidates.clear()
    autoRoutes.needsFullRescan = fresh.autoRoutes.needsFullRescan
    autoRoutes.loadingAppConfig = fresh.autoRoutes.loadingAppConfig

    const autoImport = ctx.runtimeState.autoImport
    autoImport.registry.clear()
    autoImport.resolvedResolverComponents.clear()
    autoImport.matcher = undefined
    autoImport.matcherKey = fresh.autoImport.matcherKey
    autoImport.version += 1
    autoImport.pendingEntriesByImporter.clear()

    ctx.runtimeState.build.hmr = fresh.build.hmr

    const json = ctx.runtimeState.json
    json.cache.cache.clear()
    json.cache.mtimeMap.clear()
    json.cache.signatureMap.clear()
    json.emittedSource.clear()

    const asset = ctx.runtimeState.asset
    asset.emittedBuffer.clear()
    asset.scopedSlotGenerics.clear()

    const css = ctx.runtimeState.css
    css.importerToDependencies.clear()
    css.dependencyToImporters.clear()
    css.emittedSource.clear()

    const wxml = ctx.runtimeState.wxml
    wxml.depsMap.clear()
    wxml.importerMap.clear()
    wxml.tokenMap.clear()
    wxml.componentsMap.clear()
    wxml.aggregatedComponentsMap.clear()
    wxml.templatePathMap.clear()
    wxml.cache.cache.clear()
    wxml.cache.mtimeMap.clear()
    wxml.cache.signatureMap.clear()
    wxml.emittedCode.clear()

    const scan = ctx.runtimeState.scan
    scan.subPackageMap.clear()
    scan.independentSubPackageMap.clear()
    scan.warnedMessages.clear()
    scan.appEntry = undefined
    scan.pluginJson = undefined
    scan.pluginJsonPath = undefined
    scan.isDirty = fresh.scan.isDirty
    scan.independentDirtyRoots.clear()

    const lib = ctx.runtimeState.lib
    lib.enabled = fresh.lib.enabled
    lib.entries.clear()
  }

  async function runDev(target: BuildTarget) {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }
    debug?.(`[${target}] dev build watcher start`)
    const { hasWorkersDir, workersDir } = checkWorkersOptions(target, configService, scanService)
    // eslint-disable-next-line ts/no-use-before-define
    const buildOptions = appendHmrMetricsPlugin(applyTargetBuildOverride(
      configService.merge(
        undefined,
        createSharedBuildConfig(configService, scanService),
        // eslint-disable-next-line ts/no-use-before-define
        resolveTargetBuildOverride(target),
      ),
      target,
    ))
    buildOptions.build = {
      ...(buildOptions.build ?? {}),
      write: true,
    }
    const snapshotBuildOptions: InlineConfig = {
      ...buildOptions,
      build: {
        ...(buildOptions.build ?? {}),
      },
    }
    delete snapshotBuildOptions.build?.watch
    const snapshotWatcherRoot = `${configService.absoluteSrcRoot}::dev-snapshot`
    let snapshotBuildChain: Promise<'snapshot' | 'closed' | undefined> = Promise.resolve(undefined)
    let devWatcherClosed = false
    let pendingSnapshotBatch: SnapshotBuildBatch | undefined
    let snapshotBatchTimer: ReturnType<typeof setTimeout> | undefined

    async function resolveSnapshotSidecarEntryId(reason?: SnapshotBuildReason) {
      if (reason?.event !== 'update' || !reason.file) {
        return undefined
      }
      const normalizedFile = normalizeFsResolvedId(reason.file)
      const configSuffix = configSuffixes.find(suffix => normalizedFile.endsWith(suffix))
      const ext = path.extname(normalizedFile)
      if (!configSuffix && !(ext && (watchedCssExts.has(ext) || watchedTemplateExts.has(ext)))) {
        return undefined
      }
      const basePath = configSuffix
        ? normalizedFile.slice(0, -configSuffix.length)
        : ext
          ? normalizedFile.slice(0, -ext.length)
          : normalizedFile
      const primaryScript = await findJsEntry(basePath)
      if (!primaryScript.path) {
        return undefined
      }
      const entryId = normalizeFsResolvedId(primaryScript.path)
      if (!ctx.runtimeState.build.hmr.resolvedEntryMap.has(entryId)) {
        return undefined
      }
      const relativeSrc = configService.relativeAbsoluteSrcRoot(entryId)
      if (isLayoutSourcePath(relativeSrc)) {
        return undefined
      }
      return entryId
    }

    function markSnapshotEntriesFullDirty() {
      for (const entryId of ctx.runtimeState.build.hmr.resolvedEntryMap.keys()) {
        ctx.runtimeState.build.hmr.dirtyEntrySet.add(entryId)
        ctx.runtimeState.build.hmr.dirtyEntryReasons.set(entryId, 'direct')
        ctx.runtimeState.build.hmr.loadedEntrySet.delete(entryId)
      }
      ctx.runtimeState.build.hmr.profile = {
        ...ctx.runtimeState.build.hmr.profile,
        dirtyCount: ctx.runtimeState.build.hmr.dirtyEntrySet.size,
        dirtyReasonSummary: [`snapshot-full:${ctx.runtimeState.build.hmr.resolvedEntryMap.size}`],
      }
    }

    function markSnapshotEntryDirty(entryId: string, reason?: SnapshotBuildReason) {
      ctx.runtimeState.build.hmr.dirtyEntrySet.add(entryId)
      ctx.runtimeState.build.hmr.dirtyEntryReasons.set(entryId, 'metadata')
      ctx.runtimeState.build.hmr.loadedEntrySet.delete(entryId)
      ctx.runtimeState.build.hmr.profile = {
        ...ctx.runtimeState.build.hmr.profile,
        dirtyCount: ctx.runtimeState.build.hmr.dirtyEntrySet.size,
        dirtyReasonSummary: reason?.file
          ? [resolveSnapshotSidecarDirtySummary(reason.file)]
          : ['sidecar-direct:1'],
      }
    }

    const runSnapshotBuild = (reason?: SnapshotBuildReason) => {
      if (devWatcherClosed) {
        return snapshotBuildChain
      }
      const startedAt = reason ? performance.now() : 0
      snapshotBuildChain = snapshotBuildChain.then(async () => {
        if (devWatcherClosed) {
          return
        }
        if (reason?.event || reason?.file) {
          if (reason.file) {
            invalidateFileCache(reason.file)
          }
          ctx.runtimeState.build.hmr.profile = {
            ...ctx.runtimeState.build.hmr.profile,
            eventId: createHmrProfileEventId(),
            event: reason.event,
            file: reason.file,
            watchToDirtyMs: performance.now() - startedAt,
          }
        }
        const snapshotResolveStartedAt = performance.now()
        const sidecarEntryId = await resolveSnapshotSidecarEntryId(reason)
        recordHmrProfileDuration(ctx.runtimeState.build.hmr.profile, 'snapshotResolveMs', performance.now() - snapshotResolveStartedAt)
        const snapshotBuildStartedAt = performance.now()
        if (sidecarEntryId) {
          markSnapshotEntryDirty(sidecarEntryId, reason)
          try {
            await build(snapshotBuildOptions)
          }
          finally {
            recordHmrProfileDuration(ctx.runtimeState.build.hmr.profile, 'snapshotBuildMs', performance.now() - snapshotBuildStartedAt)
          }
          return 'snapshot'
        }
        markSnapshotEntriesFullDirty()
        process.env.WEAPP_VITE_FORCE_FULL_HMR_SHARED_CHUNKS = '1'
        try {
          await build(snapshotBuildOptions)
          return 'snapshot'
        }
        finally {
          recordHmrProfileDuration(ctx.runtimeState.build.hmr.profile, 'snapshotBuildMs', performance.now() - snapshotBuildStartedAt)
          delete process.env.WEAPP_VITE_FORCE_FULL_HMR_SHARED_CHUNKS
        }
      })
      return snapshotBuildChain
    }

    function resolveSnapshotBatchReason(batch: SnapshotBuildBatch) {
      const [firstReason] = batch.reasons
      if (!firstReason) {
        return undefined
      }
      if (batch.reasons.length === 1) {
        return firstReason
      }
      const isSameReason = batch.reasons.every((reason) => {
        return reason.event === firstReason.event && reason.file === firstReason.file
      })
      return isSameReason ? firstReason : undefined
    }

    function scheduleSnapshotBuild(reason: SnapshotBuildReason, startedAt: number) {
      if (devWatcherClosed) {
        return
      }
      if (pendingSnapshotBatch) {
        pendingSnapshotBatch.reasons.push(reason)
        pendingSnapshotBatch.startedAt = Math.min(pendingSnapshotBatch.startedAt, startedAt)
      }
      else {
        pendingSnapshotBatch = {
          reasons: [reason],
          startedAt,
        }
      }
      if (snapshotBatchTimer) {
        return
      }
      snapshotBatchTimer = setTimeout(() => {
        snapshotBatchTimer = undefined
        const batch = pendingSnapshotBatch
        pendingSnapshotBatch = undefined
        if (!batch || devWatcherClosed) {
          return
        }
        const batchReason = resolveSnapshotBatchReason(batch)
        void runSnapshotBuild(batchReason).then((result) => {
          if (result !== 'snapshot') {
            return
          }
          const durationMs = performance.now() - batch.startedAt
          finalizeHmrProfile(durationMs)
          recordHmrProfile(durationMs)
          logger.success(formatHmrLogLine(durationMs))
          resetHmrProfile()
        }).catch((error) => {
          resetHmrProfile()
          logger.error(error)
        })
      }, SNAPSHOT_BUILD_BATCH_DELAY_MS)
    }

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
      if (devWatcherClosed) {
        return
      }
      if (e.code === 'START') {
        startTime = performance.now()
      }
      else if (e.code === 'END') {
        const durationMs = performance.now() - startTime
        recordHmrProfileDuration(ctx.runtimeState.build.hmr.profile, 'bundlerMs', durationMs)
        void (async () => {
          const shouldRestart = shouldRestartDevBuild(target)
          if (shouldRestart) {
            await watcher.close()
            logger.info('检测到 Vite 配置变更，正在重启小程序开发构建...')
            resetRuntimeStateForConfigRestart()
            await configService.load(configService.loadOptions)
            try {
              const supportFiles = await syncProjectSupportFiles(ctx)
              for (const warning of supportFiles.managedTsconfigWarnings) {
                logger.warn(warning)
              }
            }
            catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              logger.warn(`[prepare] 自动同步 .weapp-vite 支持文件失败：${message}`)
            }
            await scanService.loadAppEntry()
            scanService.loadSubPackages()
            await runDev(target)
            logger.success('Vite 配置已重新加载，小程序开发构建已重启。')
            resolveWatcher(e)
            return
          }

          if (firstBuildCompleted) {
            finalizeHmrProfile(durationMs)
            recordHmrProfile(durationMs)
            await writeHmrProfileJsonSample(durationMs).catch((error) => {
              debug?.(`write hmr profile json failed: ${String(error)}`)
            })
            logger.success(formatHmrLogLine(durationMs))
            shouldLogSlowHmrTip()
            if (appWxssPath && shouldTouchAppWxss()) {
              void touch(appWxssPath).catch(() => {})
            }
          }
          else {
            firstBuildCompleted = true
          }
          resetHmrProfile()
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
    if (target === 'app' && !watcherService.sidecarWatcherMap.has(snapshotWatcherRoot)) {
      const snapshotWatcher = chokidar.watch(
        createSnapshotSidecarWatchPatterns(configService, buildOptions),
        createSidecarWatchOptions(configService, {
          persistent: true,
          ignoreInitial: true,
          ignored: createSnapshotSidecarIgnoredMatcher(ctx),
        }),
      )
      snapshotWatcher.on('all', (event, id) => {
        if (!id) {
          return
        }
        if (isDevOutputFile(id)) {
          return
        }
        if (!shouldHandleSnapshotSidecarFile(id, ctx)) {
          return
        }
        const sidecarStartedAt = performance.now()
        const normalizedEvent = event.startsWith('unlink')
          ? 'delete'
          : event.startsWith('add')
            ? 'create'
            : 'update'
        scheduleSnapshotBuild({
          event: normalizedEvent,
          file: id,
        }, sidecarStartedAt)
      })
      watcherService.sidecarWatcherMap.set(snapshotWatcherRoot, {
        close: () => snapshotWatcher.close(),
      })
      attachSidecarWatcherToWatcherClose({
        watcher,
        watcherRoot,
        sidecarRoot: snapshotWatcherRoot,
        waitForPendingSnapshotBuilds: () => snapshotBuildChain,
        markClosed: () => {
          devWatcherClosed = true
        },
      })
    }
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
      requestedConfigRestartBuilds.delete(target)
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
    const projectConfigSyncTask = !isLibMode && !pluginOnly
      ? syncProjectConfigToOutput({
          outDir: configService.outDir,
          projectConfigPath: configService.projectConfigPath,
          projectPrivateConfigPath: configService.projectPrivateConfigPath,
          enabled: isMultiPlatformEnabled,
        })
      : Promise.resolve()
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
    await projectConfigSyncTask
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
    requestConfigRestart(target: BuildTarget = 'app') {
      requestedConfigRestartBuilds.add(target)
    },
    buildIndependentBundle,
    getIndependentOutput,
    invalidateIndependentOutput,
  }
}
