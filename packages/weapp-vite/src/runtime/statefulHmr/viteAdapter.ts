/* eslint-disable ts/no-use-before-define */

import type { dev, DevEngine, DevOptions } from 'rolldown/experimental'
import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { GlassEaselNativeScriptUpdate } from '../../analyze/glassEasel/types'
import type { StatefulHmrOutputPublicationHooks, StatefulHmrOutputSource } from './outputPublication'
import type { StatefulHmrOutputFile } from './outputWriter'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import path from 'pathe'
import { assertStatefulHmrRuntimeOutput, createStatefulHmrRolldownRuntimeSource } from './commonRuntime'
import { resolveStatefulHmrModuleRoot, toStableModuleId } from './initialModuleGraph'
import { StatefulHmrOutputPublication } from './outputPublication'
import { createViteDevEngine } from './viteDevEngine'

export { toStableModuleId } from './initialModuleGraph'

const clientId = 'weapp-vite-stateful-hmr'
const initialBuildTimeoutMs = 60_000

async function withInitialBuildTimeout<T>(task: Promise<T>, timeoutMs = initialBuildTimeoutMs): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`stateful-experimental HMR 初始构建超时（>${timeoutMs}ms）。`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

export type StatefulHmrDevEngineUpdate
  = | { type: 'Noop' }
    | { type: 'FullReload', reason?: string }
    | {
      type: 'Patch'
      changedIds?: string[]
      code: string
      filename: string
      hmrBoundaries?: Array<{ acceptedVia: string, boundary: string }>
      seq?: number
      sourcemap?: string
      sourcemapFilename?: string
    }

export interface StatefulHmrDevEngineBatch {
  changedFiles: string[]
  updates: Array<{ clientId: string, update: StatefulHmrDevEngineUpdate }>
}

type StatefulHmrDevEngine = DevEngine & {
  registerModules?: (clientId: string, modules: string[]) => Promise<void> | void
}

type StatefulHmrDevWatchOptions = Pick<
  NonNullable<DevOptions['watch']>,
  'compareContentsForPolling' | 'pollInterval' | 'usePolling'
>

function collectRolldownAliasEntries(config: ResolvedConfig) {
  const aliases = Array.isArray(config.resolve?.alias) ? config.resolve.alias : []
  const entries: Record<string, string> = {}
  for (const alias of aliases) {
    if (typeof alias.find === 'string' && typeof alias.replacement === 'string') {
      entries[alias.find] = alias.replacement
    }
  }
  return entries
}

interface BundledDevInternal {
  _devEngine?: StatefulHmrDevEngine
  getRolldownOptions: () => Promise<Record<string, any>>
  listen: () => Promise<void>
  storeOutputFiles: (output: StatefulHmrOutputFile[], source?: StatefulHmrOutputSource) => void
}

type TrackedOutputSource = Extract<StatefulHmrOutputSource, 'additional' | 'full'>

interface TrackedChunkModules {
  moduleIds: readonly string[]
  source: TrackedOutputSource
}

function collectPatchModuleIds(code: string): Set<string> {
  const moduleIds = new Set<string>()
  const moduleIdPattern = /(?:registerFactory|create(?:Esm|Cjs)Initializer)\(\s*("(?:[^"\\]|\\.)*")/g
  for (const match of code.matchAll(moduleIdPattern)) {
    try {
      const moduleId: unknown = JSON.parse(match[1]!)
      if (typeof moduleId === 'string') {
        moduleIds.add(moduleId)
      }
    }
    catch {
      // Rolldown 生成的模块 ID 使用 JSON 字符串；不完整 payload 交由原有 patch 路径处理。
    }
  }
  return moduleIds
}

export class StatefulHmrViteAdapter {
  private readonly stopping = Promise.withResolvers<void>()
  private startTask?: Promise<void>
  private closeTask?: Promise<void>
  private engineCloseTask?: { engine: StatefulHmrDevEngine, task: Promise<void> }
  private restore?: () => void
  private closed = false
  private bundledDev?: BundledDevInternal
  private engine?: StatefulHmrDevEngine
  private initialOutputError?: Error
  private initialRuntimeValidated = false
  private expectingFullOutput = false
  private readonly publication = new StatefulHmrOutputPublication()
  private readonly chunkModulesByFile = new Map<string, TrackedChunkModules>()
  private readonly outputFilesByModuleId = new Map<string, Set<string>>()
  private readonly sourceOnlyModuleIds = new Set<string>()

