import type { EmittedAsset } from 'rolldown'
import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../context'
import { readFile } from 'node:fs/promises'
import path from 'pathe'
import { pruneOwnedAssetFiles } from './prune'
import { createPublicAssetSourcePlan } from './publicSources'

/** public 在编译与校验完成后按原始字节发布，避免复制覆盖增量中未重写的编译产物。 */
export function createPublicAssetPublication(ctx: CompilerContext) {
  let config: ResolvedConfig
  let plan: ReturnType<typeof createPublicAssetSourcePlan> | undefined
  let pending: Promise<string[]> = Promise.resolve([])
  let compiled = new Set<string>()
  let nextCompiled = new Set<string>()
  let owned = new Set<string>()
  let nextOwned = new Set<string>()
  let outDir: string
  return {
    configure(resolved: ResolvedConfig) {
      config = resolved
      outDir = path.resolve(config.root, config.build.outDir)
      plan = (ctx.currentBuildTarget ?? 'app') === 'app' && ctx.configService.isDev
        && config.build.write !== false && !config.experimental?.bundledDev
        ? createPublicAssetSourcePlan({ publicDir: config.publicDir, copyPublicDir: config.build.copyPublicDir }, outDir)
        : undefined
    },
    start(environmentConfig?: { build: { copyPublicDir: boolean } }) {
      if (!plan) {
        return
      }
      // configResolved 观察者先取得用户配置；renderStart 之前交回 bundler 输出所有权。
      config.build.copyPublicDir = false
      if (environmentConfig) {
        environmentConfig.build.copyPublicDir = false
      }
      pending = plan.scan()
    },
    async emit(files: Iterable<string>, partial: boolean, emitFile: (asset: EmittedAsset) => void) {
      if (!plan) {
        return
      }
      nextCompiled = new Set([...(partial ? compiled : []), ...files])
      nextOwned = new Set()
      for (const file of await pending) {
        const fileName = plan.outputName(file)
        if (nextCompiled.has(fileName)) {
          continue
        }
        nextOwned.add(fileName)
        emitFile({ type: 'asset', fileName, source: await readFile(file), originalFileName: file })
      }
    },
    async commit() {
      if (!plan) {
        return
      }
      const removed = [...owned].filter(file => !nextOwned.has(file) && !nextCompiled.has(file))
      await pruneOwnedAssetFiles(outDir, removed)
      compiled = nextCompiled
      owned = nextOwned
    },
  }
}
