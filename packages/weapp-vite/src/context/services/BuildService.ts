import type { RollupOutput, RollupWatcher } from 'rollup'
import type { ConfigService, NpmService, ScanService, WatcherService } from '.'
import process from 'node:process'
import { inject, injectable } from 'inversify'
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

  }

  async runDev() {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }
    debug?.('dev build watcher start')
    const watcher = (
      await build(
        this.configService.merge(),
      )
    ) as RollupWatcher
    debug?.('dev build watcher end')
    debug?.('dev watcher listen start')
    await new Promise((resolve, reject) => {
      watcher.on('event', async (e) => {
        if (e.code === 'END') {
          debug?.('dev watcher listen end')
          resolve(e)
        }
        else if (e.code === 'ERROR') {
          reject(e)
        }
      })
    })
    this.watcherService.setRollupWatcher(watcher)

    return watcher
  }

  async runProd() {
    debug?.('prod build start')
    const output = (await build(
      this.configService.merge(),
    ))
    debug?.('prod build end')
    return output as RollupOutput | RollupOutput[]
  }

  async build(options?: BuildOptions) {
    if (this.configService.mpDistRoot) {
      const deletedFilePaths = await rimraf(
        [
          path.resolve(this.configService.outDir, '**'),
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
    if (this.configService.isDev) {
      await this.runDev()
    }
    else {
      await this.runProd()
    }
    if (!options?.skipNpm) {
      await Promise.all(
        [
          this.npmService.build(),
          ...this.scanService.subPackageMetas.map((x) => {
            return this.npmService.build(x.subPackage)
          }),
        ],
      )
    }

    debug?.('build end')
  }
}
