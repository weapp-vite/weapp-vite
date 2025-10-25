import type PQueue from 'p-queue'
import type {
  OutputAsset,
  OutputChunk,
  RenderedModule,
  RolldownOutput,
  RolldownWatcher,
  RolldownWatcherEvent,
  SourceMap,
} from 'rolldown'
import type { InlineConfig, Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { rimraf } from 'rimraf'
import { build } from 'vite'
import { debug, logger } from '../context/shared'
import { createAdvancedChunkNameResolver } from './advancedChunks'
import { DEFAULT_SHARED_CHUNK_STRATEGY } from './chunkStrategy'
import { createIndependentBuildError } from './independentError'

export interface BuildOptions {
  skipNpm?: boolean
}

export interface BuildService {
  queue: PQueue
  build: (options?: BuildOptions) => Promise<RolldownOutput | RolldownOutput[] | RolldownWatcher>
  registerIndependentWatcher: (root: string, watcher: RolldownWatcher) => void
  waitForIndependentOutput: (root: string, versionSnapshot: number) => Promise<RolldownOutput>
  storeIndependentOutput: (root: string, output: RolldownOutput | null) => void
  getIndependentVersion: (root: string) => number
  failIndependentOutput: (root: string, error: Error) => void
}

const REG_NODE_MODULES_DIR = /[\\/]node_modules[\\/]/gi

interface BindingRenderedModuleLike {
  code: string | null
  renderedExports: string[]
  renderedLength?: number
}

interface BindingModulesLike {
  keys: string[]
  values: BindingRenderedModuleLike[]
}

interface BindingOutputChunkLike {
  code: string
  name: string
  isEntry: boolean
  exports: string[]
  fileName: string
  imports: string[]
  dynamicImports: string[]
  facadeModuleId: string | null
  isDynamicEntry: boolean
  moduleIds: string[]
  map: unknown
  sourcemapFileName: string | null
  preliminaryFileName: string
  modules: BindingModulesLike
}

interface BindingAssetSourceLike {
  inner: string | Uint8Array
}

interface BindingOutputAssetLike {
  fileName: string
  originalFileName: string | null
  originalFileNames?: string[]
  name: string | null
  names?: string[]
  source: BindingAssetSourceLike
}

interface BindingOutputsLike {
  chunks: BindingOutputChunkLike[]
  assets: BindingOutputAssetLike[]
}

export interface BindingErrorLike {
  message?: string
  code?: string
  plugin?: string
  id?: string
  frame?: string
  stack?: string
}

interface BindingErrorResult {
  errors: BindingErrorLike[]
  isBindingErrors: boolean
}

type BindingResultLike = BindingOutputsLike | BindingErrorResult

function isBindingErrorResult(value: BindingResultLike): value is BindingErrorResult {
  return Boolean(value) && typeof value === 'object' && 'isBindingErrors' in value && (value as BindingErrorResult).isBindingErrors === true
}

function ensureSourceMap(raw: unknown): SourceMap | null {
  if (!raw) {
    return null
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as SourceMap
    }
    catch {
      return null
    }
  }
  if (typeof raw === 'object') {
    return raw as SourceMap
  }
  return null
}

function toRenderedModule(value: BindingRenderedModuleLike): RenderedModule {
  return {
    code: value.code,
    renderedExports: value.renderedExports,
    renderedLength: value.renderedLength ?? (value.code ? value.code.length : 0),
  }
}

function toRenderedModules(modules: BindingModulesLike): Record<string, RenderedModule> {
  const result: Record<string, RenderedModule> = {}
  if (!modules?.keys || !modules?.values) {
    return result
  }
  const { keys, values } = modules
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    const value = values[index] ?? { code: null, renderedExports: [] }
    result[key] = toRenderedModule(value)
  }
  return result
}

