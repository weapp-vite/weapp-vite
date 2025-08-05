import type { RolldownOutput, RolldownWatcher } from 'rolldown'
import type { InlineConfig } from 'vite'
import type { ConfigService, NpmService, ScanService, WatcherService } from '.'
import process from 'node:process'
import chokidar from 'chokidar'
import { inject, injectable } from 'inversify'
import PQueue from 'p-queue'
import path from 'pathe'
import { rimraf } from 'rimraf'
import { build } from 'vite'
import { debug, logger } from '../shared'
import { Symbols } from '../Symbols'

export interface BuildOptions {
  skipNpm?: boolean
}

@injectable()
export class BuildService {
  queue: PQueue
  constructor(
    @inject(Symbols.ConfigService)
    public readonly configService: ConfigService,
    @inject(Symbols.WatcherService)
    public readonly watcherService: WatcherService,
    @inject(Symbols.NpmService)
    public readonly npmService: NpmService,
    @inject(Symbols.ScanService)
    public readonly scanService: ScanService,
  ) {
    this.queue = new PQueue(
      {
        autoStart: false,
      },
    )
    // this.queue.start()
  }

  checkWorkersOptions(): this is this & { scanService: { workersDir: string } } {
    const isSetWorkersDir = Boolean(this.scanService.workersDir)
    if (isSetWorkersDir && this.configService.weappViteConfig?.worker?.entry === undefined) {
      logger.error('检测到已经开启了 `worker`，请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
      logger.error('比如引入的 `worker` 路径为 `workers/index`, 此时 `weapp.worker.entry` 设置为 `[index]` ')
      throw new Error('请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
    }

    return isSetWorkersDir
  }

  async devWorkers() {
    const workersWatcher = (
      await build(
        this.configService.mergeWorkers(),
      )
    ) as unknown as RolldownWatcher
    this.watcherService.setRollupWatcher(workersWatcher, this.scanService.workersDir)
  }

  async buildWorkers() {
    await build(
      this.configService.mergeWorkers(),
    )
  }

  get sharedBuildConfig(): Partial<InlineConfig> {
    // const roots = this.scanService.subPackageMap.keys()

    return {
      build: {
        rollupOptions: {
          output: {
            advancedChunks: {
              // groups: [
              //   {
              //     name: 'inline_node_modules',
              //     test: /node_modules/,

              //     // test: (id) => {
              //     //   return this.scanService.isMainPackageFileName(id)
              //     // },
              //   },
              // ],
            },
          },
        },
      },
    }
  }

  private async runDev() {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }
    debug?.('dev build watcher start')
    const watcher = (
      await build(
        this.configService.merge(undefined, this.sharedBuildConfig),
      )
    ) as unknown as RolldownWatcher
    if (this.checkWorkersOptions()) {
      this.devWorkers()
      chokidar.watch(
        path.resolve(this.configService.absoluteSrcRoot, this.scanService.workersDir),
        {
          persistent: true,
          ignoreInitial: true,
        },
      ).on('all', (event, id) => {
        if (event === 'add') {
          logger.success(`[workers:${event}] ${this.configService.relativeCwd(id)}`)
          this.devWorkers()
        }
      })
    }
    debug?.('dev build watcher end')
    debug?.('dev watcher listen start')

    let startTime: DOMHighResTimeStamp
    // vite 构建完成，耗时 4281.52 ms，4218.12 ms,4407.16 ms
    // 热更新 耗时 2400.79 ms， 耗时 2071.34 ms，  2177.61 ms
    // 726 个模块被编译 独立分包 643 个模块被编译
    // 切换到 rolldown-vite
    // 构建完成，耗时 2476.98 ms, 2267.40 ms, 2208.77 ms
    // 热更新 耗时 976.17 ms, 909.03 ms, 777.48 ms

    let resolve: (value: unknown) => void
    let reject: (reason?: any) => void
    // 只使用一次
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    watcher.on('event', (e) => {
      if (e.code === 'START') {
        startTime = performance.now()
      }
      else if (e.code === 'END') {
        logger.success(`构建完成，耗时 ${(performance.now() - startTime).toFixed(2)} ms`)
        resolve(e)
      }
      else if (e.code === 'ERROR') {
        reject(e)
      }
    })
    await promise

    // await new Promise((resolve, reject) => {
    //   watcher.onCurrentRun('event', async (e) => {
    //     if (e.code === 'END') {
    //       debug?.('dev watcher listen end')
    //       resolve(e)
    //     }
    //     else if (e.code === 'ERROR') {
    //       reject(e)
    //     }
    //   })
    // })

    this.watcherService.setRollupWatcher(watcher)

    return watcher
  }

  private async runProd() {
    debug?.('prod build start')
    const output = (await build(
      this.configService.merge(undefined, this.sharedBuildConfig),
    ))
    if (this.checkWorkersOptions()) {
      await this.buildWorkers()
    }

    debug?.('prod build end')
    return output as RolldownOutput | RolldownOutput[]
  }

  async build(options?: BuildOptions) {
    if (this.configService.mpDistRoot) {
      const deletedFilePaths = await rimraf(
        [
          path.resolve(this.configService.outDir, '*'),
          path.resolve(this.configService.outDir, '.*')
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
      logger.success(`已清空 ${this.configService.mpDistRoot} 目录`)
    }
    debug?.('build start')
    let npmBuildTask: Promise<any> = Promise.resolve()
    if (!options?.skipNpm) {
      npmBuildTask = this.queue.add(
        () => {
          return this.npmService.build()
        },
      )
    }
    let result: RolldownOutput | RolldownOutput[] | RolldownWatcher
    if (this.configService.isDev) {
      result = await this.runDev()
    }
    else {
      result = await this.runProd()
    }

    await npmBuildTask

    debug?.('build end')
    return result
  }
}