  constructor(
    private readonly config: ResolvedConfig,
    private readonly server: ViteDevServer,
    private readonly callbacks: {
      onError: (message: string) => void
      onOutput: (output: StatefulHmrOutputFile[], source: StatefulHmrOutputSource) => void | Promise<void>
      onBatch?: (batch: StatefulHmrDevEngineBatch) => void
      onPatch: (files: string[], output: StatefulHmrDevEngineUpdate) => boolean
      waitForInitialBundle: () => Promise<void>
    },
    private readonly watchOptions: StatefulHmrDevWatchOptions = {},
    private readonly createDevEngine: typeof dev = createViteDevEngine,
    private readonly initialBuildTimeout = initialBuildTimeoutMs,
  ) {
    void this.stopping.promise.catch(() => {})
  }

  install(): void {
    const bundledDev = this.server.environments.client.bundledDev as unknown as BundledDevInternal | undefined
    if (!bundledDev) {
      throw new Error('stateful-experimental HMR 需要 Vite experimental.bundledDev。')
    }
    if (typeof bundledDev.getRolldownOptions !== 'function' || typeof bundledDev.storeOutputFiles !== 'function' || typeof bundledDev.listen !== 'function') {
      throw new TypeError('当前 Vite bundled-development 私有 API 与 weapp-vite 不兼容。')
    }
    if (this.bundledDev || this.closed) {
      throw new Error('stateful HMR 适配器不能重复安装或在关闭后安装。')
    }
    this.bundledDev = bundledDev
    // DevEngine 直接运行插件 watchChange；Vite 容器不能再为同一文件触发第二轮失效。
    const container = this.server.environments.client.pluginContainer
    const originalWatchChange = container?.watchChange
    const originals = {
      getRolldownOptions: bundledDev.getRolldownOptions,
      storeOutputFiles: bundledDev.storeOutputFiles,
      listen: bundledDev.listen,
    }
    const ignoreDuplicateChange = async () => {}
    if (container) {
      container.watchChange = ignoreDuplicateChange
    }
    this.installOptions(bundledDev)
    this.installOutput(bundledDev)
    this.installListener(bundledDev)
    const installed = {
      getRolldownOptions: bundledDev.getRolldownOptions,
      storeOutputFiles: bundledDev.storeOutputFiles,
      listen: bundledDev.listen,
    }
    this.restore = () => {
      for (const key of Object.keys(originals) as Array<keyof typeof originals>) {
        if (bundledDev[key] === installed[key]) {
          Reflect.set(bundledDev, key, originals[key])
        }
      }
      if (container?.watchChange === ignoreDuplicateChange) {
        container.watchChange = originalWatchChange!
      }
    }
  }

  async start(): Promise<void> {
    if (!this.bundledDev || this.closed) {
      throw new Error('stateful HMR 适配器尚未安装或已经关闭。')
    }
    await this.bundledDev.listen()
  }

  close(): Promise<void> {
    return this.closeTask ??= (async () => {
      this.closed = true
      this.stopping.reject(new Error('stateful HMR 适配器已关闭。'))
      await this.startTask?.catch(() => {})
      try {
        await this.stopEngine()
      }
      finally {
        this.restore?.()
      }
    })()
  }

  /**
   * 在入口图交接开始时先停掉旧 DevEngine，避免它在源文件删除后继续构建旧入口图。
   * 适配器本身仍由会话 close() 负责收尾，新的宿主可以安全接管 bundledDev。
   */
  async stopEngineForRestart(): Promise<void> {
    await this.stopEngine()
  }

