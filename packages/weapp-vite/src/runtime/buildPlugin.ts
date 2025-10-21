import type PQueue from 'p-queue'
import type { RolldownOutput, RolldownWatcher } from 'rolldown'
import type { InlineConfig, Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { rimraf } from 'rimraf'
import { build } from 'vite'
import { debug, logger } from '../context/shared'
import { DEFAULT_SHARED_CHUNK_STRATEGY, resolveSharedChunkName } from './chunkStrategy'

export interface BuildOptions {
  skipNpm?: boolean
}

export interface BuildService {
  queue: PQueue
  build: (options?: BuildOptions) => Promise<RolldownOutput | RolldownOutput[] | RolldownWatcher>
}

const REG_NODE_MODULES_DIR = /[\\/]node_modules[\\/]/gi

function testByReg2DExpList(reg2DExpList: RegExp[][]) {
  return (id: string) =>
    reg2DExpList.some(regExpList => regExpList.some(regExp => regExp.test(id)))
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

    return {
      build: {
        rolldownOptions: {
          output: {
            advancedChunks: {
              groups: [
                {
                  name: (id, ctxPlugin) => {
                    REG_NODE_MODULES_DIR.lastIndex = 0

                    if (testByReg2DExpList([nodeModulesDeps, commonjsHelpersDeps])(id)) {
                      return 'vendors'
                    }

                    const resolved = resolveSharedChunkName({
                      id,
                      ctx: ctxPlugin,
                      relativeAbsoluteSrcRoot: configService.relativeAbsoluteSrcRoot,
                      subPackageRoots: scanService.subPackageMap.keys(),
                      strategy: sharedStrategy,
                    })

                    if (resolved) {
                      return resolved
                    }
                  },
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
    const buildOptions = configService.merge(undefined, sharedBuildConfig())
    const watcher = (
      await build(
        buildOptions,
      )
    ) as unknown as RolldownWatcher
    const { hasWorkersDir, workersDir } = checkWorkersOptions()
    const isTestEnv = process.env.VITEST === 'true'
      || process.env.NODE_ENV === 'test'

    if (hasWorkersDir && workersDir) {
      devWorkers(workersDir)

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
    const output = (await build(
      configService.merge(undefined, sharedBuildConfig()),
    ))
    const { hasWorkersDir } = checkWorkersOptions()
    if (hasWorkersDir) {
      await buildWorkers()
    }

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
  }
}

export function createBuildServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createBuildService(ctx)
  ctx.buildService = service

  return {
    name: 'weapp-runtime:build-service',
  }
}
