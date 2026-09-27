import type { RolldownWatcher } from 'rolldown'
/* eslint-disable ts/no-use-before-define */

import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { CompilerContext, MutableCompilerContext } from '../../context'
import type { DevBuildWatcherController } from '../buildPlugin/devBuildWatcher'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrOutputSource } from './outputPublication'
import type { StatefulHmrInitialPublicAssets, StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrDevEngineBatch, StatefulHmrDevEngineUpdate } from './viteAdapter'
import { Buffer } from 'node:buffer'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import MagicString from 'magic-string'
import path from 'pathe'
import { createServer, transformWithOxc } from 'vite'
import { isNativeScriptAnalysisOwner, refreshGlassEaselNativeScripts } from '../../analyze/glassEasel/nativeScripts'
import { isGlassEaselDetected } from '../../analyze/glassEasel/state'
import { logger } from '../../context/shared'
import { parseSidecarModuleId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { createPublicAssetSourcePlan } from '../../plugins/asset/publicSources'
import { CompilerHmrResyncError, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { ENTRY_GRAPH_CHANGE_REASON } from '../../plugins/hooks/useLoadEntry/entryChunkLifecycle'
import { isReactStaticTemplateSource } from '../../plugins/react'
import { parseJsLike, traverse } from '../../utils/babel'
import { resolveOutputExtensions } from '../../utils/outputExtensions'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from '../../utils/sourcemap'
import { isWxmlDependency } from '../../wxml/processing/dependencies'
import { watchAssetSources } from '../watch/assets'
import { createViteWatchIgnored, resolvePollingWatchOptions } from '../watch/options'
import { isStatefulHmrBoundary } from './boundaries'
import { compileHmrBatch } from './compileBatch'
import { HmrDeliveryCoordinator } from './deliveryCoordinator'
import { StatefulHmrDirectoryUpdates } from './directoryUpdates'
import { createStatefulHmrGlobalStyleAssets, mergeStatefulHmrCompilerAssets } from './globalStyles'
import { registerStatefulHmrInitialChunkLoaders } from './initialChunkLoaders'
import { createStatefulHmrInitialGraph, resolveStatefulHmrModuleRoot } from './initialModuleGraph'
import { isChangedNativeComponentSidecar } from './nativeComponentSidecar'
import { isStatefulHmrSnapshotAsset, selectStatefulHmrAdditionalOutput } from './outputOwnership'
import { writeStatefulHmrOutput } from './outputWriter'
import { readMappedHmrCode, wrapHmrCode } from './patchPreparation'
import { shouldResetStatefulHmrRetention } from './retention'
import { createStatefulHmrControlSource } from './runtimeSource'
import { createStatefulHmrSidecarPlugin } from './sidecarPlugin'
import { createStatefulHmrSnapshotDiagnostics } from './snapshotDiagnostics'
import { StatefulHmrSnapshotScheduler } from './snapshotScheduler'
import { StatefulHmrTransport } from './transport'
import { StatefulHmrViteAdapter } from './viteAdapter'

export { isStatefulHmrBoundary } from './boundaries'
export { shouldResetStatefulHmrRetention } from './retention'

interface StatefulHmrSnapshots {
  entryIds: Iterable<string>
  delegatedComponentEntryIds?: Iterable<string>
  initial: StatefulHmrSnapshot
  rebuild: (files: string[], sources?: ReadonlyMap<string, string | null>) => Promise<StatefulHmrSnapshot>
}

interface ActiveSnapshotBatch {
  fullOutputCommitted?: boolean
  traceBatchId?: number
  isSuperseded: () => boolean
  outputTasks: Promise<void>[]
  snapshot: StatefulHmrSnapshot
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
    throw new Error('weapp.hmr.runtime="stateful-experimental" 目前仅支持微信小程序平台。')
  }
  let session: StatefulHmrSession | undefined
  let moduleGraphRoot = buildOptions.root ?? configService.cwd
  const entryIds = new Set(Array.from(snapshots.entryIds, id => normalizeFsResolvedId(id)))
  const delegatedComponentEntryIds = new Set(Array.from(snapshots.delegatedComponentEntryIds ?? [], id => normalizeFsResolvedId(id)))
  const pollingWatchOptions = resolvePollingWatchOptions(configService)
  const capturePlugin: Plugin = {
    name: 'weapp-vite:hmr-input',
    enforce: 'pre',
    transform(code, id) {
      // 受管入口的 load 会注入配置与依赖；原始内容由入口读取器封存。
      if (!entryIds.has(normalizeFsResolvedId(id))) {
        getCompilerHmrHost(compilerContext).captureNative(id, code)
      }
    },
    watchChange(id, change) {
      if (change.event === 'delete') {
        getCompilerHmrHost(compilerContext).capture(id, null)
      }
    },
  }
  const installPlugin: Plugin = {
    name: 'weapp-vite:stateful-hmr-session',
    enforce: 'post',
    configResolved(config) {
      moduleGraphRoot = resolveStatefulHmrModuleRoot(config.root, config.build.rolldownOptions.cwd)
    },
    configureServer(server) {
      const currentSession = new StatefulHmrSession(compilerContext, server, restart, entryIds, snapshots, {
        compareContentsForPolling: pollingWatchOptions.usePolling === true ? true : undefined,
        pollInterval: pollingWatchOptions.interval,
        usePolling: pollingWatchOptions.usePolling,
      }, delegatedComponentEntryIds, buildEvents)
      session = currentSession
      currentSession.install()
    },
    transform(code, id) {
      if (
        !isStatefulHmrBoundary(
          id,
          configService.absoluteSrcRoot,
          entryIds,
          delegatedComponentEntryIds,
        )
        || code.includes('import.meta.hot.accept')
      ) {
        return
      }
      const transformed = id.endsWith('.vue') ? code : redirectNativeComponentRegistration(code)
      return `${transformed}\nif (import.meta.hot) import.meta.hot.accept();\n`
    },
    renderChunk(code, chunk, options) {
      if (options.format === 'cjs' && chunk.moduleIds.length) {
        return { code: `${code}${createStatefulHmrInitialGraph(chunk, this, moduleGraphRoot)}`, map: null }
      }
    },
  }
  const server = await createServer({
    ...buildOptions,
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
    plugins: [capturePlugin, createStatefulHmrSidecarPlugin(), installPlugin, ...(buildOptions.plugins ?? [])],
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
      ...(buildOptions.build ?? {}),
      watch: undefined,
      write: false,
    },
  })
  try {
    await server.listen()
    if (!session) {
      throw new Error('微信状态保持 HMR session 未完成初始化。')
    }
    await session.watchAssets()
    await session.refreshControl()
    return createWatcherAdapter(server, session, buildEvents)
  }
  catch (error) {
    await session?.close().catch(() => {})
    await server.close().catch(() => {})
    throw error
  }
}

