import type { RolldownWatcher } from 'rolldown'
import type { InlineConfig, ViteDevServer } from 'vite'
/* eslint-disable ts/no-use-before-define */

import type { CompilerContext, MutableCompilerContext } from '../../context'
import type { HmrProfileSourceEvent } from '../../utils/hmrProfile/provenance'
import type { DevBuildWatcherController } from '../buildPlugin/devBuildWatcher'
import type { HmrRuntimeFallbackReason } from '../hmrRuntimeCapabilities'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrOutputSource } from './outputPublication'
import type { StatefulHmrInitialPublicAssets, StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrProfileBatch, StatefulHmrProfileHandoff } from './profile'
import type { StatefulHmrSnapshotHandoff } from './snapshotHandoff'
import type { StatefulHmrDevEngineBatch, StatefulHmrDevEngineUpdate } from './viteAdapter'
import { Buffer } from 'node:buffer'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { HmrAssetStore } from '@weapp-vite/hmr'
import path from 'pathe'
import { isNativeScriptAnalysisOwner, refreshGlassEaselNativeScripts } from '../../analyze/glassEasel/nativeScripts'
import { isGlassEaselDetected } from '../../analyze/glassEasel/state'
import { logger } from '../../context/shared'
import { createDevViteServer } from '../../devLifecycle/vite'
import { parseSidecarModuleId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { createPublicAssetSourcePlan } from '../../plugins/asset/publicSources'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { ENTRY_GRAPH_CHANGE_REASON } from '../../plugins/hooks/useLoadEntry/entryChunkLifecycle'
import { prepareOutputOwnership } from '../../plugins/outputFinalizer/ownership'
import { isReactHmrTemplateSource, resolveReactTemplateHmrCapability } from '../../plugins/react/hmr'
import { setTailwindStyleOwners } from '../../plugins/tailwindcss/styleOwners'
import { readCompilerInputSync } from '../../plugins/utils/sourceSnapshot'
import { resolveOutputExtensions } from '../../utils/outputExtensions'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { bindHostLifecycle } from '../../vite/lifecycle'
import { isWxmlDependency } from '../../wxml/processing/dependencies'
import { subscribeAutoRoutesTopology } from '../autoRoutesPlugin/topology'
import { resolveIdePrivateConfigPath } from '../classicIdeConfig'
import { getHmrRuntimeCapabilityFallback, HmrRuntimeCapabilityError, resolveStatefulHmrInputFallback } from '../hmrRuntimeCapabilities'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { watchAssetSources } from '../watch/assets'
import { createViteWatchIgnored, resolvePollingWatchOptions } from '../watch/options'
import { installIdeAssetWatch } from './assetWatch'
import { observeChildSources } from './childSources'
import { compileHmrBatch } from './compileBatch'
import { HmrDeliveryCoordinator } from './deliveryCoordinator'
import { StatefulHmrDirectoryUpdates } from './directoryUpdates'
import { createStatefulHmrGlobalStyleAssets, mergeStatefulHmrCompilerAssets } from './globalStyles'
import { createStatefulHmrHostPlugins, getStatefulHmrHost } from './hostPlugins'
import { registerStatefulHmrInitialChunkLoaders } from './initialChunkLoaders'
import { isChangedNativeComponentSidecar } from './nativeComponentSidecar'
import { protectStatefulHmrNativeEntries } from './nativeEntryContract'
import { NativeScriptInputs } from './nativeScriptInputs'
import { StatefulHmrOutputCapabilities } from './outputCapabilities'
import { isStatefulHmrSnapshotAsset, selectStatefulHmrAdditionalOutput } from './outputOwnership'
import { transformStatefulHmrOutput } from './outputTransform'
import { writeStatefulHmrOutput } from './outputWriter'
import { readMappedHmrCode, wrapHmrCode } from './patchPreparation'
import { createStatefulHmrProfile } from './profile'
import { shouldResetStatefulHmrRetention } from './retention'
import { createStatefulHmrControlSource } from './runtimeSource'
import { createStatefulHmrSnapshotDiagnostics } from './snapshotDiagnostics'
import { offerStatefulHmrSnapshot } from './snapshotHandoff'
import { withStatefulHmrSnapshotPreparation } from './snapshotPreparation'
import { StatefulHmrSnapshotScheduler } from './snapshotScheduler'
import { resolveTemplateRegistrationFallback } from './templateRegistration'
import { StatefulHmrTransport } from './transport'
import { StatefulHmrViteAdapter } from './viteAdapter'

export { isStatefulHmrBoundary } from './boundaries'

export { redirectNativeComponentRegistration } from './hostPlugins'
export { shouldResetStatefulHmrRetention } from './retention'

interface StatefulHmrSnapshots {
  entryIds: Iterable<string>
  delegatedComponentEntryIds?: Iterable<string>
  initial: StatefulHmrSnapshot
  profile?: StatefulHmrProfileHandoff
  rebuild: (files: string[], sources?: ReadonlyMap<string, string | null>) => Promise<StatefulHmrSnapshot>
}

const classicHandoffs = new WeakMap<object, () => void>()

/** 仅将精确旧代的下一次关闭标记为 classic 交接；已开始的 terminal close 不接受接管。 */
export function prepareStatefulClassicHandoff(ctx: object): void {
  classicHandoffs.get(ctx)?.()
}

interface ActiveSnapshotBatch {
  fullOutputCommitted?: boolean
  traceBatchId?: number
  isSuperseded: () => boolean
  outputTasks: Promise<void>[]
  snapshot: StatefulHmrSnapshot
}

/**
 * DevEngine 在创建时就会校验 experimental.devMode 的输出格式。
 * Vite 的共享构建配置默认使用小程序宿主需要的 CJS，必须在创建 bundled-dev
 * server 之前切换为 ESM；适配器后续仍会重复校验并强制保持该格式。
 */
function withStatefulHmrOutputFormat(buildOptions: InlineConfig): InlineConfig {
  const rolldownOptions = buildOptions.build?.rolldownOptions
  const configuredOutput = rolldownOptions?.output
  const output = Array.isArray(configuredOutput)
    ? configuredOutput.map(item => ({ ...item, format: 'esm' as const }))
    : { ...(configuredOutput ?? {}), format: 'esm' as const }
  return {
    ...buildOptions,
    build: {
      ...(buildOptions.build ?? {}),
      rolldownOptions: {
        ...(rolldownOptions ?? {}),
        output,
      },
    },
  }
}

export async function runStatefulHmrDev(
  ctx: MutableCompilerContext,
  buildOptions: InlineConfig,
  restart: () => Promise<void>,
  snapshots: StatefulHmrSnapshots,
  buildEvents: DevBuildWatcherController,
): Promise<RolldownWatcher> {
  // 此入口只在构建服务完成上下文初始化后调用。
  const compilerContext = ctx as CompilerContext
  const configService = ctx.configService!
  if (configService.platform !== 'weapp') {
    throw new HmrRuntimeCapabilityError({ code: 'platform', message: 'weapp.hmr.runtime="stateful-experimental" 目前仅支持微信小程序平台。' })
  }
  if (!getCompilerHmrHost(compilerContext).supported) {
    throw new HmrRuntimeCapabilityError({ code: 'compiler-provider', message: '编译 provider 不支持事务式状态保持更新。' })
  }
  let session: StatefulHmrSession | undefined
  let standaloneLifecycleBound = false
  let cleanupStatus: 'incomplete' | 'failed' = 'incomplete'
  const entryIds = new Set(Array.from(snapshots.entryIds, id => normalizeFsResolvedId(id)))
  const delegatedComponentEntryIds = new Set(Array.from(snapshots.delegatedComponentEntryIds ?? [], id => normalizeFsResolvedId(id)))
  const pollingWatchOptions = resolvePollingWatchOptions(configService)
  const host = getStatefulHmrHost(compilerContext)
  const controller = host?.controller ?? createStatefulHmrHostPlugins(compilerContext)
  controller.setInputs(entryIds, delegatedComponentEntryIds)
  const statefulBuildOptions = withStatefulHmrOutputFormat(buildOptions)
  const server = host?.server ?? await createDevViteServer({
    ...statefulBuildOptions,
    root: buildOptions.root ?? configService.cwd,
    appType: 'custom',
    configFile: false,
    define: {
      ...(buildOptions.define ?? {}),
      App: `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].App`,
      Page: `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].Page`,
    },
    experimental: {
      ...(buildOptions.experimental ?? {}),
      bundledDev: true,
    },
    plugins: [...controller.plugins, ...(buildOptions.plugins ?? [])],
    server: {
      ...(buildOptions.server ?? {}),
      hmr: false,
      host: '127.0.0.1',
      port: 0,
      watch: {
        ...(buildOptions.server?.watch ?? {}),
        ...Object.fromEntries(Object.entries(pollingWatchOptions).filter(([, value]) => value !== undefined)),
        ignored: createViteWatchIgnored(
          buildOptions.root ?? configService.cwd,
          configService.outDir,
          buildOptions.server?.watch?.ignored,
        ),
      },
    },
    build: {
      ...(statefulBuildOptions.build ?? {}),
      watch: undefined,
      write: false,
    },
  })
  try {
    session = new StatefulHmrSession(compilerContext, server, host ? () => host.server.restart() : restart, entryIds, snapshots, {
      compareContentsForPolling: pollingWatchOptions.usePolling === true ? true : undefined,
      pollInterval: pollingWatchOptions.interval,
      usePolling: pollingWatchOptions.usePolling,
    }, delegatedComponentEntryIds, buildEvents)
    const activeSession = session
    classicHandoffs.set(ctx, () => activeSession.prepareClassicHandoff())
    session.releaseSettlement = controller.bindSettlement(() => activeSession.whenSettled())
    if (!host) {
      const active = session
      bindHostLifecycle(server, () => active.close(cleanupStatus))
      standaloneLifecycleBound = true
    }
    await session.prepareIdeAssetWatch()
    session.install(controller)
    if (host) {
      await session.startEngine()
    }
    else {
      await server.listen()
    }
    await session.watchAssets()
    if (host) {
      const active = session
      host.refreshControl = () => active.refreshControl()
    }
    await session.refreshControl()
    return createWatcherAdapter(server, session, buildEvents, Boolean(host))
  }
  catch (error) {
    cleanupStatus = 'failed'
    const failures: unknown[] = [error]
    if (!standaloneLifecycleBound) {
      try {
        await session?.close('failed')
      }
      catch (cleanupError) {
        failures.push(cleanupError)
      }
    }
    if (!host) {
      try {
        await server.close()
      }
      catch (cleanupError) {
        failures.push(cleanupError)
      }
    }
    throw failures.length === 1 ? error : new AggregateError(failures, 'Stateful HMR startup and cleanup failed', { cause: error })
  }
}

class StatefulHmrSession {
  releaseSettlement?: () => void
  private releaseSidecarInputDrift?: () => void
  private releaseAutoRoutesTopology?: () => void
  private settlementRevision = 0
  private restarting = false
  private readonly settlementObservers = new Set<() => void>()
  private readonly publicAssetSources: ReturnType<typeof createPublicAssetSourcePlan>
  private childSources?: ReturnType<typeof observeChildSources>
  private assetWatcher?: ReturnType<typeof watchAssetSources>
  private restoreIdeAssetWatch?: Awaited<ReturnType<typeof installIdeAssetWatch>>
  private classicHandoff = false
  private activeSnapshotBatch?: ActiveSnapshotBatch
  private readonly adapter: StatefulHmrViteAdapter
  private readonly delivery: HmrDeliveryCoordinator
  private resynchronizing = false
  private closed = false
  private closing?: Promise<void>
  private fallbackCause?: { error: unknown }
  private fallbackSnapshotClose?: Promise<void>
  private readonly initialBundle = Promise.withResolvers<void>()
  private readonly snapshotScheduler: StatefulHmrSnapshotScheduler
  private readonly diagnostics: ReturnType<typeof createStatefulHmrSnapshotDiagnostics>
  private readonly profile: ReturnType<typeof createStatefulHmrProfile>
  private initialProfile?: StatefulHmrProfileBatch
  private readonly transport: StatefulHmrTransport
  private outputChain: Promise<void> = Promise.resolve()
  private readonly retiringOutputFailures = new Set<unknown>()
  private restartTimer?: ReturnType<typeof setTimeout>
  private restartHandoff?: StatefulHmrSnapshotHandoff
  private readonly snapshotAssets = new HmrAssetStore<Extract<StatefulHmrOutputFile, { type: 'asset' }>>()
  private readonly outputCapabilities: StatefulHmrOutputCapabilities
  private componentPageGlobalStyleRoutes: string[] = []
  private templateRegistrationSignatures?: StatefulHmrSnapshot['templateRegistrationSignatures']
  private initialSnapshot?: StatefulHmrSnapshot
  private readonly emittedSourceIds: Set<string>
  private readonly nativeVueBaselines = new Set<string>()
  private readonly directoryUpdates: StatefulHmrDirectoryUpdates
  private entryGraphRevision = 0
  private rebuiltEntryGraphRevision = 0
  // 分类由实际源事件持有，避免其他侧车事件覆盖全局诊断信息后误判当前批次。
  private readonly sourceDirtyReasons = new Map<string, { reasons: string[] }>()
  // 原生脚本 patch 只写 delta；独立资产刷新前仍需将这些源码交给完整构建持久化。
  private readonly unpersistedNativeScripts = new Map<string, object>()
  private readonly nativeScriptInputs = new NativeScriptInputs()
  private readonly sourceChangeListener = (file: string, dirtyReasonSummary: string[], sourceEvent?: HmrProfileSourceEvent) => {
    this.handleSourceUpdate(file, dirtyReasonSummary, sourceEvent)
  }

  constructor(
    private readonly ctx: CompilerContext,
    private readonly server: ViteDevServer,
    private readonly restart: () => Promise<void>,
    private readonly entryIds: Set<string>,
    private readonly snapshots: StatefulHmrSnapshots,
    devWatchOptions: { compareContentsForPolling?: boolean, pollInterval?: number, usePolling?: boolean },
    private readonly delegatedComponentEntryIds: Set<string>,
    private readonly buildEvents: DevBuildWatcherController,
  ) {
    // DevEngine 可能先交付失败输出、随后才等待首轮就绪；保留拒绝结果但提前订阅。
    void this.initialBundle.promise.catch(() => {})
    this.publicAssetSources = createPublicAssetSourcePlan({
      publicDir: server.config.publicDir,
      copyPublicDir: server.config.build.copyPublicDir,
    }, ctx.configService.outDir)
    this.diagnostics = createStatefulHmrSnapshotDiagnostics({ root: server.config.root, outDir: ctx.configService!.outDir })
    this.profile = createStatefulHmrProfile({ root: server.config.root, option: ctx.configService.weappViteConfig.hmr?.profileJson, buildId: () => this.transport.createControl().buildId, onError: error => logger.error('[weapp-vite] HMR profile write failed', error) })
    this.directoryUpdates = new StatefulHmrDirectoryUpdates(server.config.root)
    this.emittedSourceIds = collectStatefulHmrEmittedSourceIds(snapshots.initial.output, server.config.root)
    this.directoryUpdates.seedSources([...this.entryIds, ...this.emittedSourceIds])
    this.initialSnapshot = snapshots.initial
    this.outputCapabilities = new StatefulHmrOutputCapabilities(resolveOutputExtensions(ctx.configService?.outputExtensions).styleExtension)
    setTailwindStyleOwners(ctx, snapshots.initial.tailwindStyleOwners)
    this.transport = new StatefulHmrTransport(
      server,
      async (buildId, source) => {
        await this.enqueueOutput(async () => {
          if (!this.transport.isCurrentBuild(buildId)) {
            throw new Error('Stateful HMR payload belongs to a retired build')
          }
          await this.writeOutput('delta', [{
            type: 'asset',
            fileName: WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
            source,
          }])
        })
      },
      () => this.requestFullBuild(),
      reason => this.requestClassic(reason),
      (error) => {
        this.buildEvents.emitEvent({ code: 'ERROR', error, result: undefined as never })
      },
    )
    this.delivery = new HmrDeliveryCoordinator((error) => {
      // freeze 已推进比较输入；失败交付不能继续作为已发布视觉基线的证明。
      this.nativeVueBaselines.clear()
      const fallback = getHmrRuntimeCapabilityFallback(error)
      if (fallback) {
        this.requestClassic(fallback, error)
        return
      }
      if (error instanceof CompilerHmrResyncError) {
        logger.info(`[weapp-vite] stateful HMR 正在完整重同步：${error.message}`)
        this.requestFullBuild(error.files)
        return
      }
      logger.error('[weapp-vite] stateful HMR delivery failed', error)
      this.buildEvents.emitEvent({ code: 'ERROR', error: error instanceof Error ? error : new Error(String(error)), result: undefined as never })
    }, () => this.requestFullBuild())
    this.adapter = new StatefulHmrViteAdapter(server.config, server, {
      onError: message => logger.error(`[weapp-vite] stateful HMR: ${message}`),
      onNativeError: () => this.profile?.recordNativeFailure(),
      onOutput: (output, source) => this.handleOutput(output, source),
      onBatch: batch => this.handleBatch(batch),
      onPatch: (files, output) => this.handleBatch({ changedFiles: files, updates: [{ clientId: 'weapp-vite-stateful-hmr', update: output }] }),
      waitForInitialBundle: () => this.waitForInitialBundle(),
    }, devWatchOptions)
    this.snapshotScheduler = new StatefulHmrSnapshotScheduler({
      execute: batch => this.profileSnapshotBatch(batch),
      onError: (error) => {
        this.nativeVueBaselines.clear()
        const fallback = getHmrRuntimeCapabilityFallback(error)
        if (fallback) {
          this.requestClassic(fallback, error)
          return
        }
        if (error instanceof CompilerHmrResyncError) {
          this.server.config.logger.info(`[weapp-vite] stateful HMR 正在完整重同步：${error.message}`)
          this.requestFullBuild(error.files)
          return
        }
        const failure = error instanceof Error ? error : new Error(String(error))
        this.buildEvents.emitEvent({ code: 'ERROR', error: failure, result: undefined as never })
        this.server.config.logger.error('[weapp-vite] stateful HMR snapshot refresh failed', { error: failure })
      },
    })
    this.initialProfile = snapshots.profile && this.profile?.adopt(snapshots.profile)
  }

  async prepareIdeAssetWatch(): Promise<void> {
    const config = this.ctx.configService
    const configPath = resolveIdePrivateConfigPath(config)
    if (!configPath) {
      return
    }
    this.restoreIdeAssetWatch = await installIdeAssetWatch({
      configPath,
      outDir: config.outDir,
      inheritedWatchOptions: config.projectConfig?.watchOptions,
      output: this.snapshots.initial.output,
    })
  }

  prepareClassicHandoff(): void {
    if (!this.closing) {
      this.classicHandoff = true
    }
  }

  install(controller: Pick<ReturnType<typeof createStatefulHmrHostPlugins>, 'bindSidecarInputDrift'>): void {
    this.childSources = observeChildSources(this.server, file => this.requestFullBuild([file]))
    this.childSources.adopt(this.initialSnapshot?.childSources)
    this.transport.install()
    this.adapter.install()
    this.releaseSidecarInputDrift = controller.bindSidecarInputDrift(file => this.requestFullBuild([file]))
    // 路由物理 watcher 统一持有目录拓扑；借用 Vite 宿主时不能依赖模拟 App change 推断入口变化。
    const initialAutoRoutesSignature = this.ctx.autoRoutesService?.getSignature()
    this.releaseAutoRoutesTopology = subscribeAutoRoutesTopology(this.ctx, (change) => {
      if (change.topologyChanged || this.ctx.autoRoutesService?.getSignature() !== initialAutoRoutesSignature) {
        this.requestClassic({
          code: 'entry-topology',
          message: '自动路由入口拓扑发生变化，需要重新建立完整构建图。',
          files: [...new Set((change.sourceChanges ?? [change]).map(source => normalizeFsResolvedId(source.file)))],
        })
      }
    })
    this.ctx.onStatefulHmrSourceChange = this.sourceChangeListener
    getCompilerHmrHost(this.ctx).onDependencyChange = (file) => {
      void this.waitForInitialBundle().then(async () => {
        await this.adapter.waitForNativeUpdates()
        if (!this.closed && !getCompilerHmrHost(this.ctx).isNativeSource(file)) {
          this.handleBatch({ changedFiles: [file], updates: [] })
        }
      }).catch(() => {})
    }
  }

  async startEngine(): Promise<void> {
    await this.adapter.start()
  }

  async watchAssets(): Promise<void> {
    this.assetWatcher = watchAssetSources(this.ctx.configService, {
      publicAssets: {
        publicDir: this.server.config.publicDir,
        copyPublicDir: this.server.config.build.copyPublicDir,
      },
      isModule: file => (this.server.moduleGraph.getModulesByFile(file)?.size ?? 0) > 0,
      onChange: (file, event) => {
        this.ctx.moduleGraphService.recordChangedFile(file, event)
        this.handleSourceUpdate(file)
      },
      onError: (error) => {
        this.buildEvents.emitEvent({ code: 'ERROR', error, result: undefined as never })
        this.server.config.logger.error('[weapp-vite] asset watcher failed', { error })
      },
    })
    await this.assetWatcher.ready
  }

  close(status: 'incomplete' | 'failed' = 'incomplete'): Promise<void> {
    const handoff = this.classicHandoff
    return this.closing ??= (async () => {
      const failures: unknown[] = []
      try {
        await this.closeResources(status, failures)
      }
      catch (error) {
        failures.push(error)
      }
      const restore = this.restoreIdeAssetWatch
      this.restoreIdeAssetWatch = undefined
      try {
        await restore?.(!failures.length && handoff ? getHmrRuntimeSession(this.ctx).classicIdeConfig : undefined)
      }
      catch (error) {
        failures.push(error)
      }
      if (failures.length) {
        throw failures.length === 1 ? failures[0] : new AggregateError(failures, 'Stateful HMR session cleanup failed', { cause: failures[0] })
      }
    })()
  }

  private async closeResources(status: 'incomplete' | 'failed', failures: unknown[]): Promise<void> {
    const release = async (action: () => unknown) => {
      try {
        await action()
      }
      catch (error) {
        failures.push(error)
      }
    }
    this.closed = true
    this.releaseSidecarInputDrift?.()
    this.releaseSidecarInputDrift = undefined
    this.releaseAutoRoutesTopology?.()
    this.releaseAutoRoutesTopology = undefined
    // 先同步封闭交付代次，再取消传输；等待必须留到传输解除未确认交付之后。
    const closeDelivery = release(() => this.delivery.close())
    // 同步封闭快照准入，异步等待留到传输关闭后，避免 pending prepare 抢先消费关闭中的会话。
    const closeSnapshots = release(() => this.fallbackSnapshotClose ?? this.snapshotScheduler.close())
    // 保持释放顺序，但某个资源失败不能跳过后续监听器、引擎或诊断的关闭。
    await release(() => this.initialProfile?.finish(status))
    this.initialProfile = undefined
    await release(() => this.interruptSettlement())
    await release(() => this.releaseSettlement?.())
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = undefined
    }
    await release(() => this.restartHandoff?.invalidate(status))
    this.restartHandoff = undefined
    await release(() => this.childSources?.close())
    await release(() => {
      getCompilerHmrHost(this.ctx).onDependencyChange = undefined
    })
    await release(() => this.assetWatcher?.close())
    if (this.ctx.onStatefulHmrSourceChange === this.sourceChangeListener) {
      this.ctx.onStatefulHmrSourceChange = undefined
    }
    await release(() => this.transport.close())
    await closeDelivery
    await closeSnapshots
    await release(() => this.adapter.close())
    this.sourceDirtyReasons.clear()
    this.unpersistedNativeScripts.clear()
    this.nativeScriptInputs.clear()
    await release(() => this.outputChain)
    for (const error of this.retiringOutputFailures) {
      if (!failures.includes(error)) {
        failures.push(error)
      }
    }
    await release(() => this.profile?.close(status))
  }

  async refreshControl(): Promise<void> {
    await this.enqueueOutput(async () => {
      await this.writeOutput('control', [{
        type: 'asset',
        fileName: WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
        source: createStatefulHmrControlSource(this.transport.createControl()),
      }])
    })
  }

  handleSourceUpdate(file: string, dirtyReasonSummary: string[] = [], sourceEvent?: HmrProfileSourceEvent): void {
    if (this.closed || this.restarting) {
      return
    }
    const normalizedFile = normalizeFsResolvedId(path.isAbsolute(file) ? file : path.resolve(this.server.config.root, file))
    this.diagnostics?.source(normalizedFile, dirtyReasonSummary)
    if (this.childSources?.owns(normalizedFile)) {
      return
    }
    const normalizedOutDir = normalizeFsResolvedId(this.ctx.configService!.outDir).replace(/\/$/, '')
    if (normalizedFile === normalizedOutDir || normalizedFile.startsWith(`${normalizedOutDir}/`)) {
      return
    }
    this.initialProfile?.finish('incomplete')
    this.initialProfile = undefined
    this.profile?.source(normalizedFile, sourceEvent)
    this.settlementRevision += 1
    if (this.restartHandoff) {
      // 交接窗口收到新输入时撤销过期快照，保留已排定的重启，让新会话按最新源码完整构建。
      this.restartHandoff.invalidate()
      this.restartHandoff = undefined
      return
    }
    if (this.restartTimer) {
      // 配置重启已排定；新会话会读取最新配置，旧会话不再消费事件。
      return
    }
    const event = this.ctx.moduleGraphService.getPendingChanges?.().find(change => change.file === normalizedFile)?.event
    if (this.directoryUpdates.observe(normalizedFile, event)) {
      return
    }
    if (dirtyReasonSummary.includes(ENTRY_GRAPH_CHANGE_REASON)) {
      this.entryGraphRevision += 1
      this.requestClassic({ code: 'entry-topology', message: '入口拓扑发生变化，需要重新建立完整构建图。', files: [normalizedFile] })
      return
    }
    const previousReasons = this.sourceDirtyReasons.get(normalizedFile)?.reasons ?? []
    const reasons = dirtyReasonSummary.length === 0
      ? previousReasons
      : shouldMergeStatefulHmrDirtyReasons(previousReasons, dirtyReasonSummary)
        ? [...new Set([...previousReasons, ...dirtyReasonSummary])]
        : dirtyReasonSummary
    this.sourceDirtyReasons.set(normalizedFile, { reasons })
    if (shouldRestartStatefulHmrServer([normalizedFile], this.ctx.configService?.configFileDependencies)) {
      this.requestServerRestart()
      return
    }
    const react = this.ctx.configService?.weappViteConfig?.react
    if (isReactHmrTemplateSource(react, normalizedFile)) {
      if (event === 'delete') {
        this.requestClassic({ code: 'entry-topology', message: 'React 模板依赖已删除，需要 classic 重新建立依赖图。', files: [normalizedFile] })
        return
      }
      let fallback: HmrRuntimeFallbackReason
      try {
        fallback = resolveReactTemplateHmrCapability(react, normalizedFile, readCompilerInputSync(this.ctx.configService!, normalizedFile))!.fallback
      }
      catch (error) {
        // 来源还包括 Tailwind 的同步 watcher；真实编译错误必须进入构建诊断，不能逃逸或伪装成回退成功。
        const failure = error instanceof Error ? error : new Error(String(error))
        this.buildEvents.emitEvent({ code: 'ERROR', error: failure, result: undefined as never })
        this.server.config.logger.error('[weapp-vite] React HMR capability analysis failed', { error: failure })
        return
      }
      this.requestClassic(fallback)
      return
    }
    const fallback = resolveStatefulHmrInputFallback({
      files: [normalizedFile],
      dirtyReasons: reasons,
      configurationChanged: /\.json$/i.test(normalizedFile)
        && !getCompilerHmrHost(this.ctx).ownsDependency(normalizedFile)
        && !isWxmlDependency(this.ctx, normalizedFile)
        && !this.publicAssetSources.matchesPath(normalizedFile),
    })
    if (fallback) {
      this.requestClassic(fallback)
      return
    }
    if (this.publicAssetSources.matchesPath(normalizedFile)) {
      this.requestSnapshotRefresh([normalizedFile])
      return
    }
    if (this.resynchronizing) {
      // 失败的拓扑批次可能引用尚未进入旧图的新文件；修复它也必须重试保留的完整批次。
      this.requestFullBuild([normalizedFile])
      return
    }
    if (isWxmlDependency(this.ctx, normalizedFile)) {
      this.requestFullBuild([normalizedFile])
      return
    }
    const affectedEntries = this.ctx.moduleGraphService.collectAffectedEntries(normalizedFile)
    const hasTrackedModule = (this.server.moduleGraph.getModulesByFile(normalizedFile)?.size ?? 0) > 0
    const isEmittedDependency = this.emittedSourceIds.has(normalizedFile)
    if (!getCompilerHmrHost(this.ctx).ownsDependency(normalizedFile) && shouldRebuildStatefulDependency(normalizedFile, this.entryIds, affectedEntries, hasTrackedModule, isEmittedDependency)) {
      this.requestFullBuild([normalizedFile])
      return
    }
    if (/\.[cm]?[jt]s$/.test(normalizedFile) && (this.entryIds.has(normalizedFile) || isEmittedDependency)) {
      this.unpersistedNativeScripts.set(normalizedFile, {})
      if (this.snapshotScheduler.isPending() || this.nativeScriptInputs.needsFullBuild(normalizedFile)) {
        this.requestFullBuild([normalizedFile])
        return
      }
    }
    if (getCompilerHmrHost(this.ctx).ownsDependency(normalizedFile)) {
      // 编译器拥有的样式依赖会先触发资产快照，随后 DevEngine 可能以其页面源码
      // 作为 changed file 交付一个包装入口补丁。将样式侧车原因转移到受影响入口，
      // 让该补丁走同一快照路径，避免逻辑入口在无 importer 时被错误执行。
      if (dirtyReasonSummary.length) {
        for (const entry of affectedEntries) {
          const previous = this.sourceDirtyReasons.get(entry)?.reasons ?? []
          this.sourceDirtyReasons.set(entry, {
            reasons: [...new Set([...previous, ...dirtyReasonSummary])],
          })
        }
      }
      return
    }
    if (dirtyReasonSummary.some(reason => isCompilerContentDirtyReason(reason) || reason.startsWith('entry-mixed-asset:'))) {
      // 同批次的视觉资产由原生更新回调交付，不能提前启动独立快照。
      return
    }
    if (requiresStatefulHmrSnapshot(
      normalizedFile,
      dirtyReasonSummary,
    )) {
      if (!this.snapshotScheduler.isPending()) {
        logger.info('HMR 更新：正在同步模板、样式与静态资源...')
      }
      this.requestSnapshotRefresh([normalizedFile])
    }
  }

  private handleOutput(output: StatefulHmrOutputFile[], source: StatefulHmrOutputSource): Promise<void> {
    const snapshotBatch = this.activeSnapshotBatch
    // 必须在原生输出回调进入时封存输入，排队写出期间宿主可能已经编译下一次编辑。
    const outputSourceIds = source === 'full'
      ? new Set([...this.entryIds, ...this.emittedSourceIds, ...collectStatefulHmrEmittedSourceIds(output, this.server.config.root)])
      : undefined
    const nativeInputs = outputSourceIds
      ? this.nativeScriptInputs.capture(outputSourceIds, file => getCompilerHmrHost(this.ctx).readSource(file))
      : undefined
    const nativeVueInputs = outputSourceIds && new Map([...outputSourceIds]
      .filter(file => file.endsWith('.vue'))
      .map(file => [compilerSourceId(file), getCompilerHmrHost(this.ctx).readSource(file)] as const))
    const outputTask = this.enqueueOutput(async () => {
      if (snapshotBatch?.isSuperseded()) {
        this.diagnostics?.discarded(snapshotBatch.traceBatchId, 'before-output')
        return
      }
      const snapshot = snapshotBatch?.snapshot ?? this.initialSnapshot
      const snapshotOutput = snapshot ? this.createSnapshotAssets(snapshot) : undefined
      const compatibleOutput = createStatefulHmrGlobalStyleAssets(
        await transformStatefulHmrOutput(output, Boolean(this.server.config.build.sourcemap)),
        resolveOutputExtensions(this.ctx.configService?.outputExtensions).styleExtension,
        {
          componentPageGlobalStyleRoutes: snapshot?.componentPageGlobalStyleRoutes ?? this.componentPageGlobalStyleRoutes,
          refreshPageStyles: true,
        },
      )
      if (snapshotBatch?.isSuperseded()) {
        this.diagnostics?.discarded(snapshotBatch.traceBatchId, 'after-transform')
        return
      }
      const fullBuild = source === 'full'
      let buildId: string | undefined
      if (fullBuild) {
        registerStatefulHmrInitialChunkLoaders(compatibleOutput, [...this.ctx.scanService!.subPackageMap.keys()])
        mergeStatefulHmrSnapshotAssets(compatibleOutput, snapshotOutput ?? this.snapshotAssets.values())
        buildId = this.transport.createBuildId()
        stampStatefulHmrFullBuild(compatibleOutput, buildId)
        setAsset(compatibleOutput, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, createStatefulHmrControlSource({
          ...this.transport.createControl(),
          buildId,
        }))
        setAsset(compatibleOutput, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, 'void 0;\n')
        setAsset(compatibleOutput, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE, 'void 0;\n')
      }
      protectStatefulHmrNativeEntries(compatibleOutput)
      const currentOutputFiles = new Set(compatibleOutput.map(item => item.fileName))
      const publicationOutput = fullBuild
        ? compatibleOutput
        : selectStatefulHmrAdditionalOutput(compatibleOutput, snapshotOutput ?? this.snapshotAssets.values())
      const removedAssets = fullBuild ? this.snapshotAssets.ownedNames().filter(file => !currentOutputFiles.has(file)) : []
      this.assertOutputCapabilities(publicationOutput, removedAssets)
      if (fullBuild) {
        for (const item of snapshotOutput ?? this.snapshotAssets.values()) {
          if (isStatefulHmrSnapshotAsset(item)) {
            this.snapshotAssets.track([item])
          }
        }
      }
      await this.writeOutput(
        fullBuild ? 'full' : 'additional',
        publicationOutput,
        fullBuild && this.initialSnapshot
          ? { publicDir: this.server.config.publicDir, copyPublicDir: this.server.config.build.copyPublicDir }
          : undefined,
        snapshotBatch?.traceBatchId,
        removedAssets,
        fullBuild && Boolean(this.initialSnapshot),
      )
      if (buildId) {
        this.nativeScriptInputs.commit(nativeInputs!)
        this.delivery.reset()
        this.transport.commitFullBuild(buildId)
        const compilerHmrHost = getCompilerHmrHost(this.ctx)
        const nativeSourceIds = collectStatefulHmrEmittedSourceIds(compatibleOutput, this.server.config.root)
        compilerHmrHost.setNativeSources(nativeSourceIds)
        this.transport.registerInitialPayloads(compatibleOutput.filter(item => item.type === 'chunk').map(item => item.fileName), file => this.adapter.markPayloadDelivered(file))
        if (snapshot && snapshotOutput) {
          this.adoptSnapshot(snapshot, snapshotOutput, Boolean(snapshotBatch))
          this.initialSnapshot = undefined
        }
        for (const sourceId of nativeSourceIds) {
          this.emittedSourceIds.add(sourceId)
        }
        if (!snapshotBatch?.isSuperseded()) {
          this.directoryUpdates.seedSources([...this.entryIds, ...this.emittedSourceIds])
        }
        const moduleCount = await this.adapter.registerBundleModules(compatibleOutput)
        this.nativeVueBaselines.clear()
        for (const file of new Set([...this.entryIds, ...nativeSourceIds])) {
          if (!file.endsWith('.vue')) {
            continue
          }
          const sourceId = compilerSourceId(file)
          const captured = nativeVueInputs?.get(sourceId)
          if (typeof captured === 'string' && compilerHmrHost.readSource(sourceId) === captured) {
            this.nativeVueBaselines.add(sourceId)
          }
        }
        if (snapshotBatch) {
          snapshotBatch.fullOutputCommitted = true
        }
        else {
          if (snapshot) {
            this.commitSnapshotMetadata(snapshot, 'full')
          }
          await this.initialProfile?.finishPublished()
          this.initialProfile = undefined
          this.buildEvents.emitEvent({ code: 'END' })
        }
        this.server.config.logger.info(`[weapp-vite] 微信状态保持 HMR 已就绪（${moduleCount} modules）`)
        this.initialBundle.resolve()
      }
    })
    snapshotBatch?.outputTasks.push(outputTask)
    void outputTask.catch((error) => {
      this.initialProfile?.finish('failed')
      this.initialProfile = undefined
      if (nativeInputs) {
        // 完整发布失败可能已部分落盘，旧源码版本不能再证明脚本与磁盘一致。
        this.nativeScriptInputs.invalidate()
      }
      if (!snapshotBatch) {
        this.initialBundle.reject(error)
      }
    })
    return outputTask
  }

  private handleBatch(batch: StatefulHmrDevEngineBatch): boolean {
    if (this.closed || this.restarting) {
      return false
    }
    this.settlementRevision += 1
    this.diagnostics?.delivery('received', 0, batch.changedFiles)
    let files = batch.changedFiles.map(file => normalizeFsResolvedId(path.isAbsolute(file) ? file : path.resolve(this.server.config.root, file)))
    const updates = batch.updates.filter(item => item.update.type !== 'Noop')
    const output = updates[0]?.update ?? { type: 'Noop' as const }
    files = this.directoryUpdates.consume(files)
    const dirtyReasonsByFile = new Map(files.map(file => [file, this.sourceDirtyReasons.get(file)?.reasons ?? []] as const))
    for (const file of files) {
      this.sourceDirtyReasons.delete(file)
    }
    const compilerHmrHost = getCompilerHmrHost(this.ctx)
    const capabilityFallback = resolveStatefulHmrInputFallback({
      files,
      dirtyReasons: [...dirtyReasonsByFile.values()].flat(),
      providerSupported: compilerHmrHost.supported,
      configurationChanged: files.some(file => /\.json$/i.test(file)
        && !compilerHmrHost.ownsDependency(file)
        && !isWxmlDependency(this.ctx, file)
        && !this.publicAssetSources.matchesPath(file)),
      updateType: updates.some(item => item.update.type === 'FullReload') ? 'FullReload' : undefined,
    })
    if (capabilityFallback) {
      this.requestClassic(capabilityFallback)
      return false
    }
    if (this.resynchronizing) {
      this.snapshotScheduler.request('full', files)
      return false
    }
    if (this.entryGraphRevision !== this.rebuiltEntryGraphRevision) {
      return false
    }
    const isCompilerDependency = (file: string) => compilerHmrHost.ownsDependency(file)
      && (isStatefulHmrAssetFile(file) || (!this.emittedSourceIds.has(file) && !this.entryIds.has(file) && !compilerHmrHost.isNativeSource(file)))
    const isCompilerNativeVue = (file: string) => file.endsWith('.vue') && compilerHmrHost.ownsDependency(file) && compilerHmrHost.isNativeSource(file)
    if (output.type === 'Noop') {
      // 原批次仍负责恢复原生脚本账本，编译器只接管其中实际拥有的依赖。
      const sources = this.nativeScriptInputs.capture(files, file => compilerHmrHost.readSource(file))
      this.clearRestoredNativeScripts(new Map(this.unpersistedNativeScripts), sources)
      const unknownBaselines = files.filter(file => isCompilerNativeVue(file)
        && (!this.nativeVueBaselines.has(compilerSourceId(file)) || typeof compilerHmrHost.readSource(file) !== 'string'))
      if (unknownBaselines.length) {
        this.requestClassic({ code: 'native-registration', message: '缺少已发布的原生 Vue 源码比较基线，需要 classic 重新建立模板注册。', files: unknownBaselines })
        return false
      }
      files = files.filter((file) => {
        const nativeVisualChange = isCompilerNativeVue(file) && compilerHmrHost.hasVisualChanges([file])
        return nativeVisualChange || isCompilerDependency(file)
      })
    }
    if (files.length === 0) {
      return false
    }
    const dirtyReasonSummary = [...new Set(files.flatMap(file => dirtyReasonsByFile.get(file) ?? []))]
    const compilerOnly = files.every(isCompilerDependency)
    const nativeScriptChanges = new Map(files.flatMap((file) => {
      const change = this.unpersistedNativeScripts.get(file)
      return change ? [[file, change] as const] : []
    }))
    const input = getCompilerHmrHost(this.ctx).freeze(files)
    this.diagnostics?.input(input)
    // Patch/Noop 只描述脚本交付；冻结源码中的视觉变化仍须编译并校验注册。
    const needsNativeVueSnapshot = files.some(file => isCompilerNativeVue(file) && compilerHmrHost.hasVisualChanges([file], input))

    const allowCompilerContentPatch = dirtyReasonSummary.some(isCompilerContentDirtyReason)
    if (!compilerOnly && !updates.every(({ update }) => isSafeJavaScriptPatch(
      files,
      update,
      dirtyReasonSummary,
      {
        allowCompilerContent: allowCompilerContentPatch,
        allowTailwindContent: allowCompilerContentPatch,
        root: this.server.config.root,
        srcRoot: this.ctx.configService!.absoluteSrcRoot,
        entryIds: this.entryIds,
      },
    ))) {
      if (shouldRestartStatefulHmrServer(files, this.ctx.configService?.configFileDependencies)) {
        this.requestServerRestart()
      }
      else if (
        !dirtyReasonSummary.some(reason => reason.startsWith('entry-mixed-asset:'))
        && ((files.length > 0 && files.every(isStatefulHmrAssetFile))
          || shouldUseStatefulHmrSnapshotOnly(dirtyReasonSummary))
      ) {
        if (!this.snapshotScheduler.isPending()) {
          this.requestSnapshotRefresh(files)
        }
      }
      else {
        this.requestClassic({ code: 'patch-shape', message: '当前增量不能保持已有运行时注册契约。', files })
      }
      return false
    }
    this.diagnostics?.delivery('captured', input.revision, files)
    // 编译器扫描依赖不代表接管了原生资产写出；非脚本资源仍走固定输入快照。
    const needsSnapshot = needsNativeVueSnapshot || files.some(file => requiresStatefulHmrSnapshot(file)) || (!getCompilerHmrHost(this.ctx).enabled && allowCompilerContentPatch) || (dirtyReasonSummary.some(reason => reason.startsWith('entry-mixed-asset:'))
      && (!getCompilerHmrHost(this.ctx).enabled || getCompilerHmrHost(this.ctx).hasVisualChanges(files, input)))
    const patches = (compilerOnly && !files.some(file => /\.module\.[^.]+$/.test(file)) ? [] : updates).filter(item => item.update.type === 'Patch').map(item => ({ ...item, update: { ...item.update } }))
    let scriptFacts: ReturnType<StatefulHmrViteAdapter['captureGlassEaselScriptUpdates']> | undefined
    try {
      if (isGlassEaselDetected(this.ctx)) {
        scriptFacts = this.adapter.captureGlassEaselScriptUpdates(
          patches.flatMap(({ update }) => update.type === 'Patch' ? [update.code] : []).join('\n'),
          patches.flatMap(({ update }) => update.type === 'Patch' ? update.changedIds ?? [] : []),
        )
      }
    }
    catch (error) {
      logger.error('[weapp-vite] stateful HMR delivery failed', error)
      const failure = error instanceof Error ? error : new Error(String(error))
      this.buildEvents.emitEvent({ code: 'ERROR', error: failure, result: undefined as never })
      return false
    }
    let preparation: ReturnType<ReturnType<typeof getCompilerHmrHost>['prepare']> | undefined
    const prepareProviders = () => {
      preparation ??= getCompilerHmrHost(this.ctx).prepare(input).catch((error) => {
        preparation = undefined
        throw error
      })
      return preparation
    }
    void prepareProviders().catch(() => {})
    const profile = this.profile?.begin(files, 'delivery')
    this.delivery.enqueue({
      bytes: patches.reduce((bytes, item) => bytes + (item.update.type === 'Patch' ? Buffer.byteLength(item.update.code) : 0), 0),
      prepare: async () => {
        profile?.mark('prepareMs')
        this.diagnostics?.delivery('prepare', input.revision, files)
        try {
          const compiled = await compileHmrBatch({
            ctx: this.ctx,
            input,
            needsSnapshot,
            patches,
            prepareProviders,
            rebuild: (files, sources) => sources ? this.snapshots.rebuild(files, sources) : this.snapshots.rebuild(files),
            sourcemap: Boolean(this.server.config.build.sourcemap),
            onPreparationStage: this.diagnostics
              ? observation => this.diagnostics!.preparation(input.revision, files, observation)
              : undefined,
          })
          const { compilerAssets, snapshot, code, changedIds, filenames } = compiled
          profile?.mark('commitQueueMs')
          if (snapshot && this.restartForEntryGraph(snapshot)) {
            // reset 已撤销本代交付；保留 dispose 供协调器释放预编译资源。
            return { commit: async () => {}, publish: async () => {}, dispose: () => {
              profile?.finish('incomplete')
              return compiled.dispose()
            } }
          }
          if (shouldResetStatefulHmrRetention(this.transport.retainedDeltaCount, this.transport.retainedDeltaBytes, Buffer.byteLength(code))) {
            this.requestFullBuild(files)
          }
          return {
            commit: () => this.enqueueOutput(async () => {
              profile?.mark('commitMs')
              this.diagnostics?.delivery('commit', input.revision, files)
              const next = snapshot
                ? this.createSnapshotAssets(snapshot)
                : compilerAssets.length
                  ? mergeStatefulHmrCompilerAssets(
                      this.snapshotAssets.values(),
                      compilerAssets.map(asset => ({ type: 'asset' as const, fileName: asset.fileName, source: asset.code })),
                      resolveOutputExtensions(this.ctx.configService?.outputExtensions).styleExtension,
                      { createIfMissing: true, componentPageGlobalStyleRoutes: this.componentPageGlobalStyleRoutes, refreshPageStyles: true },
                    )
                  : [...this.snapshotAssets.values()]
              if (snapshot) {
                this.assertTemplateRegistrations(snapshot)
              }
              await this.commitSnapshotAssets(next)
              if (snapshot) {
                this.adoptSnapshot(snapshot, next)
                this.commitSnapshotMetadata(snapshot, 'refresh')
              }
            }),
            publish: async () => {
              profile?.mark('publishMs')
              this.diagnostics?.delivery('publish', input.revision, files)
              if (!filenames.length) {
                this.clearRestoredNativeScripts(nativeScriptChanges, input.sources)
                this.buildEvents.emitEvent({ code: 'END' })
                profile?.finish('complete')
                return
              }
              let acknowledged = 0
              await this.transport.addDelta(code, [...new Set(changedIds)], async () => {
                this.diagnostics?.delivery('acknowledge', input.revision, files)
                while (acknowledged < filenames.length) {
                  const update = patches[acknowledged]?.update
                  if (update?.type === 'Patch') {
                    await this.adapter.registerPatchModules(update.code)
                  }
                  await this.adapter.markPayloadDelivered(filenames[acknowledged]!)
                  acknowledged += 1
                }
              })
              if (scriptFacts) {
                refreshGlassEaselNativeScripts(this.ctx, scriptFacts)
              }
              this.clearRestoredNativeScripts(nativeScriptChanges, input.sources)
              this.buildEvents.emitEvent({ code: 'END' })
              profile?.finish('complete')
            },
            dispose: () => {
              profile?.finish('incomplete')
              return compiled.dispose()
            },
          }
        }
        catch (error) {
          profile?.finish('failed')
          preparation = undefined
          throw error
        }
      },
    })
    return true
  }

  private requestFullBuild(files: Iterable<string> = []): void {
    if (this.closed || this.restarting) {
      return
    }
    this.settlementRevision += 1
    this.resynchronizing = true
    this.delivery.reset()
    this.transport.cancelPendingDeliveries()
    if (this.diagnostics) {
      files = [...files]
      this.diagnostics.request('full', files as string[])
    }
    this.snapshotScheduler.request('full', files)
  }

  private requestClassic(reason: HmrRuntimeFallbackReason, cause?: unknown): void {
    if (this.closed || this.restarting) {
      return
    }
    this.restarting = true
    this.interruptSettlement()
    this.delivery.reset()
    this.transport.retire()
    if (getHmrRuntimeCapabilityFallback(cause) === reason) {
      this.fallbackCause = { error: cause }
    }
    // close 同步撤销快照准入；当前批次由宿主收尾等待，不从批次内反向等待自身。
    this.fallbackSnapshotClose = this.snapshotScheduler.close(this.fallbackCause ? { cause: this.fallbackCause.error } : undefined)
    void this.fallbackSnapshotClose.catch(() => {})
    this.stopAdapterForRestart()
    const runtimeSession = getHmrRuntimeSession(this.ctx)
    runtimeSession.requestClassic(reason)
    void runtimeSession.whenSettled().catch((error) => {
      const failure = error instanceof Error ? error : new Error(String(error))
      this.buildEvents.emitEvent({ code: 'ERROR', error: failure, result: undefined as never })
      this.server.config.logger.error('[weapp-vite] classic HMR 切换失败', { error: failure })
    })
  }

  private stopAdapterForRestart(): void {
    const adapter = this.adapter as StatefulHmrViteAdapter & {
      stopEngineForRestart?: () => Promise<void>
    }
    void adapter.stopEngineForRestart?.().catch((error) => {
      this.server.config.logger.error('[weapp-vite] stateful HMR 旧引擎停止失败', { error })
    })
  }

  private clearRestoredNativeScripts(changes: ReadonlyMap<string, object>, sources: ReadonlyMap<string, string | null | undefined>): void {
    for (const [file, change] of changes) {
      if (this.unpersistedNativeScripts.get(file) === change && this.nativeScriptInputs.matches(file, sources)) {
        this.unpersistedNativeScripts.delete(file)
      }
    }
  }

  private requestSnapshotRefresh(files: Iterable<string> = []): void {
    if (this.closed || this.restarting) {
      return
    }
    this.settlementRevision += 1
    if (this.unpersistedNativeScripts.size) {
      this.requestFullBuild([...this.unpersistedNativeScripts.keys(), ...files])
      return
    }
    if (this.diagnostics) {
      files = [...files]
      this.diagnostics.request('refresh', files as string[])
    }
    this.snapshotScheduler.request('refresh', files)
  }

  private restartForEntryGraph(snapshot: StatefulHmrSnapshot): boolean {
    const nextEntryIds = snapshot.entryIds?.map(id => normalizeFsResolvedId(id))
    if (!nextEntryIds || (nextEntryIds.length === this.entryIds.size && nextEntryIds.every(id => this.entryIds.has(id)))) {
      return false
    }
    this.requestClassic({ code: 'entry-topology', message: '快照发现入口拓扑变化，需要重新建立完整构建图。', files: nextEntryIds })
    return true
  }

  private requestServerRestart(): void {
    if (this.restartTimer) {
      return
    }
    this.restartTimer = setTimeout(() => {
      this.restarting = true
      this.interruptSettlement()
      this.restartTimer = undefined
      const handoff = this.restartHandoff
      this.restartHandoff = undefined
      void (async () => {
        try {
          if (handoff) {
            await offerStatefulHmrSnapshot(this.ctx, handoff)
          }
          await this.restart()
        }
        catch (error) {
          await handoff?.invalidate('failed')
          const failure = error instanceof Error ? error : new Error(String(error))
          this.buildEvents.emitEvent({ code: 'ERROR', error: failure, result: undefined as never })
          this.server.config.logger.error(`[weapp-vite] stateful HMR server restart failed: ${formatStatefulHmrError(failure)}`, { error: failure })
        }
        finally {
          await handoff?.invalidate()
        }
      })()
    }, 100)
  }

  private enqueueOutput(task: () => Promise<void>): Promise<void> {
    const outputTask = this.outputChain.then(async () => {
      if (!this.closed && !this.restarting) {
        await task()
      }
    })
    // 队列尾部恢复只保证后续任务可执行，当前调用方仍需收到实际写入失败。
    this.outputChain = outputTask.catch((error) => {
      // 能力边界请求 classic 并保留当前拒绝，不能同时被记录为构建失败。
      const fallback = getHmrRuntimeCapabilityFallback(error)
      if (fallback) {
        this.requestClassic(fallback, error)
      }
      else {
        this.server.config.logger.error(`[weapp-vite] stateful HMR output failed: ${formatStatefulHmrError(error)}`)
      }
      // 队列恢复不能证明正在释放的写出成功；只有触发本次回退的同一能力拒绝可排除。
      if ((this.closed || this.restarting) && (!this.fallbackCause || error !== this.fallbackCause.error)) {
        this.retiringOutputFailures.add(error)
      }
    })
    return outputTask
  }

  private writeOutput(
    kind: 'control' | 'delta' | 'full' | 'additional' | 'refresh',
    output: StatefulHmrOutputFile[],
    initialPublicAssets?: StatefulHmrInitialPublicAssets,
    batchId?: number,
    removedAssets: string[] = [],
    replaceOwnership = false,
  ): Promise<void> {
    this.assertOutputCapabilities(output, removedAssets)
    const outDir = this.ctx.configService!.outDir
    // DevEngine 的 full 回调仍可能省略未变化的原生模块（例如 app.prelude.js）；
    // stateful scope 必须保留这些已有文件，只有显式 removedAssets 才允许删除旧产物。
    const commitOwnership = prepareOutputOwnership(this.ctx, outDir, output.map(item => item.fileName), !replaceOwnership, removedAssets, 'stateful-hmr')
    const write = async () => {
      await writeStatefulHmrOutput(outDir, output, initialPublicAssets, removedAssets)
      await commitOwnership()
      this.outputCapabilities.published(output, removedAssets, kind === 'full')
    }
    const pending = this.diagnostics ? this.diagnostics.write({ kind, batchId }, output, write) : write()
    return pending.catch((error) => {
      // 原生写盘失败可能已有部分输出落盘，不能继续用旧字节快照省略下一次写入。
      this.snapshotAssets.invalidate()
      throw error
    })
  }

  private async profileSnapshotBatch(batch: { files: string[], isSuperseded: () => boolean, mode: 'full' | 'refresh' }): Promise<void> {
    const profile = this.profile?.begin(batch.files, batch.mode)
    try {
      if (this.diagnostics) {
        await this.diagnostics.batch(batch, batchId => this.executeSnapshotBatch(batch, batchId, profile))
      }
      else {
        await this.executeSnapshotBatch(batch, undefined, profile)
      }
    }
    catch (error) {
      profile?.finish('failed')
      throw error
    }
    finally {
      profile?.finish('incomplete')
    }
  }

  private async executeSnapshotBatch(batch: {
    files: string[]
    isSuperseded: () => boolean
    mode: 'full' | 'refresh'
  }, traceBatchId?: number, profile?: StatefulHmrProfileBatch): Promise<void> {
    this.buildEvents.emitEvent({ code: 'START' })
    const entryGraphRevision = this.entryGraphRevision
    const nativeScriptChanges = new Map(this.unpersistedNativeScripts)
    const nativeAssetDrift = this.nativeScriptInputs.captureAssetDrift()
    // 完整构建只消费启动时捕获的事件；同一路径的新事件仍归后续批次所有。
    const sourceChanges = new Map(batch.files.map(file => [file, this.sourceDirtyReasons.get(file)]))
    const releaseSourceChanges = () => {
      if (batch.isSuperseded()) {
        return
      }
      for (const [file, change] of sourceChanges) {
        if (this.sourceDirtyReasons.get(file) === change) {
          this.sourceDirtyReasons.delete(file)
        }
      }
    }
    let refreshed = false
    let handoff: { snapshot: StatefulHmrSnapshot, sources?: ReadonlyMap<string, string | null> } | undefined
    await withStatefulHmrSnapshotPreparation(this.ctx, batch, (files, sources) => sources ? this.snapshots.rebuild(files, sources) : this.snapshots.rebuild(files), async ({ input, rebuild }) => {
      if (input) {
        this.diagnostics?.input(input)
      }
      const snapshot = await rebuild()
      profile?.mark('snapshotPublishMs')
      this.diagnostics?.snapshot(traceBatchId, snapshot.output, batch.isSuperseded())
      if (batch.isSuperseded()) {
        this.diagnostics?.discarded(traceBatchId, 'after-build')
        return
      }
      const nextEntryIds = snapshot.entryIds?.map(id => normalizeFsResolvedId(id))
      if (batch.mode === 'refresh' && nextEntryIds && (nextEntryIds.length !== this.entryIds.size || nextEntryIds.some(id => !this.entryIds.has(id)))) {
        handoff = { snapshot, sources: input?.sources }
        return
      }
      if (this.restartForEntryGraph(snapshot)) {
        return
      }
      this.assertTemplateRegistrations(snapshot)
      if (batch.mode === 'full') {
        if (nextEntryIds) {
          this.entryIds.clear()
          for (const id of nextEntryIds) {
            this.entryIds.add(id)
          }
        }
        if (snapshot.delegatedComponentEntryIds) {
          this.delegatedComponentEntryIds.clear()
          for (const id of snapshot.delegatedComponentEntryIds) {
            this.delegatedComponentEntryIds.add(normalizeFsResolvedId(id))
          }
        }
        const activeBatch: ActiveSnapshotBatch = { ...batch, traceBatchId, snapshot, outputTasks: [] }
        try {
          await this.adapter.rebuild(() => {
            this.activeSnapshotBatch = activeBatch
          })
          if (!activeBatch.outputTasks.length && !batch.isSuperseded()) {
            throw new Error('微信状态保持 HMR 完整构建未交付可持久化的输出。')
          }
          await Promise.all(activeBatch.outputTasks)
          if (!batch.isSuperseded()) {
            if (!activeBatch.fullOutputCommitted) {
              throw new Error('微信状态保持 HMR 完整构建未交付可持久化的原生完整输出。')
            }
            this.resynchronizing = false
            this.rebuiltEntryGraphRevision = entryGraphRevision
            this.nativeScriptInputs.commitAssetDrift(nativeAssetDrift)
            for (const [file, change] of nativeScriptChanges) {
              if (this.unpersistedNativeScripts.get(file) === change) {
                this.unpersistedNativeScripts.delete(file)
              }
            }
            releaseSourceChanges()
            this.commitSnapshotMetadata(snapshot, 'full')
            this.buildEvents.emitEvent({ code: 'END' })
            profile?.finish('complete')
          }
        }
        finally {
          if (this.activeSnapshotBatch === activeBatch) {
            this.activeSnapshotBatch = undefined
          }
        }
        return
      }
      // 资产快照不消费源分类，原生 patch 可能在快照写入完成后才抵达。
      await this.enqueueOutput(async () => {
        if (batch.isSuperseded()) {
          this.diagnostics?.discarded(traceBatchId, 'before-output')
          return
        }
        const output = this.createSnapshotAssets(snapshot)
        this.assertTemplateRegistrations(snapshot)
        await this.commitSnapshotAssets(output, traceBatchId, batch.isSuperseded())
        // 写盘期间到达的新事件仍须以实际落盘内容为基线；分析事实只提交未被取代的批次。
        this.adoptSnapshot(snapshot, output)
        if (batch.isSuperseded()) {
          return
        }
        this.commitSnapshotMetadata(snapshot, 'refresh')
        refreshed = true
      })
    })
    if (!batch.isSuperseded()) {
      // 刷新资源释放成功后才能交接 profile 或宣布完成；落盘 metadata 保留真实提交事实。
      if (handoff) {
        this.restartForEntryGraph(handoff.snapshot)
      }
      else if (refreshed) {
        this.buildEvents.emitEvent({ code: 'END' })
        profile?.finish('complete')
      }
    }
  }

  /** 快照刷新与编译批次共享资产提交、删除及失败恢复基线。 */
  private async commitSnapshotAssets(output: StatefulHmrOutputFile[], traceBatchId?: number, superseded = false): Promise<void> {
    const assets = output.filter(isStatefulHmrSnapshotAsset)
    const retainedFileNames = output.map(item => item.fileName)
    const changes = this.snapshotAssets.diff(assets, retainedFileNames)
    this.assertOutputCapabilities(assets, changes.removed)
    this.diagnostics?.diff(traceBatchId, this.snapshotAssets.values(), output, changes.changed, superseded)
    await this.snapshotAssets.commit(assets, async ({ changed, removed }) => {
      await this.writeOutput('refresh', changed, undefined, traceBatchId, removed)
    }, retainedFileNames)
  }

  private assertOutputCapabilities(output: readonly StatefulHmrOutputFile[], removed: readonly string[] = []): void {
    const fallback = this.outputCapabilities.fallback(output, removed)
    if (fallback) {
      throw new HmrRuntimeCapabilityError(fallback)
    }
  }

  private createSnapshotAssets(snapshot: StatefulHmrSnapshot): StatefulHmrOutputFile[] {
    return createStatefulHmrGlobalStyleAssets(
      snapshot.output,
      resolveOutputExtensions(this.ctx.configService?.outputExtensions).styleExtension,
      {
        createIfMissing: true,
        componentPageGlobalStyleRoutes: snapshot.componentPageGlobalStyleRoutes,
        previousComponentPageGlobalStyleRoutes: this.componentPageGlobalStyleRoutes,
        refreshPageStyles: true,
      },
    )
  }

  private commitSnapshotMetadata(snapshot: StatefulHmrSnapshot, mode: 'full' | 'refresh'): void {
    setTailwindStyleOwners(this.ctx, snapshot.tailwindStyleOwners)
    const current = this.ctx.runtimeState.glassEasel.analysisByOwner
    const preserveScripts = isGlassEaselDetected(this.ctx)
    // 资产快照不发布 JS，不能回滚构建期间已经提交的 native full/delta 事实。
    for (const [owner, analysis] of current) {
      if (
        preserveScripts
        && isNativeScriptAnalysisOwner(owner, analysis)
        && !(mode === 'full' && owner.startsWith('native-source:'))
      ) {
        continue
      }
      current.delete(owner)
    }
    for (const [owner, analysis] of snapshot.glassEaselAnalysisByOwner) {
      if (!preserveScripts || !isNativeScriptAnalysisOwner(owner, analysis)) {
        current.set(owner, analysis)
      }
    }
  }

  private adoptSnapshot(snapshot: StatefulHmrSnapshot, output: StatefulHmrOutputFile[], completingFullBuild = false): void {
    this.templateRegistrationSignatures = snapshot.templateRegistrationSignatures && new Map(snapshot.templateRegistrationSignatures)
    const nativeScriptDrift = snapshot.captureNativeScriptDrift?.()
    this.childSources?.adopt(snapshot.childSources)
    this.componentPageGlobalStyleRoutes = [...snapshot.componentPageGlobalStyleRoutes]
    this.snapshotAssets.adopt(output.filter(isStatefulHmrSnapshotAsset))
    this.nativeScriptInputs.adoptAssets(snapshot.nativeScriptVersions, nativeScriptDrift)
    // 原生通知可能在独立交付快照编译或写出期间进入；只消费真实通知，不主动失效 DevEngine。
    const notified = [...this.unpersistedNativeScripts.keys()].filter(file => this.nativeScriptInputs.needsFullBuild(file))
    if (notified.length && !completingFullBuild) {
      this.requestFullBuild(notified)
    }
  }

  private assertTemplateRegistrations(snapshot: StatefulHmrSnapshot): void {
    const fallback = resolveTemplateRegistrationFallback(this.templateRegistrationSignatures, snapshot)
    if (fallback) {
      throw new HmrRuntimeCapabilityError(fallback)
    }
  }

  private async waitForInitialBundle(): Promise<void> {
    await this.initialBundle.promise
    await this.outputChain
  }

  /** 从宿主外等待已通知更新的完整发布；并发入队会重新核对，不等待尚未发生的文件事件。 */
  async whenSettled(): Promise<void> {
    const interrupted = Promise.withResolvers<never>()
    const interrupt = () => interrupted.reject(new Error('Stateful HMR session closed or restarted before settlement'))
    this.settlementObservers.add(interrupt)
    try {
      await Promise.race([this.settleActiveSession(), interrupted.promise])
    }
    finally {
      this.settlementObservers.delete(interrupt)
    }
  }

  private interruptSettlement(): void {
    for (const interrupt of this.settlementObservers) {
      interrupt()
    }
    this.settlementObservers.clear()
  }

  private async settleActiveSession(): Promise<void> {
    const assertActive = () => {
      if (this.closed || this.restarting || this.restartTimer || this.restartHandoff) {
        throw new Error('Stateful HMR session closed or restarted before settlement')
      }
    }
    assertActive()
    await this.waitForInitialBundle()
    for (;;) {
      const revision = this.settlementRevision
      await this.adapter.whenSettled()
      assertActive()
      await this.delivery.whenSettled()
      await this.snapshotScheduler.whenSettled()
      const output = this.outputChain
      await output
      await this.adapter.whenSettled()
      assertActive()
      if (revision === this.settlementRevision && output === this.outputChain && !this.snapshotScheduler.isPending()) {
        return
      }
    }
  }
}