function coerceAssetSource(source: BindingAssetSourceLike): string | Uint8Array {
  const value = source?.inner
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Uint8Array) {
    return value
  }
  if (value && typeof value === 'object') {
    if (ArrayBuffer.isView(value as ArrayBufferView)) {
      const view = value as ArrayBufferView
      const cloned = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
      return new Uint8Array(cloned)
    }
    const maybeBuffer = value as { byteLength?: number }
    if (typeof maybeBuffer.byteLength === 'number') {
      return new Uint8Array(value as ArrayBuffer)
    }
  }
  return new Uint8Array()
}

function convertBindingOutputs(bindingOutputs: BindingOutputsLike): RolldownOutput | null {
  if (!bindingOutputs) {
    return null
  }

  const chunkEntries: OutputChunk[] = []
  for (const chunk of bindingOutputs.chunks ?? []) {
    const modules = toRenderedModules(chunk.modules)
    chunkEntries.push({
      type: 'chunk',
      code: chunk.code ?? '',
      name: chunk.name,
      isEntry: chunk.isEntry,
      exports: chunk.exports ?? [],
      fileName: chunk.fileName,
      modules,
      imports: chunk.imports ?? [],
      dynamicImports: chunk.dynamicImports ?? [],
      facadeModuleId: chunk.facadeModuleId ?? null,
      isDynamicEntry: chunk.isDynamicEntry ?? false,
      moduleIds: chunk.moduleIds ?? [],
      map: ensureSourceMap(chunk.map),
      sourcemapFileName: chunk.sourcemapFileName ?? null,
      preliminaryFileName: chunk.preliminaryFileName ?? chunk.fileName,
    })
  }

  if (chunkEntries.length === 0) {
    return null
  }

  const assetEntries: OutputAsset[] = []
  for (const asset of bindingOutputs.assets ?? []) {
    const names = asset.names ?? (asset.name ? [asset.name] : [])
    assetEntries.push({
      type: 'asset',
      fileName: asset.fileName,
      originalFileName: asset.originalFileName,
      originalFileNames: asset.originalFileNames ?? (asset.originalFileName ? [asset.originalFileName] : []),
      source: coerceAssetSource(asset.source),
      name: asset.name ?? undefined,
      names,
    })
  }

  const restEntries: Array<OutputChunk | OutputAsset> = chunkEntries.slice(1)
  restEntries.push(...assetEntries)

  return {
    output: [chunkEntries[0], ...restEntries] as [OutputChunk, ...(OutputChunk | OutputAsset)[]],
  }
}