  private stopEngine(): Promise<void> {
    const engine = this.engine
    if (!engine) {
      return Promise.resolve()
    }
    if (this.engineCloseTask?.engine === engine) {
      return this.engineCloseTask.task
    }
    const task = Promise.resolve(engine.close()).finally(() => {
      if (this.bundledDev?._devEngine === engine && this.bundledDev) {
        this.bundledDev._devEngine = undefined
      }
    })
    this.engineCloseTask = { engine, task }
    return task
  }

  async rebuild(prepare?: () => void | Promise<void>): Promise<void> {
    const engine = this.bundledDev?._devEngine
    if (!engine) {
      throw new Error('Vite DevEngine 未初始化，无法执行 stateful HMR 完整刷新。')
    }
    try {
      await this.publication.rebuild(engine, this.initialBuildTimeout, prepare, {
        onFullBuildRequested: () => {
          this.expectingFullOutput = true
        },
        onFullOutputReceived: () => {
          this.expectingFullOutput = false
        },
      } satisfies StatefulHmrOutputPublicationHooks)
    }
    finally {
      this.expectingFullOutput = false
    }
  }

  async registerBundleModules(output: StatefulHmrOutputFile[]): Promise<number> {
    const moduleIds = new Set<string>()
    for (const item of output) {
      if (item.type !== 'chunk') {
        continue
      }
      for (const match of item.code.matchAll(/registerModule\("([^"]+)"/g)) {
        moduleIds.add(match[1]!)
      }
      for (const id of Object.keys(item.modules ?? {})) {
        const normalized = toStableModuleId(id, resolveStatefulHmrModuleRoot(this.config.root, this.config.build?.rolldownOptions.cwd))
        if (!moduleIds.has(normalized)) {
          moduleIds.add(normalized)
        }
      }
    }
    await this.registerModules([...moduleIds])
    return moduleIds.size
  }

  async registerPatchModules(code: string): Promise<void> {
    await this.registerModules([...collectPatchModuleIds(code)])
  }

  async markPayloadDelivered(filename: string): Promise<void> {
    await this.markPayloadsDelivered([filename])
  }

  async waitForNativeUpdates(): Promise<void> {
    const engine = this.bundledDev?._devEngine
    await engine?.ensureCurrentBuildFinish()
    if (engine && (await engine.getBundleState()).lastBuildErrored) {
      throw new Error('微信状态保持 HMR 当前原生构建失败。')
    }
  }

  /** 外部验收还必须等待原生回调异步发布；内部编译回调只等待引擎，避免自等待。 */
  async whenSettled(): Promise<void> {
    await this.waitForNativeUpdates()
    await this.publication.whenSettled()
    if (this.closed) {
      throw new Error('Stateful HMR adapter closed before settlement')
    }
  }

  async collectGlassEaselScriptUpdates(
    patchCode: string,
    changedIds: readonly string[],
  ): Promise<GlassEaselNativeScriptUpdate[]> {
    const engine = this.bundledDev?._devEngine
    if (!engine) {
      throw new Error('Vite DevEngine 未初始化，无法读取 GlassEasel 模块事实。')
    }
    await engine.ensureCurrentBuildFinish()
    const bundleState = await engine.getBundleState()
    if (bundleState.lastBuildErrored) {
      return []
    }

    return this.captureGlassEaselScriptUpdates(patchCode, changedIds)
  }