export function shouldRestartStatefulHmrServer(
  files: Iterable<string>,
  configFileDependencies: Iterable<string> = [],
): boolean {
  const normalizedConfigDependencies = new Set(
    Array.from(configFileDependencies, dependency => normalizeFsResolvedId(dependency)),
  )
  return Array.from(files).some(file =>
    normalizedConfigDependencies.has(normalizeFsResolvedId(file)),
  )
}

export function shouldRebuildStatefulDependency(
  file: string,
  entryIds: ReadonlySet<string>,
  affectedEntries: ReadonlySet<string>,
  hasTrackedModule = false,
  isEmittedDependency = false,
): boolean {
  const normalizedFile = normalizeFsResolvedId(file)
  return isStatefulHmrExecutableSource(normalizedFile)
    && !entryIds.has(normalizedFile)
    && affectedEntries.size > 0
    // 已进入 DevEngine 的模块由实际 Patch/FullReload 分类，避免 source watcher 抢先重启。
    && !hasTrackedModule
    && !isEmittedDependency
}

function collectStatefulHmrEmittedSourceIds(output: StatefulHmrOutputFile[], root: string): Set<string> {
  const sourceIds = new Set<string>()
  for (const item of output) {
    if (item.type !== 'chunk') {
      continue
    }
    for (const moduleId of Object.keys(item.modules ?? {})) {
      const sourceId = moduleId.split('?')[0]!
      if (!isStatefulHmrExecutableSource(sourceId)) {
        continue
      }
      sourceIds.add(normalizeFsResolvedId(path.isAbsolute(sourceId) ? sourceId : path.resolve(root, sourceId)))
    }
  }
  return sourceIds
}