function createBuildService(ctx: MutableCompilerContext): BuildService {
  function assertRuntimeServices(target: MutableCompilerContext): asserts target is MutableCompilerContext & {
    configService: NonNullable<MutableCompilerContext['configService']>
    watcherService: NonNullable<MutableCompilerContext['watcherService']>
    npmService: NonNullable<MutableCompilerContext['npmService']>
    scanService: NonNullable<MutableCompilerContext['scanService']>
  } {
    if (!target.configService || !target.watcherService || !target.npmService || !target.scanService) {
      throw new Error('build service requires config, watcher, npm and scan services to be initialized')
    }
  }

  assertRuntimeServices(ctx)

  const { configService, watcherService, npmService, scanService } = ctx
  const buildState = ctx.runtimeState.build
  const { queue } = buildState
  const independentState = buildState.independent
  const independentRecoveryTasks = new Map<string, Promise<RolldownOutput | null>>()

  const BUNDLER_CLOSED_MESSAGE = 'Bundler is closed'

  function getIndependentVersion(root: string): number {
    return independentState.versions.get(root) ?? 0
  }

  function storeIndependentOutput(root: string, output: RolldownOutput | null) {
    if (!output) {
      return
    }
    independentState.outputs.set(root, output)
    const nextVersion = getIndependentVersion(root) + 1
    independentState.versions.set(root, nextVersion)
    const waiters = independentState.waiters.get(root)
    if (waiters && waiters.length > 0) {
      independentState.waiters.delete(root)
      for (const waiter of waiters) {
        waiter.resolve(output)
      }
    }
  }

  function failIndependentOutput(root: string, error: Error) {
    const waiters = independentState.waiters.get(root)
    if (waiters && waiters.length > 0) {
      independentState.waiters.delete(root)
      for (const waiter of waiters) {
        waiter.reject(error)
      }
    }
  }

  function waitForIndependentOutput(root: string, versionSnapshot: number): Promise<RolldownOutput> {
    const currentVersion = getIndependentVersion(root)
    const cached = independentState.outputs.get(root)
    if (cached && currentVersion > versionSnapshot) {
      return Promise.resolve(cached)
    }
    return new Promise((resolve, reject) => {
      const waiters = independentState.waiters.get(root) ?? []
      waiters.push({
        version: versionSnapshot,
        resolve,
        reject,
      })
      independentState.waiters.set(root, waiters)
    })
  }

  function clearIndependentState(root: string) {
    independentState.outputs.delete(root)
    independentState.versions.delete(root)
    independentState.waiters.delete(root)
  }

  function isBundlerClosedError(error: Error) {
    return error.message.includes(BUNDLER_CLOSED_MESSAGE)
  }

  async function rebuildIndependentBundle(root: string): Promise<RolldownOutput | null> {
    const existingTask = independentRecoveryTasks.get(root)
    if (existingTask) {
      return existingTask
    }

    const task = (async () => {
      const meta = scanService.independentSubPackageMap?.get(root)
      if (!meta) {
        throw new Error(`Independent subpackage ${root} metadata not found`)
      }

      const versionSnapshot = getIndependentVersion(root)
      const chunkRoot = meta.subPackage.root ?? root
      const inlineConfig = configService.merge(meta, meta.subPackage.inlineConfig, {
        build: {
          write: false,
          rolldownOptions: {
            output: {
              chunkFileNames() {
                return `${chunkRoot}/[name].js`
              },
            },
          },
        },
      })
      const rollup = await build(
        inlineConfig,
      ) as RolldownOutput | RolldownOutput[] | RolldownWatcher

      if (Array.isArray(rollup)) {
        const [first] = rollup
        if (!first) {
          throw new Error(`独立分包 ${root} 未产生输出`)
        }
        storeIndependentOutput(root, first)
        return first
      }

      if (isRolldownWatcherLike(rollup)) {
        registerIndependentWatcher(root, rollup)
        return await waitForIndependentOutput(root, versionSnapshot)
      }

      const output = rollup as RolldownOutput
      storeIndependentOutput(root, output)
      return output
    })().finally(() => {
      independentRecoveryTasks.delete(root)
    })

    independentRecoveryTasks.set(root, task)
    return task
  }

  async function resolveWatcherBuild(root: string, event: Extract<RolldownWatcherEvent, { code: 'BUNDLE_END' }>) {
    try {
      const result = await event.result.generate() as BindingResultLike
      if (isBindingErrorResult(result)) {
        const independentError = createIndependentBuildError(root, result.errors[0])
        throw independentError
      }
      const output = convertBindingOutputs(result as BindingOutputsLike)
      storeIndependentOutput(root, output)
    }
    catch (error) {
      const normalized = createIndependentBuildError(root, error)
      if (isBundlerClosedError(normalized)) {
        try {
          await rebuildIndependentBundle(root)
          logger.warn(`[independent] ${root} watcher 已关闭，已重新调度构建`)
          return
        }
        catch (rebuildError) {
          const fallbackError = createIndependentBuildError(root, rebuildError)
          failIndependentOutput(root, fallbackError)
          logger.error(`[independent] ${root} 构建失败: ${fallbackError.message}`)
          return
        }
      }
      failIndependentOutput(root, normalized)
      logger.error(`[independent] ${root} 构建失败: ${normalized.message}`)
    }
  }

  function registerIndependentWatcher(root: string, watcher: RolldownWatcher) {
    const handleEvent = (event: RolldownWatcherEvent) => {
      if (event.code === 'BUNDLE_END') {
        void resolveWatcherBuild(root, event)
      }
      else if (event.code === 'ERROR') {
        const normalized = createIndependentBuildError(root, event.error)
        if (isBundlerClosedError(normalized)) {
          void rebuildIndependentBundle(root).then(() => {
            logger.warn(`[independent] ${root} watcher 已关闭，已重新调度构建`)
          }).catch((rebuildError) => {
            const fallbackError = createIndependentBuildError(root, rebuildError)
            failIndependentOutput(root, fallbackError)
            logger.error(`[independent] ${root} 构建失败: ${fallbackError.message}`)
          })
          return
        }
        failIndependentOutput(root, normalized)
        logger.error(`[independent] ${root} 构建失败: ${normalized.message}`)
      }
    }

    watcher.on('event', handleEvent)
    watcher.on('close', () => {
      const closeError = new Error(`Independent watcher for ${root} closed`)
      void rebuildIndependentBundle(root).then(() => {
        logger.warn(`[independent] ${root} watcher 已关闭，已重新调度构建`)
      }).catch((rebuildError) => {
        const fallbackError = createIndependentBuildError(root, rebuildError ?? closeError)
        failIndependentOutput(root, fallbackError)
        logger.error(`[independent] ${root} 构建失败: ${fallbackError.message}`)
        clearIndependentState(root)
      })
    })
    watcherService.setRollupWatcher(watcher, root)
  }

  function isRolldownWatcherLike(candidate: RolldownOutput | RolldownOutput[] | RolldownWatcher): candidate is RolldownWatcher {
    return Boolean(candidate)
      && typeof candidate === 'object'
      && typeof (candidate as RolldownWatcher).on === 'function'
      && typeof (candidate as RolldownWatcher).close === 'function'
  }

  function checkWorkersOptions() {
    const workersDir = scanService.workersDir
    const hasWorkersDir = Boolean(workersDir)
    if (hasWorkersDir && configService.weappViteConfig?.worker?.entry === undefined) {
      logger.error('检测到已经开启了 `worker`，请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
      logger.error('比如引入的 `worker` 路径为 `workers/index`, 此时 `weapp.worker.entry` 设置为 `[index]` ')
      throw new Error('请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
    }

    return {
      hasWorkersDir,
      workersDir,
    }
  }

  async function devWorkers(workersRoot: string) {
    const workersWatcher = (
      await build(
        configService.mergeWorkers(),
      )
    ) as unknown as RolldownWatcher
    watcherService.setRollupWatcher(workersWatcher, workersRoot)
  }

  async function buildWorkers() {
    await build(
      configService.mergeWorkers(),
    )
  }

  function sharedBuildConfig(): Partial<InlineConfig> {
    const nodeModulesDeps: RegExp[] = [REG_NODE_MODULES_DIR]
    const commonjsHelpersDeps: RegExp[] = [/commonjsHelpers\.js$/]
    const sharedStrategy = configService.weappViteConfig?.chunks?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [nodeModulesDeps, commonjsHelpersDeps],
      relativeAbsoluteSrcRoot: configService.relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => scanService.subPackageMap.keys(),
      strategy: sharedStrategy,
    })

    return {
      build: {
        rolldownOptions: {
          output: {
            advancedChunks: {
              groups: [
                {
                  name: (id, ctxPlugin) => resolveAdvancedChunkName(id, ctxPlugin),
                },
              ],
            },
            chunkFileNames: '[name].js',
          },

        },
      },
    }
  }

  async function runDev() {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }
    debug?.('dev build watcher start')
    const { hasWorkersDir, workersDir } = checkWorkersOptions()
    const buildOptions = configService.merge(undefined, sharedBuildConfig())
    const watcherPromise = build(
      buildOptions,
    ) as unknown as Promise<RolldownWatcher>
    const workerPromise = hasWorkersDir && workersDir
      ? devWorkers(workersDir)
      : Promise.resolve()
    const [watcher] = await Promise.all([watcherPromise, workerPromise])
    const isTestEnv = process.env.VITEST === 'true'
      || process.env.NODE_ENV === 'test'

    if (hasWorkersDir && workersDir) {
      if (!isTestEnv) {
        const absWorkerRoot = path.resolve(configService.absoluteSrcRoot, workersDir)
        const watcher = chokidar.watch(
          absWorkerRoot,
          {
            persistent: true,
            ignoreInitial: true,
          },
        )

        watcher.on('all', (event, id) => {
          if (event === 'add') {
            logger.success(`[workers:${event}] ${configService.relativeCwd(id)}`)
            void devWorkers(workersDir)
          }
        })

        watcherService.sidecarWatcherMap.set(absWorkerRoot, {
          close: () => watcher.close(),
        })
      }
    }
    debug?.('dev build watcher end')
    debug?.('dev watcher listen start')

    let startTime: DOMHighResTimeStamp

    let resolveWatcher: (value: unknown) => void
    let rejectWatcher: (reason?: any) => void
    const promise = new Promise((res, rej) => {
      resolveWatcher = res
      rejectWatcher = rej
    })
    watcher.on('event', (e) => {
      if (e.code === 'START') {
        startTime = performance.now()
      }
      else if (e.code === 'END') {
        logger.success(`构建完成，耗时 ${(performance.now() - startTime).toFixed(2)} ms`)
        resolveWatcher(e)
      }
      else if (e.code === 'ERROR') {
        rejectWatcher(e)
      }
    })
    await promise

    watcherService.setRollupWatcher(watcher)
    return watcher
  }

  async function runProd() {
    debug?.('prod build start')
    const { hasWorkersDir } = checkWorkersOptions()
    const bundlerPromise = build(
      configService.merge(undefined, sharedBuildConfig()),
    )
    const workerPromise = hasWorkersDir ? buildWorkers() : Promise.resolve()
    const [output] = await Promise.all([bundlerPromise, workerPromise])

    debug?.('prod build end')
    return output as RolldownOutput | RolldownOutput[]
  }

  async function buildEntry(options?: BuildOptions) {
    if (configService.mpDistRoot) {
      const deletedFilePaths = await rimraf(
        [
          path.resolve(configService.outDir, '*'),
          path.resolve(configService.outDir, '.*'),
        ],
        {
          glob: true,
          filter: (filePath) => {
            if (filePath.includes('miniprogram_npm')) {
              return false
            }
            return true
          },
        },
      )
      debug?.('deletedFilePaths', deletedFilePaths)
      logger.success(`已清空 ${configService.mpDistRoot} 目录`)
    }
    debug?.('build start')
    let npmBuildTask: Promise<any> = Promise.resolve()
    if (!options?.skipNpm) {
      let shouldBuildNpm = true

      if (configService.isDev) {
        const isDependenciesOutdated = await npmService.checkDependenciesCacheOutdate()
        if (!isDependenciesOutdated && buildState.npmBuilt) {
          shouldBuildNpm = false
        }
        else if (isDependenciesOutdated) {
          buildState.npmBuilt = false
        }
      }

      if (shouldBuildNpm) {
        npmBuildTask = queue.add(async () => {
          await npmService.build()
          if (configService.isDev) {
            buildState.npmBuilt = true
          }
        })
        queue.start()
      }
    }
    let result: RolldownOutput | RolldownOutput[] | RolldownWatcher
    if (configService.isDev) {
      result = await runDev()
    }
    else {
      result = await runProd()
    }

    await npmBuildTask

    debug?.('build end')
    return result
  }

  return {
    queue,
    build: buildEntry,
    registerIndependentWatcher,
    waitForIndependentOutput,
    storeIndependentOutput,
    getIndependentVersion,
    failIndependentOutput,
  }
}

export function createBuildServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createBuildService(ctx)
  ctx.buildService = service

  return {
    name: 'weapp-runtime:build-service',
  }
}
