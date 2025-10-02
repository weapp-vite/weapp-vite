import type { RolldownOutput, RolldownWatcher } from 'rolldown'
import type { InlineConfig, Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import process from 'node:process'
import chokidar from 'chokidar'
import PQueue from 'p-queue'
import path from 'pathe'
import { rimraf } from 'rimraf'
import { build } from 'vite'
import { debug, logger } from '../context/shared'

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
  if (!ctx.configService || !ctx.watcherService || !ctx.npmService || !ctx.scanService) {
    throw new Error('build service requires config, watcher, npm and scan services to be initialized')
  }

  const queue = new PQueue({ autoStart: false })

  function checkWorkersOptions(): ctx is MutableCompilerContext & { scanService: { workersDir: string } } {
    const isSetWorkersDir = Boolean(ctx.scanService.workersDir)
    if (isSetWorkersDir && ctx.configService.weappViteConfig?.worker?.entry === undefined) {
      logger.error('检测到已经开启了 `worker`，请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
      logger.error('比如引入的 `worker` 路径为 `workers/index`, 此时 `weapp.worker.entry` 设置为 `[index]` ')
      throw new Error('请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
    }

    return isSetWorkersDir
  }

  async function devWorkers() {
    const workersWatcher = (
      await build(
        ctx.configService.mergeWorkers(),
      )
    ) as unknown as RolldownWatcher
    ctx.watcherService.setRollupWatcher(workersWatcher, ctx.scanService.workersDir)
  }

  async function buildWorkers() {
    await build(
      ctx.configService.mergeWorkers(),
    )
  }

  function sharedBuildConfig(): Partial<InlineConfig> {
    const nodeModulesDeps: RegExp[] = [REG_NODE_MODULES_DIR]
    const commonjsHelpersDeps: RegExp[] = [/commonjsHelpers\.js$/]

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

                    const moduleInfo = ctxPlugin.getModuleInfo(id)
                    if (moduleInfo?.importers?.length && moduleInfo.importers.length > 1) {
                      const summary = moduleInfo.importers.reduce<Record<string, number>>((acc, cur) => {
                        const relPath = ctx.configService.relativeAbsoluteSrcRoot(cur)
                        const prefix = [
                          ...ctx.scanService.subPackageMap.keys(),
                        ]
                          .find(
                            x => relPath.startsWith(x),
                          ) ?? ''
                        acc[prefix] = (acc[prefix] || 0) + 1
                        return acc
                      }, {})
                      const summaryKeys = Object.keys(summary)
                      const prefix = summaryKeys.length === 1 ? summaryKeys[0] : ''
                      return path.join(prefix, 'common')
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
    const buildOptions = ctx.configService.merge(undefined, sharedBuildConfig())
    const watcher = (
      await build(
        buildOptions,
      )
    ) as unknown as RolldownWatcher
    if (checkWorkersOptions()) {
      devWorkers()
      chokidar.watch(
        path.resolve(ctx.configService.absoluteSrcRoot, ctx.scanService.workersDir!),
        {
          persistent: true,
          ignoreInitial: true,
        },
      ).on('all', (event, id) => {
        if (event === 'add') {
          logger.success(`[workers:${event}] ${ctx.configService.relativeCwd(id)}`)
          devWorkers()
        }
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

    ctx.watcherService.setRollupWatcher(watcher)
    return watcher
  }

  async function runProd() {
    debug?.('prod build start')
    const output = (await build(
      ctx.configService.merge(undefined, sharedBuildConfig()),
    ))
    if (checkWorkersOptions()) {
      await buildWorkers()
    }

    debug?.('prod build end')
    return output as RolldownOutput | RolldownOutput[]
  }

  async function buildEntry(options?: BuildOptions) {
    if (ctx.configService.mpDistRoot) {
      const deletedFilePaths = await rimraf(
        [
          path.resolve(ctx.configService.outDir, '*'),
          path.resolve(ctx.configService.outDir, '.*'),
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
      logger.success(`已清空 ${ctx.configService.mpDistRoot} 目录`)
    }
    debug?.('build start')
    let npmBuildTask: Promise<any> = Promise.resolve()
    if (!options?.skipNpm) {
      npmBuildTask = queue.add(() => {
        return ctx.npmService!.build()
      })
    }
    let result: RolldownOutput | RolldownOutput[] | RolldownWatcher
    if (ctx.configService.isDev) {
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
