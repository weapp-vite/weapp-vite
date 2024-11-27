import type { RollupWatcher } from 'rollup'
import type { CompilerContext } from '../CompilerContext'
import { build } from 'vite'
import { debug, logBuildIndependentSubPackageFinish } from '../shared'
// 独立分包需要单独打包
export async function buildSubPackage(this: CompilerContext) {
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
    await this.buildNpm(meta.subPackage)
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