  captureGlassEaselScriptUpdates(patchCode: string, changedIds: readonly string[]): GlassEaselNativeScriptUpdate[] {
    const engine = this.bundledDev?._devEngine
    if (!engine) {
      throw new Error('Vite DevEngine 未初始化，无法读取 GlassEasel 模块事实。')
    }
    const root = resolveStatefulHmrModuleRoot(this.config.root, this.config.build?.rolldownOptions.cwd)
    const rawModuleIdsByStableId = new Map<string, string[]>()
    for (const rawId of engine.moduleGraph.getModuleIds()) {
      const stableId = toStableModuleId(rawId, root)
      const rawIds = rawModuleIdsByStableId.get(stableId)
      if (rawIds) {
        rawIds.push(rawId)
      }
      else {
        rawModuleIdsByStableId.set(stableId, [rawId])
      }
    }

    const coveredStableIds = new Set<string>()
    for (const id of changedIds) {
      coveredStableIds.add(toStableModuleId(id, root))
    }
    for (const id of collectPatchModuleIds(patchCode)) {
      coveredStableIds.add(toStableModuleId(id, root))
    }

    const affectedFiles = new Set<string>()
    for (const stableId of coveredStableIds) {
      for (const file of this.outputFilesByModuleId.get(stableId) ?? []) {
        affectedFiles.add(file)
      }
    }

    const updates: GlassEaselNativeScriptUpdate[] = []
    for (const file of [...affectedFiles].sort()) {
      const tracked = this.chunkModulesByFile.get(file)
      if (!tracked) {
        continue
      }
      const modules: Array<{ id: string, code: string }> = []
      const includedRawIds = new Set<string>()
      let hasModuleWithoutCode = false
      for (const previousRawId of tracked.moduleIds) {
        const stableId = toStableModuleId(previousRawId, root)
        for (const rawId of rawModuleIdsByStableId.get(stableId) ?? []) {
          if (includedRawIds.has(rawId)) {
            continue
          }
          const moduleInfo = engine.moduleGraph.getModuleInfo(rawId)
          if (!moduleInfo) {
            continue
          }
          const code = moduleInfo.code
          if (typeof code !== 'string') {
            // 当前模块仍存在但没有可靠代码；保留整个 chunk 的上一份事实，不能按空模块清除。
            hasModuleWithoutCode = true
            break
          }
          includedRawIds.add(rawId)
          modules.push({ id: rawId, code })
        }
        if (hasModuleWithoutCode) {
          break
        }
      }
      if (!hasModuleWithoutCode) {
        modules.sort((left, right) => left.id.localeCompare(right.id))
        updates.push({ file, modules })
        for (const module of modules) {
          this.sourceOnlyModuleIds.delete(module.id)
        }
      }
    }

    const emittedSourceIds = new Set<string>()
    for (const stableId of [...coveredStableIds].sort()) {
      if (this.outputFilesByModuleId.has(stableId)) {
        continue
      }
      for (const rawId of rawModuleIdsByStableId.get(stableId) ?? []) {
        if (emittedSourceIds.has(rawId)) {
          continue
        }
        const moduleInfo = engine.moduleGraph.getModuleInfo(rawId)
        if (!moduleInfo) {
          continue
        }
        const code = moduleInfo.code
        if (typeof code !== 'string') {
          continue
        }
        emittedSourceIds.add(rawId)
        this.sourceOnlyModuleIds.add(rawId)
        updates.push({
          file: rawId,
          modules: [{ id: rawId, code }],
          sourceOnly: true,
        })
      }
    }
    for (const rawId of this.sourceOnlyModuleIds) {
      if (!rawModuleIdsByStableId.get(toStableModuleId(rawId, root))?.includes(rawId)) {
        updates.push({ file: rawId, modules: [], sourceOnly: true })
        this.sourceOnlyModuleIds.delete(rawId)
      }
    }
    return updates
  }

  private async registerModules(moduleIds: string[]): Promise<void> {
    const engine = this.bundledDev?._devEngine
    if (moduleIds.length && typeof engine?.registerModules === 'function') {
      await engine.registerModules(clientId, moduleIds)
    }
  }

  private async markPayloadsDelivered(filenames: string[]): Promise<void> {
    const engine = this.bundledDev?._devEngine
    if (typeof engine?.notifyPayloadDelivered !== 'function') {
      return
    }
    for (const filename of filenames) {
      await engine.notifyPayloadDelivered(filename)
    }
  }

  private rememberChunkModules(
    output: StatefulHmrOutputFile[],
    source: StatefulHmrOutputSource,
  ): void {
    if (source === 'partial') {
      return
    }
    if (source === 'full') {
      for (const [file, tracked] of this.chunkModulesByFile) {
        if (tracked.source === 'full') {
          this.chunkModulesByFile.delete(file)
        }
      }
    }
    for (const item of output) {
      if (item.type !== 'chunk') {
        continue
      }
      const file = item.fileName.replaceAll('\\', '/').replace(/^\.\/+/, '')
      this.chunkModulesByFile.set(file, {
        moduleIds: Object.keys(item.modules ?? {}),
        source,
      })
    }

    this.outputFilesByModuleId.clear()
    const root = resolveStatefulHmrModuleRoot(this.config.root, this.config.build?.rolldownOptions.cwd)
    for (const [file, tracked] of this.chunkModulesByFile) {
      for (const rawId of tracked.moduleIds) {
        const stableId = toStableModuleId(rawId, root)
        let files = this.outputFilesByModuleId.get(stableId)
        if (!files) {
          files = new Set<string>()
          this.outputFilesByModuleId.set(stableId, files)
        }
        files.add(file)
      }
    }
  }

