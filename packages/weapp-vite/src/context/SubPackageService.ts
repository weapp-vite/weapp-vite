import type { RollupWatcher } from 'rollup'
import type { ConfigService } from './ConfigService'
import type { EnvService } from './EnvService'
import type { NpmService } from './NpmService'
import { inject, injectable } from 'inversify'
import { build } from 'vite'
import { debug, logBuildIndependentSubPackageFinish } from './shared'
import { Symbols } from './Symbols'
// 独立分包需要单独打包

@injectable()
export class SubPackageService {
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
    @inject(Symbols.EnvService)
    private readonly envService: EnvService,
    @inject(Symbols.NpmService)
    private readonly npmService: NpmService,
  ) {

  }

  mergeConfig() {

  }

  async build() {
    debug?.('buildSubPackage start')
    for (const [root, meta] of Object.entries(this.subPackageMeta)) {
      const inlineConfig = this.getConfig(meta, {
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
      if (this.isDev) {
        const watcher = output as RollupWatcher
        this.setRollupWatcher(watcher, root)
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
