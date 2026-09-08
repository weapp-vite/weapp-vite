/* eslint-disable ts/no-use-before-define */

import type { RolldownWatcher } from 'rolldown'
import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrDevEngineUpdate } from './viteAdapter'
import { Buffer } from 'node:buffer'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import MagicString from 'magic-string'
import path from 'pathe'
import { createServer, transformWithOxc } from 'vite'
import { logger } from '../../context/shared'
import { parseSidecarModuleId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { ENTRY_GRAPH_CHANGE_REASON } from '../../plugins/hooks/useLoadEntry/entryChunkLifecycle'
import { isReactStaticTemplateSource } from '../../plugins/react'
import { parseJsLike, traverse } from '../../utils/babel'
import { resolveOutputExtensions } from '../../utils/outputExtensions'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { createViteWatchIgnored, resolvePollingWatchOptions } from '../watch/options'
import { isStatefulHmrBoundary } from './boundaries'
import { StatefulHmrDirectoryUpdates } from './directoryUpdates'
import { createStatefulHmrGlobalStyleAssets } from './globalStyles'
import { registerStatefulHmrInitialChunkLoaders } from './initialChunkLoaders'
import { createStatefulHmrInitialGraph } from './initialModuleGraph'
import { isChangedNativeComponentSidecar } from './nativeComponentSidecar'
import { selectStatefulHmrAdditionalOutput } from './outputOwnership'
import { writeStatefulHmrOutput } from './outputWriter'
import { createStatefulHmrControlSource } from './runtimeSource'
import { createStatefulHmrSidecarPlugin } from './sidecarPlugin'
import { StatefulHmrSnapshotScheduler } from './snapshotScheduler'
import { StatefulHmrTransport } from './transport'
import { StatefulHmrViteAdapter } from './viteAdapter'

export { isStatefulHmrBoundary } from './boundaries'

const maxRetainedDeltaCount = 1_000
const maxRetainedDeltaBytes = 16 * 1024 * 1024

interface StatefulHmrSnapshots {
  entryIds: Iterable<string>
  delegatedComponentEntryIds?: Iterable<string>
  initial: StatefulHmrSnapshot
  rebuild: (files: string[]) => Promise<StatefulHmrSnapshot>
}

interface ActiveSnapshotBatch {
  isSuperseded: () => boolean
  outputTasks: Promise<void>[]
  snapshot: StatefulHmrSnapshot
}

export async function runStatefulHmrDev(
  ctx: MutableCompilerContext,
  buildOptions: InlineConfig,
  restart: () => Promise<void>,
  snapshots: StatefulHmrSnapshots,
): Promise<RolldownWatcher> {
  const configService = ctx.configService!
  if (configService.platform !== 'weapp') {
    throw new Error('weapp.hmr.runtime="stateful-experimental" 目前仅支持微信小程序平台。')
  }
  let session: StatefulHmrSession | undefined
  const entryIds = new Set(Array.from(snapshots.entryIds, id => normalizeFsResolvedId(id)))
  const delegatedComponentEntryIds = new Set(Array.from(snapshots.delegatedComponentEntryIds ?? [], id => normalizeFsResolvedId(id)))
  const pollingWatchOptions = resolvePollingWatchOptions(configService)
  const installPlugin: Plugin = {
    name: 'weapp-vite:stateful-hmr-session',
    enforce: 'post',
    configureServer(server) {
      const currentSession = new StatefulHmrSession(ctx, server, restart, entryIds, snapshots, {
        compareContentsForPolling: pollingWatchOptions.usePolling === true ? true : undefined,
        pollInterval: pollingWatchOptions.interval,
        usePolling: pollingWatchOptions.usePolling,
      }, delegatedComponentEntryIds)
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
        return { code: `${code}${createStatefulHmrInitialGraph(chunk, this, configService.cwd)}`, map: null }
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
    plugins: [createStatefulHmrSidecarPlugin(), installPlugin, ...(buildOptions.plugins ?? [])],
    server: {
      ...(buildOptions.server ?? {}),
      host: '127.0.0.1',
      port: 0,
      watch: {
        ...(buildOptions.server?.watch ?? {}),
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
    await session.refreshControl()
    return createWatcherAdapter(server, session)
  }
  catch (error) {
    await session?.close().catch(() => {})
    await server.close().catch(() => {})
    throw error
  }
}

class StatefulHmrSession {
  private activeSnapshotBatch?: ActiveSnapshotBatch
  private readonly adapter: StatefulHmrViteAdapter
  private readonly initialBundle = Promise.withResolvers<void>()
  private readonly snapshotScheduler: StatefulHmrSnapshotScheduler
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
  private readonly sourceChangeListener = (file: string, dirtyReasonSummary: string[]) => {
    this.handleSourceUpdate(file, dirtyReasonSummary)
  }

  constructor(
    private readonly ctx: MutableCompilerContext,
    private readonly server: ViteDevServer,
    private readonly restart: () => Promise<void>,
    private readonly entryIds: Set<string>,
    private readonly snapshots: StatefulHmrSnapshots,
    devWatchOptions: { compareContentsForPolling?: boolean, pollInterval?: number, usePolling?: boolean },
    private readonly delegatedComponentEntryIds: Set<string>,
  ) {
    // DevEngine 可能先交付失败输出、随后才等待首轮就绪；保留拒绝结果但提前订阅。
    void this.initialBundle.promise.catch(() => {})
    this.directoryUpdates = new StatefulHmrDirectoryUpdates(server.config.root)
    this.emittedSourceIds = collectStatefulHmrEmittedSourceIds(snapshots.initial.output, server.config.root)
    this.initialSnapshot = snapshots.initial
    this.transport = new StatefulHmrTransport(
      server,
      async (buildId, source) => {
        await this.enqueueOutput(async () => {
          if (!this.transport.isCurrentBuild(buildId)) {
            return
          }
          await writeStatefulHmrOutput(this.ctx.configService!.outDir, [{
            type: 'asset',
            fileName: WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
            source,
          }])
        })
      },
      () => this.requestFullBuild(),
    )
    this.adapter = new StatefulHmrViteAdapter(server.config, server, {
      onError: message => server.config.logger.error(`[weapp-vite] stateful HMR: ${message}`),
      onOutput: output => this.handleOutput(output),
      onPatch: (files, output) => this.handlePatch(files, output),
      waitForInitialBundle: () => this.waitForInitialBundle(),
    }, devWatchOptions)
    this.snapshotScheduler = new StatefulHmrSnapshotScheduler({
      execute: batch => this.executeSnapshotBatch(batch),
      onError: error => this.server.config.logger.error('[weapp-vite] stateful HMR snapshot refresh failed', {
        error: error instanceof Error ? error : new Error(String(error)),
      }),
    })
  }

  install(): void {
    this.transport.install()
    this.adapter.install()
    this.ctx.onStatefulHmrSourceChange = this.sourceChangeListener
  }

  async close(): Promise<void> {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
    }
    if (this.ctx.onStatefulHmrSourceChange === this.sourceChangeListener) {
      this.ctx.onStatefulHmrSourceChange = undefined
    }
    this.transport.close()
    await this.snapshotScheduler.close()
    await this.outputChain
  }

  async refreshControl(): Promise<void> {
    await this.enqueueOutput(async () => {
      await writeStatefulHmrOutput(this.ctx.configService!.outDir, [{
        type: 'asset',
        fileName: WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
        source: createStatefulHmrControlSource(this.transport.createControl()),
      }])
    })
  }

  handleSourceUpdate(file: string, dirtyReasonSummary: string[] = []): void {
    const normalizedFile = normalizeFsResolvedId(path.isAbsolute(file) ? file : path.resolve(this.server.config.root, file))
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
    if (shouldRestartStatefulHmrServer(
      [normalizedFile],
      this.ctx.configService?.configFileDependencies,
      this.ctx.configService?.weappViteConfig?.react,
    )) {
      this.requestServerRestart()
      return
    }
    const affectedEntries = this.ctx.moduleGraphService.collectAffectedEntries(normalizedFile)
    const hasTrackedModule = (this.server.moduleGraph.getModulesByFile(normalizedFile)?.size ?? 0) > 0
    const isEmittedDependency = this.emittedSourceIds.has(normalizedFile)
    if (shouldRebuildStatefulDependency(normalizedFile, this.entryIds, affectedEntries, hasTrackedModule, isEmittedDependency)) {
      this.requestFullBuild([normalizedFile])
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

  private handleOutput(output: StatefulHmrOutputFile[]): void {
    const snapshotBatch = this.activeSnapshotBatch
    const outputTask = this.enqueueOutput(async () => {
      if (snapshotBatch?.isSuperseded()) {
        return
      }
      const snapshot = snapshotBatch?.snapshot ?? this.initialSnapshot
      const snapshotOutput = snapshot ? this.createSnapshotAssets(snapshot) : undefined
      const compatibleOutput = createStatefulHmrGlobalStyleAssets(
        await transformOutput(output),
        resolveOutputExtensions(this.ctx.configService?.outputExtensions).styleExtension,
        { componentPageGlobalStyleRoutes: snapshot?.componentPageGlobalStyleRoutes ?? this.componentPageGlobalStyleRoutes },
      )
      if (snapshotBatch?.isSuperseded()) {
        return
      }
      const fullBuild = compatibleOutput.some(item => item.fileName === 'app.js')
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
      await writeStatefulHmrOutput(
        this.ctx.configService!.outDir,
        fullBuild
          ? compatibleOutput
          : selectStatefulHmrAdditionalOutput(compatibleOutput, snapshotOutput ?? this.snapshotAssets.values()),
        fullBuild && this.initialSnapshot
          ? { publicDir: this.server.config.publicDir, copyPublicDir: this.server.config.build.copyPublicDir }
          : undefined,
      )
      if (buildId) {
        this.transport.commitFullBuild(buildId)
        if (snapshot && snapshotOutput) {
          this.adoptSnapshot(snapshot, snapshotOutput)
          this.initialSnapshot = undefined
        }
        for (const sourceId of collectStatefulHmrEmittedSourceIds(compatibleOutput, this.server.config.root)) {
          this.emittedSourceIds.add(sourceId)
        }
        const moduleCount = await this.adapter.registerBundleModules(compatibleOutput)
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
  }

  private handlePatch(files: string[], output: StatefulHmrDevEngineUpdate): boolean {
    files = this.directoryUpdates.consume(files)
    if (this.entryGraphRevision !== this.rebuiltEntryGraphRevision) {
      return false
    }
    if (output.type === 'Noop' || files.length === 0) {
      return false
    }
    const dirtyReasonSummary = this.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary ?? []
    const allowTailwindContentPatch = dirtyReasonSummary.some(reason => reason.startsWith('tailwind-content:'))
    if (!isSafeJavaScriptPatch(
      files,
      output,
      dirtyReasonSummary,
      {
        allowTailwindContent: allowTailwindContentPatch,
        root: this.server.config.root,
        srcRoot: this.ctx.configService!.absoluteSrcRoot,
        entryIds: this.entryIds,
      },
    )) {
      if (shouldRestartStatefulHmrServer(files, this.ctx.configService?.configFileDependencies)) {
        this.requestServerRestart()
      }
      else if (
        (files.length > 0 && files.every(isStatefulHmrAssetFile))
        || shouldUseStatefulHmrSnapshotOnly(this.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary ?? [])
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
    if (allowTailwindContentPatch || dirtyReasonSummary.some(reason => reason.startsWith('entry-mixed-asset:'))) {
      // 安全的 JS patch 与模板、样式快照分别同步，混合视觉更新不能无故重载并清空交互状态。
      this.requestSnapshotRefresh(files)
    }
    void this.adapter.registerPatchModules(output.code).then(async () => {
      const code = await transformJavaScript(output.code, output.filename)
      if (
        shouldResetStatefulHmrRetention(
          this.transport.retainedDeltaCount,
          this.transport.retainedDeltaBytes,
          Buffer.byteLength(code),
        )
      ) {
        this.requestFullBuild()
        return
      }
      this.transport.addDelta(code, output.changedIds ?? [])
      return this.adapter.markPayloadDelivered(output.filename)
    }).catch((error) => {
      this.server.config.logger.error('[weapp-vite] stateful HMR patch transform failed', { error })
      this.requestFullBuild()
    })
    return true
  }

  private requestFullBuild(files: Iterable<string> = []): void {
    this.snapshotScheduler.request('full', files)
  }

  private requestSnapshotRefresh(files: Iterable<string> = []): void {
    this.snapshotScheduler.request('refresh', files)
  }

  private requestServerRestart(): void {
    if (this.restartTimer) {
      return
    }
    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined
      void this.restart().catch((error) => {
        this.server.config.logger.error('[weapp-vite] stateful HMR server restart failed', { error })
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

  private async executeSnapshotBatch(batch: {
    files: string[]
    isSuperseded: () => boolean
    mode: 'full' | 'refresh'
  }): Promise<void> {
    const entryGraphRevision = this.entryGraphRevision
    const snapshot = await this.snapshots.rebuild(batch.files)
    if (batch.isSuperseded()) {
      return
    }
    const nextEntryIds = snapshot.entryIds?.map(id => normalizeFsResolvedId(id))
    const entryGraphChanged = nextEntryIds !== undefined && (
      nextEntryIds.length !== this.entryIds.size || nextEntryIds.some(id => !this.entryIds.has(id))
    )
    if (batch.mode === 'full' || entryGraphChanged) {
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
      const activeBatch: ActiveSnapshotBatch = { ...batch, snapshot, outputTasks: [] }
      this.activeSnapshotBatch = activeBatch
      try {
        await this.adapter.rebuild()
        if (!activeBatch.outputTasks.length && !batch.isSuperseded()) {
          throw new Error('微信状态保持 HMR 完整构建未交付可持久化的输出。')
        }
        await Promise.all(activeBatch.outputTasks)
        if (!batch.isSuperseded()) {
          this.rebuiltEntryGraphRevision = entryGraphRevision
        }
      }
      finally {
        if (this.activeSnapshotBatch === activeBatch) {
          this.activeSnapshotBatch = undefined
        }
      }
      return
    }
    await this.enqueueOutput(async () => {
      if (batch.isSuperseded()) {
        return
      }
      const output = this.createSnapshotAssets(snapshot)
      const changedOutput = getChangedStatefulHmrSnapshotAssets(this.snapshotAssets.values(), output)
      await writeStatefulHmrOutput(this.ctx.configService!.outDir, changedOutput)
      this.adoptSnapshot(snapshot, output)
    })
  }

  private createSnapshotAssets(snapshot: StatefulHmrSnapshot): StatefulHmrOutputFile[] {
    return createStatefulHmrGlobalStyleAssets(
      snapshot.output,
      resolveOutputExtensions(this.ctx.configService?.outputExtensions).styleExtension,
      {
        createIfMissing: true,
        componentPageGlobalStyleRoutes: snapshot.componentPageGlobalStyleRoutes,
        previousComponentPageGlobalStyleRoutes: this.componentPageGlobalStyleRoutes,
      },
    )
  }

  private adoptSnapshot(snapshot: StatefulHmrSnapshot, output: StatefulHmrOutputFile[]): void {
    this.componentPageGlobalStyleRoutes = [...snapshot.componentPageGlobalStyleRoutes]
    this.snapshotAssets = new Map(
      output
        .filter(item => item.type === 'asset')
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
    if (asset.type !== 'asset') {
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
    Array.from(previous).flatMap(item => item.type === 'asset' ? [[item.fileName, item.source] as const] : []),
  )
  return Array.from(next).filter((item) => {
    if (item.type !== 'asset') {
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

function createWatcherAdapter(server: ViteDevServer, session: StatefulHmrSession): RolldownWatcher {
  return {
    close: async () => {
      await session.close()
      await server.close()
    },
    on() {
      return this
    },
  } as unknown as RolldownWatcher
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
  options: { allowTailwindContent?: boolean, root?: string, srcRoot?: string, entryIds?: Iterable<string> } = {},
): output is Extract<StatefulHmrDevEngineUpdate, { type: 'Patch' }> {
  return output.type === 'Patch'
    && files.every(file => /\.(?:[cm]?[jt]sx?|vue)$/.test(file))
    && !output.changedIds?.some(id => isNonJavaScriptSidecarId(id) && !isChangedNativeComponentSidecar(id, files, options))
    && !dirtyReasonSummary.some(reason => isUnsafeStatefulHmrReason(reason, options.allowTailwindContent === true))
}

export function requiresStatefulHmrSnapshot(file: string, dirtyReasonSummary: string[] = []): boolean {
  return /\.(?:jsx|tsx)$/.test(file)
    || !/\.(?:[cm]?[jt]sx?|vue)$/.test(file)
    || dirtyReasonSummary.some(reason => reason.startsWith('entry-mixed-asset:') || isUnsafeStatefulHmrReason(reason))
}

export function isStatefulHmrAssetFile(file: string): boolean {
  return !/\.(?:[cm]?[jt]sx?|vue)$/.test(file)
}

function isUnsafeStatefulHmrReason(reason: string, allowTailwindContent = false): boolean {
  if (allowTailwindContent && reason.startsWith('tailwind-content:')) {
    return false
  }
  return /^(?:entry-json-only|entry-local-asset|entry-style-only|entry-mixed-config|react-template|tailwind-content):/.test(reason)
}

export function shouldUseStatefulHmrSnapshotOnly(dirtyReasonSummary: string[]): boolean {
  const hasAssetOnlyEntry = dirtyReasonSummary.some(reason =>
    /^(?:entry-json-only|entry-local-asset|entry-style-only):/.test(reason),
  )
  return hasAssetOnlyEntry && dirtyReasonSummary.every(reason =>
    /^(?:entry-json-only|entry-local-asset|entry-style-only|tailwind-content):/.test(reason),
  )
}

function isNonJavaScriptSidecarId(id: string): boolean {
  const sidecar = parseSidecarSourceRequest(id) ?? parseSidecarModuleId(id)
  return sidecar !== undefined && sidecar.kind !== 'script' && sidecar.kind !== 'jsx'
}

export function shouldResetStatefulHmrRetention(
  retainedDeltaCount: number,
  retainedDeltaBytes: number,
  nextDeltaBytes: number,
): boolean {
  return retainedDeltaCount >= maxRetainedDeltaCount
    || retainedDeltaBytes + nextDeltaBytes >= maxRetainedDeltaBytes
}

async function transformOutput(output: StatefulHmrOutputFile[]): Promise<StatefulHmrOutputFile[]> {
  return await Promise.all(output.map(async (item) => {
    if (item.type !== 'chunk') {
      return item
    }
    return {
      ...item,
      code: await transformJavaScript(item.code, item.fileName),
    }
  }))
}

async function transformJavaScript(code: string, filename: string): Promise<string> {
  const result = await transformWithOxc(code, filename, {
    assumptions: { setPublicClassFields: true },
    lang: 'js',
    sourcemap: false,
    target: 'es2018',
    tsconfig: false,
  })
  return result.code
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
      item.code = `// weapp-vite-stateful-build:${buildId}\n${item.code}`
    }
  }
}

function formatStatefulHmrError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message
  }
  return String(error)
}