  private installOptions(bundledDev: BundledDevInternal): void {
    const original = bundledDev.getRolldownOptions.bind(bundledDev)
    bundledDev.getRolldownOptions = async () => {
      const options = await original()
      options.cwd = resolveStatefulHmrModuleRoot(this.config.root, options.cwd)
      const output = Array.isArray(options.output)
        ? (options.output[0] ??= {})
        : (options.output ??= {})
      const aliases = collectRolldownAliasEntries(this.config)
      if (Object.keys(aliases).length > 0) {
        options.resolve = {
          ...(options.resolve ?? {}),
          alias: {
            ...(options.resolve?.alias ?? {}),
            ...aliases,
          },
        }
      }
      const configuredOutput = this.config.build.rolldownOptions.output
      const desiredOutput = Array.isArray(configuredOutput) ? configuredOutput[0] : configuredOutput
      Object.assign(output, desiredOutput)
      const userBanner = output.banner
      const userFooter = output.footer
      // DevEngine 以 ESM 生成依赖图；宿主格式由 renderChunk 转换，仍由原生 bundler 写出。
      output.format = 'esm'
      output.minify = false
      output.sourcemap = Boolean(this.config.build.sourcemap)
      output.banner = async (chunk: { fileName: string, isEntry?: boolean }) => {
        const existing = typeof userBanner === 'function' ? await userBanner(chunk) : (userBanner ?? '')
        return `${existing}${existing ? '\n' : ''}${createStatefulHmrBanner(chunk)}`
      }
      output.footer = async (chunk: { fileName: string, isEntry?: boolean }) => {
        const statefulFooter = createStatefulHmrFooter(chunk)
        const existing = typeof userFooter === 'function' ? await userFooter(chunk) : (userFooter ?? '')
        return `${statefulFooter}${statefulFooter && existing ? '\n' : ''}${existing}`
      }
      options.experimental ??= {}
      options.experimental.devMode = {
        ...(typeof options.experimental.devMode === 'object' ? options.experimental.devMode : {}),
        implement: createStatefulHmrRolldownRuntimeSource(),
        lazy: false,
        skipCommonRuntimeInjection: true,
      }
      return options
    }
  }

  private installOutput(bundledDev: BundledDevInternal): void {
    const original = bundledDev.storeOutputFiles.bind(bundledDev)
    bundledDev.storeOutputFiles = (output, source = 'full') => {
      if (this.closed) {
        return
      }
      try {
        if (!this.initialRuntimeValidated && output.some(item => item.fileName === 'app.js')) {
          assertStatefulHmrRuntimeOutput(output)
          this.initialRuntimeValidated = true
        }
        original(output)
        const publicationSource = source === 'partial' && this.expectingFullOutput ? 'full' : source
        // partial 输出只在显式完整重建请求的首个回调中升级为 publication full；
        // chunk 追踪仍保留原生 source，避免不完整批次清空既有完整映射。
        this.rememberChunkModules(output, source)
        void this.publication.publish(publicationSource, () => this.callbacks.onOutput(output, publicationSource)).catch((error) => {
          this.initialOutputError = error instanceof Error ? error : new Error(String(error))
          this.callbacks.onError(this.initialOutputError.message)
        })
      }
      catch (error) {
        this.initialOutputError = error instanceof Error ? error : new Error(String(error))
        throw error
      }
    }
  }

