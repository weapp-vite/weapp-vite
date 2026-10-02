import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { buildWorkerAssets, getWorkerSources } from '../runtime/buildPlugin/workerPlan'
import { pruneOwnedAssetFiles } from './asset/prune'

/** 主应用和 worker 共用发布事务；子目标自身不持有 watcher 或输出目录。 */
export function createWorkerOutputPlugin(ctx: CompilerContext): Plugin {
  let bundledDev = false
  let outDir: string | undefined
  let ownedWorkerFiles = new Set<string>()
  let pendingWorkerFiles: Set<string> | undefined
  return {
    name: 'weapp-vite:worker-output',
    config(_config, env) {
      if (env.command === 'build' && ctx.configService.weappViteConfig.worker?.entry) {
        return { builder: { sharedConfigBuild: true } }
      }
    },
    configResolved(config) {
      bundledDev = config.experimental?.bundledDev === true
      outDir = config.build.outDir
    },
    generateBundle: {
      order: 'pre',
      async handler() {
        if (bundledDev) {
          return
        }
        try {
          const assets = await buildWorkerAssets(ctx)
          pendingWorkerFiles = new Set(assets.map(asset => asset.fileName))
          for (const asset of assets) {
            this.emitFile(asset)
          }
        }
        finally {
          const sources = getWorkerSources(ctx)
          for (const file of [...sources.files, ...sources.roots]) {
            this.addWatchFile(file)
          }
        }
      },
    },
    async writeBundle() {
      if (bundledDev || !pendingWorkerFiles || !outDir) {
        return
      }
      const nextWorkerFiles = pendingWorkerFiles
      pendingWorkerFiles = undefined
      const removedWorkerFiles = [...ownedWorkerFiles].filter(file => !nextWorkerFiles.has(file))
      await pruneOwnedAssetFiles(outDir, removedWorkerFiles)
      ownedWorkerFiles = nextWorkerFiles
    },
  }
}