class StatefulHmrSession {
  private readonly publicAssetSources: ReturnType<typeof createPublicAssetSourcePlan>
  private readonly uncommittedSnapshotAssetNames = new Set<string>()
  private snapshotAssetsReliable = true
  private assetWatcher?: ReturnType<typeof watchAssetSources>
  private activeSnapshotBatch?: ActiveSnapshotBatch
  private readonly adapter: StatefulHmrViteAdapter
  private readonly delivery: HmrDeliveryCoordinator
  private resynchronizing = false
  private closed = false
  private readonly initialBundle = Promise.withResolvers<void>()
  private readonly snapshotScheduler: StatefulHmrSnapshotScheduler
  private readonly diagnostics: ReturnType<typeof createStatefulHmrSnapshotDiagnostics>
  private readonly transport: StatefulHmrTransport
  private outputChain: Promise<void> = Promise.resolve()
  private restartTimer?: ReturnType<typeof setTimeout>
  private snapshotAssets = new Map<string, StatefulHmrOutputFile>()
  private componentPageGlobalStyleRoutes: string[] = []
  private initialSnapshot?: StatefulHmrSnapshot
  private readonly emittedSourceIds: Set<string>
  private readonly directoryUpdates: StatefulHmrDirectoryUpdates
  private entryGraphRevision = 0
  private rebuiltEntryGraphRevision = 0
  // 分类由实际源事件持有，避免其他侧车事件覆盖全局诊断信息后误判当前批次。
  private readonly sourceDirtyReasons = new Map<string, { reasons: string[] }>()
  private readonly sourceChangeListener = (file: string, dirtyReasonSummary: string[]) => {
    this.handleSourceUpdate(file, dirtyReasonSummary)
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
    this.directoryUpdates = new StatefulHmrDirectoryUpdates(server.config.root)
    this.emittedSourceIds = collectStatefulHmrEmittedSourceIds(snapshots.initial.output, server.config.root)
    this.directoryUpdates.seedSources([...this.entryIds, ...this.emittedSourceIds])
    this.initialSnapshot = snapshots.initial
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
    )
    this.delivery = new HmrDeliveryCoordinator((error) => {
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
      onOutput: (output, source) => this.handleOutput(output, source),
      onBatch: batch => this.handleBatch(batch),
      onPatch: (files, output) => this.handleBatch({ changedFiles: files, updates: [{ clientId: 'weapp-vite-stateful-hmr', update: output }] }),
      waitForInitialBundle: () => this.waitForInitialBundle(),
    }, devWatchOptions)
    this.snapshotScheduler = new StatefulHmrSnapshotScheduler({
      execute: batch => this.diagnostics
        ? this.diagnostics.batch(batch, batchId => this.executeSnapshotBatch(batch, batchId))
        : this.executeSnapshotBatch(batch),
      onError: (error) => {
        const failure = error instanceof Error ? error : new Error(String(error))
        this.buildEvents.emitEvent({ code: 'ERROR', error: failure, result: undefined as never })
        this.server.config.logger.error('[weapp-vite] stateful HMR snapshot refresh failed', { error: failure })
      },
    })
  }

  install(): void {
    this.transport.install()
    this.adapter.install()
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

  async watchAssets(): Promise<void> {
    this.assetWatcher = watchAssetSources(this.ctx.configService, {
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

  async close(): Promise<void> {
    this.closed = true
    getCompilerHmrHost(this.ctx).onDependencyChange = undefined
    await this.assetWatcher?.close()
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
    }
    if (this.ctx.onStatefulHmrSourceChange === this.sourceChangeListener) {
      this.ctx.onStatefulHmrSourceChange = undefined
    }
    this.transport.close()
    await this.delivery.close()
    await this.snapshotScheduler.close()
    this.sourceDirtyReasons.clear()
    await this.outputChain
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

  handleSourceUpdate(file: string, dirtyReasonSummary: string[] = []): void {
    const normalizedFile = normalizeFsResolvedId(path.isAbsolute(file) ? file : path.resolve(this.server.config.root, file))
    this.diagnostics?.source(normalizedFile, dirtyReasonSummary)
    const normalizedOutDir = normalizeFsResolvedId(this.ctx.configService!.outDir).replace(/\/$/, '')
    if (normalizedFile === normalizedOutDir || normalizedFile.startsWith(`${normalizedOutDir}/`)) {
      return
    }
    const event = this.ctx.moduleGraphService.getPendingChanges?.().find(change => change.file === normalizedFile)?.event
    if (this.directoryUpdates.observe(normalizedFile, event)) {
      return
    }
    if (dirtyReasonSummary.includes(ENTRY_GRAPH_CHANGE_REASON)) {
      this.entryGraphRevision += 1
      this.requestFullBuild([normalizedFile])
      return
    }
    this.sourceDirtyReasons.set(normalizedFile, { reasons: [...dirtyReasonSummary] })
    if (this.publicAssetSources.matchesPath(normalizedFile)) {
      this.requestSnapshotRefresh([normalizedFile])
      return
    }
    if (shouldRestartStatefulHmrServer(
      [normalizedFile],
      this.ctx.configService?.configFileDependencies,
      this.ctx.configService?.weappViteConfig?.react,
    )) {
      this.requestServerRestart()
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
    if (getCompilerHmrHost(this.ctx).ownsDependency(normalizedFile) || dirtyReasonSummary.some(reason => isCompilerContentDirtyReason(reason) || reason.startsWith('entry-mixed-asset:'))) {
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
    const outputTask = this.enqueueOutput(async () => {
      if (snapshotBatch?.isSuperseded()) {
        this.diagnostics?.discarded(snapshotBatch.traceBatchId, 'before-output')
        return
      }
      const snapshot = snapshotBatch?.snapshot ?? this.initialSnapshot
      const snapshotOutput = snapshot ? this.createSnapshotAssets(snapshot) : undefined
      const compatibleOutput = createStatefulHmrGlobalStyleAssets(
        await transformOutput(output, Boolean(this.server.config.build.sourcemap)),
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
      if (fullBuild) {
        for (const item of snapshotOutput ?? this.snapshotAssets.values()) {
          if (isStatefulHmrSnapshotAsset(item)) {
            this.uncommittedSnapshotAssetNames.add(item.fileName)
          }
        }
      }
      const currentOutputFiles = new Set(compatibleOutput.map(item => item.fileName))
      await this.writeOutput(
        fullBuild ? 'full' : 'additional',
        fullBuild
          ? compatibleOutput
          : selectStatefulHmrAdditionalOutput(compatibleOutput, snapshotOutput ?? this.snapshotAssets.values()),
        fullBuild && this.initialSnapshot
          ? { publicDir: this.server.config.publicDir, copyPublicDir: this.server.config.build.copyPublicDir }
          : undefined,
        snapshotBatch?.traceBatchId,
        fullBuild ? [...new Set([...this.snapshotAssets.keys(), ...this.uncommittedSnapshotAssetNames])].filter(file => !currentOutputFiles.has(file)) : [],
      )
      if (buildId) {
        this.delivery.reset()
        this.transport.commitFullBuild(buildId)
        getCompilerHmrHost(this.ctx).setNativeSources(collectStatefulHmrEmittedSourceIds(compatibleOutput, this.server.config.root))
        this.transport.registerInitialPayloads(compatibleOutput.filter(item => item.type === 'chunk').map(item => item.fileName), file => this.adapter.markPayloadDelivered(file))
        if (snapshot && snapshotOutput) {
          this.adoptSnapshot(snapshot, snapshotOutput)
          this.initialSnapshot = undefined
        }
        for (const sourceId of collectStatefulHmrEmittedSourceIds(compatibleOutput, this.server.config.root)) {
          this.emittedSourceIds.add(sourceId)
        }
        if (!snapshotBatch?.isSuperseded()) {
          this.directoryUpdates.seedSources([...this.entryIds, ...this.emittedSourceIds])
        }
        const moduleCount = await this.adapter.registerBundleModules(compatibleOutput)
        if (snapshotBatch) {
          snapshotBatch.fullOutputCommitted = true
        }
        else {
          if (snapshot) {
            this.commitGlassEaselAnalysis(snapshot, 'full')
          }
          this.buildEvents.emitEvent({ code: 'END' })
        }
        this.server.config.logger.info(`[weapp-vite] 微信状态保持 HMR 已就绪（${moduleCount} modules）`)
        this.initialBundle.resolve()
      }
    })
    snapshotBatch?.outputTasks.push(outputTask)
    void outputTask.catch((error) => {
      if (!snapshotBatch && this.initialSnapshot) {
        this.initialBundle.reject(error)
      }
    })
    return outputTask
  }

  private handleBatch(batch: StatefulHmrDevEngineBatch): boolean {
    this.diagnostics?.delivery('received', 0, batch.changedFiles)
    let files = batch.changedFiles.map(file => normalizeFsResolvedId(path.isAbsolute(file) ? file : path.resolve(this.server.config.root, file)))
    const updates = batch.updates.filter(item => item.update.type !== 'Noop')
    const output = updates[0]?.update ?? { type: 'Noop' as const }
    files = this.directoryUpdates.consume(files)
    const dirtyReasonSummary = [...new Set(files.flatMap((file) => {
      const source = normalizeFsResolvedId(path.isAbsolute(file) ? file : path.resolve(this.server.config.root, file))
      const reasons = this.sourceDirtyReasons.get(source)?.reasons ?? []
      this.sourceDirtyReasons.delete(source)
      return reasons
    }))]
    if (this.resynchronizing) {
      this.snapshotScheduler.request('full', files)
      return false
    }
    if (this.entryGraphRevision !== this.rebuiltEntryGraphRevision) {
      return false
    }
    const compilerOnly = files.length > 0 && files.every(file => getCompilerHmrHost(this.ctx).ownsDependency(file)
      && (isStatefulHmrAssetFile(file) || (!this.emittedSourceIds.has(file) && !this.entryIds.has(file) && !getCompilerHmrHost(this.ctx).isNativeSource(file))))
    if ((output.type === 'Noop' && !compilerOnly) || files.length === 0) {
      return false
    }
    const input = getCompilerHmrHost(this.ctx).freeze(files)
    this.diagnostics?.input(input)

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
        this.requestFullBuild(files)
      }
      return false
    }
    if (!getCompilerHmrHost(this.ctx).supported) {
      this.requestFullBuild(files)
      return false
    }
    this.diagnostics?.delivery('captured', input.revision, files)
    // 编译器扫描依赖不代表接管了原生资产写出；非脚本资源仍走固定输入快照。
    const needsSnapshot = files.some(file => requiresStatefulHmrSnapshot(file)) || (!getCompilerHmrHost(this.ctx).enabled && allowCompilerContentPatch) || (dirtyReasonSummary.some(reason => reason.startsWith('entry-mixed-asset:'))
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
      this.requestFullBuild(files)
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
    this.delivery.enqueue({
      bytes: patches.reduce((bytes, item) => bytes + (item.update.type === 'Patch' ? Buffer.byteLength(item.update.code) : 0), 0),
      prepare: async () => {
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
          })
          const { compilerAssets, snapshot, code, changedIds, filenames } = compiled
          if (shouldResetStatefulHmrRetention(this.transport.retainedDeltaCount, this.transport.retainedDeltaBytes, Buffer.byteLength(code))) {
            this.requestFullBuild(files)
          }
          return {
            commit: () => this.enqueueOutput(async () => {
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
              await this.commitSnapshotAssets(next)
              if (snapshot) {
                this.adoptSnapshot(snapshot, next)
                this.commitGlassEaselAnalysis(snapshot, 'refresh')
              }
            }),
            publish: async () => {
              this.diagnostics?.delivery('publish', input.revision, files)
              if (!filenames.length) {
                this.buildEvents.emitEvent({ code: 'END' })
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
              this.buildEvents.emitEvent({ code: 'END' })
            },
            dispose: compiled.dispose,
          }
        }
        catch (error) {
          preparation = undefined
          throw error
        }
      },
    })
    return true
  }

  private requestFullBuild(files: Iterable<string> = []): void {
    this.resynchronizing = true
    this.delivery.reset()
    this.transport.cancelPendingDeliveries()
    if (this.diagnostics) {
      files = [...files]
      this.diagnostics.request('full', files as string[])
    }
    this.snapshotScheduler.request('full', files)
  }

  private requestSnapshotRefresh(files: Iterable<string> = []): void {
    if (this.diagnostics) {
      files = [...files]
      this.diagnostics.request('refresh', files as string[])
    }
    this.snapshotScheduler.request('refresh', files)
  }

  private requestServerRestart(): void {
    if (this.restartTimer) {
      return
    }
    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined
      void this.restart().catch((error) => {
        const failure = error instanceof Error ? error : new Error(String(error))
        this.buildEvents.emitEvent({ code: 'ERROR', error: failure, result: undefined as never })
        this.server.config.logger.error('[weapp-vite] stateful HMR server restart failed', { error: failure })
      })
    }, 100)
  }

  private enqueueOutput(task: () => Promise<void>): Promise<void> {
    const outputTask = this.outputChain.then(task)
    // 队列尾部恢复只保证后续任务可执行，当前调用方仍需收到实际写入失败。
    this.outputChain = outputTask.catch((error) => {
      this.server.config.logger.error(`[weapp-vite] stateful HMR output failed: ${formatStatefulHmrError(error)}`)
    })
    return outputTask
  }

  private writeOutput(
    kind: 'control' | 'delta' | 'full' | 'additional' | 'refresh',
    output: StatefulHmrOutputFile[],
    initialPublicAssets?: StatefulHmrInitialPublicAssets,
    batchId?: number,
    removedAssets: string[] = [],
  ): Promise<void> {
    const write = () => writeStatefulHmrOutput(this.ctx.configService!.outDir, output, initialPublicAssets, removedAssets)
    const pending = this.diagnostics ? this.diagnostics.write({ kind, batchId }, output, write) : write()
    return pending.catch((error) => {
      // 原生写盘失败可能已有部分输出落盘，不能继续用旧字节快照省略下一次写入。
      this.snapshotAssetsReliable = false
      throw error
    })
  }

  private async executeSnapshotBatch(batch: {
    files: string[]
    isSuperseded: () => boolean
    mode: 'full' | 'refresh'
  }, traceBatchId?: number): Promise<void> {
    this.buildEvents.emitEvent({ code: 'START' })
    const entryGraphRevision = this.entryGraphRevision
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
    const snapshot = await this.snapshots.rebuild(batch.files)
    this.diagnostics?.snapshot(traceBatchId, snapshot.output, batch.isSuperseded())
    if (batch.isSuperseded()) {
      this.diagnostics?.discarded(traceBatchId, 'after-build')
      return
    }
    const nextEntryIds = snapshot.entryIds?.map(id => normalizeFsResolvedId(id))
    const entryGraphChanged = nextEntryIds !== undefined && (
      nextEntryIds.length !== this.entryIds.size || nextEntryIds.some(id => !this.entryIds.has(id))
    )
    if (entryGraphChanged) {
      if (this.entryGraphRevision === this.rebuiltEntryGraphRevision) {
        // app.json 等元数据可能直接暴露拓扑差异；显式冻结旧引擎的 patch 接受窗口。
        this.entryGraphRevision += 1
      }
      // DevEngine 的入口图在创建时固定；拓扑变化必须由全新扫描与引擎接管。
      // 延迟重启让当前批次先退出，避免 close() 等待本批次形成自锁。
      this.requestServerRestart()
      return
    }
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
          releaseSourceChanges()
          this.commitGlassEaselAnalysis(snapshot, 'full')
          this.buildEvents.emitEvent({ code: 'END' })
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
      await this.commitSnapshotAssets(output, traceBatchId, batch.isSuperseded())
      // 写盘期间到达的新事件仍须以实际落盘内容为基线；分析事实只提交未被取代的批次。
      this.adoptSnapshot(snapshot, output)
      if (batch.isSuperseded()) {
        return
      }
      this.commitGlassEaselAnalysis(snapshot, 'refresh')
      this.buildEvents.emitEvent({ code: 'END' })
    })
  }

  /** 快照刷新与编译批次共享资产提交、删除及失败恢复基线。 */
  private async commitSnapshotAssets(output: StatefulHmrOutputFile[], traceBatchId?: number, superseded = false): Promise<void> {
    const changedOutput = this.snapshotAssetsReliable
      ? getChangedStatefulHmrSnapshotAssets(this.snapshotAssets.values(), output)
      : output.filter(isStatefulHmrSnapshotAsset)
    this.diagnostics?.diff(traceBatchId, this.snapshotAssets.values(), output, changedOutput, superseded)
    const currentNames = new Set(output.map(item => item.fileName))
    const removedAssets = [...new Set([...this.snapshotAssets.keys(), ...this.uncommittedSnapshotAssetNames])]
      .filter(file => !currentNames.has(file))
    // 写盘失败可能已有部分新资产落盘，后续两种交付路径都必须能够撤销。
    for (const item of changedOutput) {
      if (isStatefulHmrSnapshotAsset(item)) {
        this.uncommittedSnapshotAssetNames.add(item.fileName)
      }
    }
    if (changedOutput.length || removedAssets.length) {
      await this.writeOutput('refresh', changedOutput, undefined, traceBatchId, removedAssets)
    }
    this.snapshotAssetsReliable = true
    this.uncommittedSnapshotAssetNames.clear()
    this.snapshotAssets = new Map(output.filter(isStatefulHmrSnapshotAsset).map(item => [item.fileName, item]))
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

  private commitGlassEaselAnalysis(snapshot: StatefulHmrSnapshot, mode: 'full' | 'refresh'): void {
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

  private adoptSnapshot(snapshot: StatefulHmrSnapshot, output: StatefulHmrOutputFile[]): void {
    this.snapshotAssetsReliable = true
    this.uncommittedSnapshotAssetNames.clear()
    this.componentPageGlobalStyleRoutes = [...snapshot.componentPageGlobalStyleRoutes]
    this.snapshotAssets = new Map(
      output
        .filter(isStatefulHmrSnapshotAsset)
        .map(item => [item.fileName, item]),
    )
  }

  private async waitForInitialBundle(): Promise<void> {
    await this.initialBundle.promise
    await this.outputChain
  }
}

export function shouldRestartStatefulHmrServer(
  files: Iterable<string>,
  configFileDependencies: Iterable<string> = [],
  react?: Parameters<typeof isReactStaticTemplateSource>[0],
): boolean {
  const normalizedConfigDependencies = new Set(
    Array.from(configFileDependencies, dependency => normalizeFsResolvedId(dependency)),
  )
  return Array.from(files).some(file =>
    normalizedConfigDependencies.has(normalizeFsResolvedId(file))
    || isReactStaticTemplateSource(react, file),
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
): RolldownWatcher {
  let closePromise: Promise<void> | undefined
  const watcher: RolldownWatcher = {
    ...buildEvents.watcher,
    close() {
      closePromise ??= (async () => {
        try {
          await session.close()
        }
        finally {
          await server.close()
        }
      })()
      return closePromise
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

export function redirectNativeComponentRegistration(code: string): string {
  if (!code.includes('Component')) {
    return code
  }
  const ast = parseJsLike(code)
  const magicString = new MagicString(code)
  let changed = false
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (
        callee.type !== 'Identifier'
        || callee.name !== 'Component'
        || path.scope.hasBinding('Component')
        || callee.start == null
        || callee.end == null
      ) {
        return
      }
      magicString.overwrite(
        callee.start,
        callee.end,
        `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].Component`,
      )
      changed = true
    },
  })
  return changed ? magicString.toString() : code
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
  return /^(?:entry-json-only|entry-local-asset|entry-style-only|entry-mixed-config|react-template|compiler-content|tailwind-content):/.test(reason)
}

/** 编译 provider 触发的内容变化使用统一 reason 前缀，保留旧 Tailwind reason 兼容。 */
export function isCompilerContentDirtyReason(reason: string): boolean {
  return /^(?:compiler-content|tailwind-content):/.test(reason)
}

export function shouldUseStatefulHmrSnapshotOnly(dirtyReasonSummary: string[]): boolean {
  const hasAssetOnlyEntry = dirtyReasonSummary.some(reason =>
    /^(?:entry-json-only|entry-local-asset|entry-style-only):/.test(reason),
  )
  return hasAssetOnlyEntry && dirtyReasonSummary.every(reason =>
    /^(?:entry-json-only|entry-local-asset|entry-style-only|compiler-content|tailwind-content):/.test(reason),
  )
}

function isNonJavaScriptSidecarId(id: string): boolean {
  const sidecar = parseSidecarSourceRequest(id) ?? parseSidecarModuleId(id)
  return sidecar !== undefined && sidecar.kind !== 'script' && sidecar.kind !== 'jsx'
}

async function transformOutput(output: StatefulHmrOutputFile[], sourcemap: boolean): Promise<StatefulHmrOutputFile[]> {
  const mapFiles = new Set(output.flatMap(item => item.type === 'chunk' ? [item.sourcemapFileName ?? `${item.fileName}.map`] : []))
  return await Promise.all(output.filter(item => !mapFiles.has(item.fileName)).map(async (item) => {
    if (item.type !== 'chunk') {
      return item
    }
    const code = item.code.replace(/^\/\/[#@] sourceMappingURL=.*$/gm, '')
    const result = await transformWithOxc(code, item.fileName, {
      assumptions: { setPublicClassFields: true },
      lang: 'js',
      sourcemap,
      target: 'es2018',
      tsconfig: false,
    })
    return {
      ...item,
      code: wrapHmrCode({
        code: result.code,
        filename: item.fileName,
        map: sourcemap ? composeSourceMaps(normalizeEncodedSourceMapLike(result.map), normalizeEncodedSourceMapLike(item.map)) : null,
      }),
    }
  }))
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