  private installListener(bundledDev: BundledDevInternal): void {
    const listen = async () => {
      if (this.closed) {
        throw new Error('stateful HMR 适配器已关闭。')
      }
      const rolldownOptions = await bundledDev.getRolldownOptions()
      if (Array.isArray(rolldownOptions.output) && rolldownOptions.output.length > 1) {
        throw new Error('stateful-experimental HMR 不支持多组 Rolldown output 配置。')
      }
      const outputOptions = Array.isArray(rolldownOptions.output)
        ? rolldownOptions.output[0]
        : rolldownOptions.output
      const engine = await this.createDevEngine(rolldownOptions, outputOptions, {
        onAdditionalAssets: result => bundledDev.storeOutputFiles(result.output as StatefulHmrOutputFile[], 'additional'),
        onHmrUpdates: result => this.handleHmrUpdates(result),
        onOutput: (result) => {
          if (result instanceof Error) {
            this.initialOutputError = result
            this.callbacks.onError(result.message)
            return
          }
          const output = result.output as StatefulHmrOutputFile[]
          bundledDev.storeOutputFiles(output, output.some(item => item.fileName === 'app.js') ? 'full' : 'partial')
        },
        watch: {
          skipWrite: true,
          exclude: this.config.build.outDir
            ? [path.resolve(this.config.root, this.config.build.outDir), `${path.resolve(this.config.root, this.config.build.outDir)}/**`]
            : [],
          ...this.watchOptions,
        },
      }) as StatefulHmrDevEngine
      this.engine = engine
      bundledDev._devEngine = engine
      if (this.closed) {
        throw new Error('stateful HMR 适配器已关闭。')
      }
      void engine.run().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        this.callbacks.onError(message)
      })
      await Promise.race([engine.registerClient(clientId), this.stopping.promise])
      await withInitialBuildTimeout(Promise.race([engine.ensureCurrentBuildFinish(), this.stopping.promise]), this.initialBuildTimeout)
      if (this.initialOutputError) {
        throw this.initialOutputError
      }
      if ((await engine.getBundleState()).lastBuildErrored) {
        throw new Error('微信状态保持 HMR 初次构建失败。')
      }
      await withInitialBuildTimeout(Promise.race([this.callbacks.waitForInitialBundle(), this.stopping.promise]), this.initialBuildTimeout)
    }
    bundledDev.listen = () => this.startTask ??= listen()
  }

  private handleHmrUpdates(result: Parameters<NonNullable<DevOptions['onHmrUpdates']>>[0]): void {
    if (this.closed) {
      return
    }
    if (result instanceof Error) {
      this.callbacks.onError(result.message)
      return
    }
    if (this.callbacks.onBatch) {
      this.callbacks.onBatch({ ...result, updates: result.updates.filter(item => item.clientId === clientId) })
      return
    }
    for (const { clientId: updateClientId, update } of result.updates) {
      if (updateClientId === clientId) {
        this.callbacks.onPatch(result.changedFiles, update as StatefulHmrDevEngineUpdate)
      }
    }
  }
}

export function createStatefulHmrBanner(chunk: { fileName: string, isEntry?: boolean }): string {
  if (chunk.fileName === 'app.js') {
    return [
      `require(${JSON.stringify(`./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}`)});`,
      'require("./rolldown-runtime.js");',
      `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].installNative('App', definition => App(definition));`,
    ].join('')
  }
  if (!chunk.isEntry || !chunk.fileName.endsWith('.js')) {
    return ''
  }
  const prefix = '../'.repeat(chunk.fileName.split('/').length - 1)
  return [
    `require(${JSON.stringify(`${prefix}rolldown-runtime.js`)});`,
    `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].installNative('Page', definition => Page(definition));`,
    `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].installNative('Component', definition => Component(definition));`,
    `require(${JSON.stringify(`${prefix}${WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE}`)});`,
    `require(${JSON.stringify(`${prefix}${WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE}`)});`,
  ].join('')
}

export function createStatefulHmrFooter(chunk: { fileName: string, isEntry?: boolean }): string {
  if (!chunk.isEntry || chunk.fileName === 'app.js' || !chunk.fileName.endsWith('.js')) {
    return ''
  }
  return `for (const definition of globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].takeNativeDefinitions('Component')) Component(definition);`
}
