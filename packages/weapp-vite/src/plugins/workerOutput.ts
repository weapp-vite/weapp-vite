import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { buildWorkerAssets, getWorkerSources } from '../runtime/buildPlugin/workerPlan'

/** 主应用和 worker 共用发布事务；子目标自身不持有 watcher 或输出目录。 */
export function createWorkerOutputPlugin(ctx: CompilerContext): Plugin {
  let bundledDev = false
  return {
    name: 'weapp-vite:worker-output',
    config(_config, env) {
      if (env.command === 'build' && ctx.configService.weappViteConfig.worker?.entry) {
        return { builder: { sharedConfigBuild: true } }
      }
    },
    configResolved(config) {
      bundledDev = config.experimental?.bundledDev === true
    },
    generateBundle: {
      order: 'pre',
      async handler() {
        if (bundledDev) {
          return
        }
        try {
          for (const asset of await buildWorkerAssets(ctx)) {
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
  }
}