function isStatefulHmrExecutableSource(file: string): boolean {
  return /\.(?:[cm]?[jt]sx?|vue)$/.test(file.split('?')[0]!)
}

export function mergeStatefulHmrSnapshotAssets(
  output: StatefulHmrOutputFile[],
  snapshotAssets: Iterable<StatefulHmrOutputFile>,
): void {
  for (const asset of snapshotAssets) {
    if (!isStatefulHmrSnapshotAsset(asset)) {
      continue
    }
    const index = output.findIndex(item => item.fileName === asset.fileName)
    if (index >= 0) {
      // DevEngine 入口包含注册桥和 HMR 模块上下文，静态快照不得覆盖其执行契约。
      if (output[index]?.type === 'chunk') {
        continue
      }
      output[index] = asset
    }
    else {
      output.push(asset)
    }
  }
}

export function getChangedStatefulHmrSnapshotAssets(
  previous: Iterable<StatefulHmrOutputFile>,
  next: Iterable<StatefulHmrOutputFile>,
): StatefulHmrOutputFile[] {
  const previousAssets = new Map(
    Array.from(previous).flatMap(item => isStatefulHmrSnapshotAsset(item) ? [[item.fileName, item.source] as const] : []),
  )
  return Array.from(next).filter((item) => {
    if (!isStatefulHmrSnapshotAsset(item)) {
      return false
    }
    const previousSource = previousAssets.get(item.fileName)
    return previousSource === undefined || !statefulHmrAssetSourcesEqual(previousSource, item.source)
  })
}

