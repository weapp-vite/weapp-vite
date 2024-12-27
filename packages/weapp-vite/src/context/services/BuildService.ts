import type { RollupOutput, RollupWatcher } from 'rollup'
import type { ConfigService, SubPackageService, WatcherService } from '.'
import process from 'node:process'
import { deleteAsync } from 'del'
import { inject, injectable } from 'inversify'
import path from 'pathe'
import { build } from 'vite'
import { debug, logger } from '../shared'
import { Symbols } from '../Symbols'

@injectable()
export class BuildService {
  constructor(
    @inject(Symbols.ConfigService)
    public readonly configService: ConfigService,
    @inject(Symbols.WatcherService)
    public readonly watcherService: WatcherService,
    @inject(Symbols.SubPackageService)
    public readonly subPackageService: SubPackageService,
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
          await this.subPackageService.build()
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
    await this.subPackageService.build()
    return output as RollupOutput | RollupOutput[]
  }

  async build() {
    if (this.configService.mpDistRoot) {
      const deletedFilePaths = await deleteAsync(
        [
          path.resolve(this.configService.outDir, '**'),
        ],
        {
          ignore: ['**/miniprogram_npm/**'],
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
    debug?.('build end')
  }
}
