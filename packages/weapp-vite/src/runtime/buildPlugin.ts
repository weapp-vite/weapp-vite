import type PQueue from 'p-queue'
import type {
  RolldownOutput,
  RolldownWatcher,
} from 'rolldown'
import type { Plugin } from 'vite'
import type { BuildTarget, MutableCompilerContext } from '../context'
import type { SubPackageMetaValue } from '../types'
import fs from 'node:fs'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { rimraf } from 'rimraf'
import { build } from 'vite'
import { debug, logger } from '../context/shared'
import { createIndependentBuildError } from './independentError'
import { createSharedBuildConfig } from './sharedBuildConfig'

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
  const independentBuildTasks = new Map<string, Promise<RolldownOutput>>()

  function storeIndependentOutput(root: string, output: RolldownOutput) {
    independentState.outputs.set(root, output)
  }

  function invalidateIndependentOutput(root: string) {
    independentState.outputs.delete(root)
  }

  function getIndependentOutput(root: string) {
    return independentState.outputs.get(root)
  }

  async function buildIndependentBundle(root: string, meta: SubPackageMetaValue): Promise<RolldownOutput> {
    const existingTask = independentBuildTasks.get(root)
    if (existingTask) {
      return existingTask
    }

    const task = (async () => {
      try {
        const chunkRoot = meta.subPackage.root ?? root
        const inlineConfig = configService.merge(meta, meta.subPackage.inlineConfig, {
          build: {
            write: false,
            watch: null,
            rolldownOptions: {
              output: {
                chunkFileNames() {
                  return `${chunkRoot}/[name].js`
                },
              },
            },
          },
        })
        const result = await build(
          inlineConfig,
        ) as RolldownOutput | RolldownOutput[]

        const output = Array.isArray(result) ? result[0] : result
        if (!output) {
          throw new Error(`独立分包 ${root} 未产生输出`)
        }
        storeIndependentOutput(root, output)
        return output
      }
      catch (error) {
        const normalized = createIndependentBuildError(root, error)
        invalidateIndependentOutput(root)
        logger.error(`[independent] ${root} 构建失败: ${normalized.message}`)
        throw normalized
      }
      finally {
        independentBuildTasks.delete(root)
      }
    })()

    independentBuildTasks.set(root, task)
    return task
  }
  function checkWorkersOptions(target: BuildTarget = 'app') {
    if (target === 'plugin') {
      return {
        hasWorkersDir: false,
        workersDir: undefined as string | undefined,
      }
    }
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

  async function runDev(target: BuildTarget) {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }
    debug?.(`[${target}] dev build watcher start`)
    const { hasWorkersDir, workersDir } = checkWorkersOptions(target)
    const buildOptions = configService.merge(
      undefined,
      createSharedBuildConfig(configService, scanService),
    )
    const watcherPromise = build(
      buildOptions,
    ) as unknown as Promise<RolldownWatcher>
    const workerPromise = target === 'app' && hasWorkersDir && workersDir
      ? devWorkers(workersDir)
      : Promise.resolve()
    const [watcher] = await Promise.all([watcherPromise, workerPromise])
    const isTestEnv = process.env.VITEST === 'true'
      || process.env.NODE_ENV === 'test'

    if (target === 'app' && hasWorkersDir && workersDir && !isTestEnv) {
      const absWorkerRoot = path.resolve(configService.absoluteSrcRoot, workersDir)
      const workerWatcher = chokidar.watch(
        absWorkerRoot,
        {
          persistent: true,
          ignoreInitial: true,
        },
      )

      const logWorkerEvent = (type: string, targetPath: string, level: 'info' | 'success' = 'info') => {
        if (!targetPath) {
          return
        }
        const relative = configService.relativeCwd(targetPath)
        const message = `[workers:${type}] ${relative}`
        if (level === 'success') {
          logger.success(message)
        }
        else {
          logger.info(message)
        }
      }

      workerWatcher.on('all', (event, id) => {
        if (!id) {
          return
        }
        if (event === 'add') {
          logWorkerEvent(event, id, 'success')
          void devWorkers(workersDir)
          return
        }
        logWorkerEvent(event, id)
      })

      workerWatcher.on('raw', (eventName, rawPath, details) => {
        if (eventName !== 'rename') {
          return
        }
        const candidate = typeof rawPath === 'string'
          ? rawPath
          : rawPath && typeof (rawPath as { toString?: () => string }).toString === 'function'
            ? (rawPath as { toString: () => string }).toString()
            : ''
        if (!candidate) {
          return
        }
        const baseDir = typeof details === 'object' && details && 'watchedPath' in details
          ? (details as { watchedPath?: string }).watchedPath ?? absWorkerRoot
          : absWorkerRoot
        const resolved = path.isAbsolute(candidate)
          ? candidate
          : path.resolve(baseDir, candidate)
        const exists = fs.existsSync(resolved)
        logWorkerEvent(exists ? 'rename->add' : 'rename->unlink', resolved, exists ? 'success' : 'info')
      })

      watcherService.sidecarWatcherMap.set(absWorkerRoot, {
        close: () => workerWatcher.close(),
      })
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

    const watcherRoot = target === 'plugin'
      ? configService.absolutePluginRoot ?? configService.absoluteSrcRoot
      : '/'
    watcherService.setRollupWatcher(watcher, watcherRoot)
    return watcher
  }

  async function runProd(target: BuildTarget) {
    debug?.(`[${target}] prod build start`)
    const { hasWorkersDir } = checkWorkersOptions(target)
    const bundlerPromise = build(
      configService.merge(
        undefined,
        createSharedBuildConfig(configService, scanService),
      ),
    )
    const workerPromise = target === 'app' && hasWorkersDir ? buildWorkers() : Promise.resolve()
    const [output] = await Promise.all([bundlerPromise, workerPromise])

    debug?.(`[${target}] prod build end`)
    return output as RolldownOutput | RolldownOutput[]
  }

  async function cleanOutputs() {
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
    const pluginOutputRoot = configService.absolutePluginOutputRoot
    if (pluginOutputRoot) {
      const relativeToOutDir = path.relative(configService.outDir, pluginOutputRoot)
      const isInsideOutDir = relativeToOutDir === '' || (!relativeToOutDir.startsWith('..') && !path.isAbsolute(relativeToOutDir))
      if (!isInsideOutDir) {
        const deletedPluginFiles = await rimraf([
          path.resolve(pluginOutputRoot, '*'),
          path.resolve(pluginOutputRoot, '.*'),
        ], {
          glob: true,
        })
        debug?.('deletedPluginOutput', deletedPluginFiles)
        logger.success(`已清空 ${configService.relativeCwd(pluginOutputRoot)} 目录`)
      }
    }
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

  async function runBuildTarget(target: BuildTarget) {
    ctx.currentBuildTarget = target
    if (configService.isDev) {
      return await runDev(target)
    }
    return await runProd(target)
  }

  async function buildEntry(options?: BuildOptions) {
    await cleanOutputs()
    debug?.('build start')
    const npmBuildTask = scheduleNpmBuild(options)
    const result = await runBuildTarget('app')
    await npmBuildTask
    if (configService.absolutePluginRoot) {
      await runBuildTarget('plugin')
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

export function createBuildServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createBuildService(ctx)
  ctx.buildService = service

  return {
    name: 'weapp-runtime:build-service',
  }
}