type StatefulHmrAssetSource = Extract<StatefulHmrOutputFile, { type: 'asset' }>['source']

function statefulHmrAssetSourcesEqual(left: StatefulHmrAssetSource, right: StatefulHmrAssetSource): boolean {
  if (left === right) {
    return true
  }
  const leftBuffer = Buffer.isBuffer(left) ? left : Buffer.from(left)
  const rightBuffer = Buffer.isBuffer(right) ? right : Buffer.from(right)
  return leftBuffer.equals(rightBuffer)
}

function createWatcherAdapter(
  server: ViteDevServer,
  session: StatefulHmrSession,
  buildEvents: DevBuildWatcherController,
  borrowed = false,
): RolldownWatcher {
  let closePromise: Promise<void> | undefined
  const watcher: RolldownWatcher = {
    ...buildEvents.watcher,
    close() {
      // 独立宿主的生命周期已负责关闭会话并聚合错误，不能重复关闭后覆盖原始失败。
      return closePromise ??= borrowed ? session.close() : server.close()
    },
    on(event, listener) {
      buildEvents.watcher.on(event, listener)
      return watcher
    },
    off(event, listener) {
      buildEvents.watcher.off(event, listener)
      return watcher
    },
  }
  return watcher
}

export function isSafeJavaScriptPatch(
  files: string[],
  output: StatefulHmrDevEngineUpdate,
  dirtyReasonSummary: string[] = [],
  options: { allowCompilerContent?: boolean, allowTailwindContent?: boolean, root?: string, srcRoot?: string, entryIds?: Iterable<string> } = {},
): output is Extract<StatefulHmrDevEngineUpdate, { type: 'Patch' }> {
  return output.type === 'Patch'
    && files.every(file => /\.(?:[cm]?[jt]sx?|vue)$/.test(file))
    && !output.changedIds?.some(id => isNonJavaScriptSidecarId(id) && !isChangedNativeComponentSidecar(id, files, options))
    && !dirtyReasonSummary.some(reason => isUnsafeStatefulHmrReason(
      reason,
      options.allowCompilerContent === true || options.allowTailwindContent === true,
    ))
}

