import type { RollupWatcher } from 'rollup'
import type { SubPackageMetaValue } from '../types'
import type { ConfigService } from './ConfigService'
import type { NpmService } from './NpmService'
import type { WatcherService } from './WatcherService'
import { inject, injectable } from 'inversify'
import { build } from 'vite'
import { debug, logBuildIndependentSubPackageFinish } from './shared'
import { Symbols } from './Symbols'
// 独立分包需要单独打包

@injectable()
export class SubPackageService {
  subPackageMeta: Record<string, SubPackageMetaValue>
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
    @inject(Symbols.NpmService)
    private readonly npmService: NpmService,
    @inject(Symbols.WatcherService)
    private readonly watcherService: WatcherService,
  ) {
    this.subPackageMeta = {} // 初始化子包元数据对象
  }

  async build() {
    debug?.('buildSubPackage start')
    for (const [root, meta] of Object.entries(this.subPackageMeta)) {
      const inlineConfig = this.configService.merge(meta, {
        build: {
          rollupOptions: {
            output: {
              chunkFileNames() {
                return `${root}/[name]-[hash].js`
              },
            },
          },
        },
      })
      await this.npmService.build(meta.subPackage)
      const output = (await build(
        inlineConfig,
      ))
      if (this.configService.options.isDev) {
        const watcher = output as RollupWatcher
        this.watcherService.setRollupWatcher(watcher, root)
        await new Promise((resolve, reject) => {
          watcher.on('event', (e) => {
            if (e.code === 'END') {
              logBuildIndependentSubPackageFinish(root)
              resolve(e)
            }
            else if (e.code === 'ERROR') {
              reject(e)
            }
          })
        })
      }
      else {
        logBuildIndependentSubPackageFinish(root)
      }
    }
    debug?.('buildSubPackage end')
  }
}
