import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { buildWorkerAssets, getWorkerSources } from '../runtime/buildPlugin/workerPlan'
import { pruneOwnedAssetFiles } from './asset/prune'

/** 主应用和 worker 共用发布事务；子目标自身不持有 watcher 或输出目录。 */
export function createWorkerOutputPlugin(ctx: CompilerContext): Plugin {
  let buildMode = false
  let bundledDev = false
  let outDir: string | undefined
  let ownedWorkerFiles = new Set<string>()
  let pendingWorkerFiles: Set<string> | undefined
  let prepared: { assets: Awaited<ReturnType<typeof buildWorkerAssets>> } | { error: unknown } | undefined
  return {
    name: 'weapp-vite:worker-output',
    config(_config, env) {
      if (env.command === 'build' && ctx.configService.weappViteConfig.worker?.entry) {
        return { builder: { sharedConfigBuild: true } }
      }
    },
    configResolved(config) {
      buildMode = config.command === 'build'
      bundledDev = config.experimental?.bundledDev === true
      outDir = config.build.outDir
    },
    buildStart: {
      order: 'post',
      sequential: true,
      async handler() {
        prepared = undefined
        pendingWorkerFiles = undefined
        if (!buildMode || bundledDev) {
          return
        }
        try {
          prepared = { assets: await buildWorkerAssets(ctx) }
        }
        catch (error) {
          // 保留原报告阶段，使主图仍能扫描并登记 app 配置等恢复输入。
          prepared = { error }
        }
        finally {
          // 原生扫描结束前收齐 worker 输入，避免写出后新增监听重启事件流。
          const sources = getWorkerSources(ctx)
          for (const file of [...sources.files, ...sources.roots]) {
            this.addWatchFile(file)
          }
        }
      },
    },
    generateBundle: {
      order: 'pre',
      handler() {
        if (!prepared) {
          return
        }
        if ('error' in prepared) {
          throw prepared.error
        }
        pendingWorkerFiles = new Set(prepared.assets.map(asset => asset.fileName))
        for (const asset of prepared.assets) {
          this.emitFile(asset)
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