export function requiresStatefulHmrSnapshot(file: string, dirtyReasonSummary: string[] = []): boolean {
  return /\.(?:jsx|tsx)$/.test(file)
    || !/\.(?:[cm]?[jt]sx?|vue)$/.test(file)
    || dirtyReasonSummary.some(reason => reason.startsWith('entry-mixed-asset:') || isUnsafeStatefulHmrReason(reason))
}

export function isStatefulHmrAssetFile(file: string): boolean {
  return !/\.(?:[cm]?[jt]sx?|vue)$/.test(file)
}

function isUnsafeStatefulHmrReason(reason: string, allowCompilerContent = false): boolean {
  if (allowCompilerContent && isCompilerContentDirtyReason(reason)) {
    return false
  }
  return /^(?:entry-json-only|entry-local-asset|entry-style-only|entry-mixed-config|style-sidecar|react-template|compiler-content|tailwind-content):/.test(reason)
}

/** 编译 provider 触发的内容变化使用统一 reason 前缀，保留旧 Tailwind reason 兼容。 */
export function isCompilerContentDirtyReason(reason: string): boolean {
  return /^(?:compiler-content|tailwind-content):/.test(reason)
}

function shouldMergeStatefulHmrDirtyReasons(previous: readonly string[], next: readonly string[]): boolean {
  const isVisualTransactionReason = (reason: string) => reason.startsWith('entry-mixed-asset:') || isCompilerContentDirtyReason(reason)
  return previous.some(isVisualTransactionReason) && next.some(isVisualTransactionReason)
}

export function shouldUseStatefulHmrSnapshotOnly(dirtyReasonSummary: string[]): boolean {
  const hasAssetOnlyEntry = dirtyReasonSummary.some(reason =>
    /^(?:entry-json-only|entry-local-asset|entry-style-only|style-sidecar):/.test(reason),
  )
  return hasAssetOnlyEntry && dirtyReasonSummary.every(reason =>
    /^(?:entry-json-only|entry-local-asset|entry-style-only|style-sidecar|compiler-content|tailwind-content):/.test(reason),
  )
}

function isNonJavaScriptSidecarId(id: string): boolean {
  const sidecar = parseSidecarSourceRequest(id) ?? parseSidecarModuleId(id)
  return sidecar !== undefined && sidecar.kind !== 'script' && sidecar.kind !== 'jsx'
}

function setAsset(output: StatefulHmrOutputFile[], fileName: string, source: string): void {
  const index = output.findIndex(item => item.fileName === fileName)
  const asset: StatefulHmrOutputFile = { type: 'asset', fileName, source }
  if (index >= 0) {
    output[index] = asset
  }
  else {
    output.push(asset)
  }
}

export function stampStatefulHmrFullBuild(output: StatefulHmrOutputFile[], buildId: string): void {
  for (const item of output) {
    if (item.type === 'chunk' && item.fileName.endsWith('.js')) {
      item.code = wrapHmrCode(
        readMappedHmrCode(item.code, item.fileName),
        `// weapp-vite-stateful-build:${buildId}\n`,
        `\nglobalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}] && globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}].payloadDelivered(${JSON.stringify(item.fileName)});\n`,
      )
    }
  }
}

function formatStatefulHmrError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message
  }
  return String(error)
}
