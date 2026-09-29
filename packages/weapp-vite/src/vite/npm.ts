import type { EmittedAsset } from 'rolldown'
import type { CompilerContext } from '../context'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import {
  resolveMainBuildDependencyPatterns,
  resolveNpmBuildCandidateDependenciesSync,
  resolveTargetDependencies,
} from '../runtime/npmPlugin/service/dependencies'

/** 复用依赖编译器准备中间产物，最终输出统一交给宿主 emit/write。 */
export async function prepareNpmAssets(ctx: CompilerContext): Promise<EmittedAsset[]> {
  if (ctx.configService.weappLibConfig?.enabled || !ctx.configService.weappViteConfig.npm?.enable) {
    return []
  }
  const candidates = resolveNpmBuildCandidateDependenciesSync(ctx, ctx.configService.packageJson)
  if (!candidates.length) {
    return []
  }
  ctx.scanService.loadSubPackages()
  const targets = [
    { root: '', dependencies: resolveTargetDependencies(candidates, resolveMainBuildDependencyPatterns(ctx)) },
    ...[...ctx.scanService.subPackageMap.values()]
      .filter(entry => entry.subPackage.dependencies?.length)
      .map(entry => ({ root: entry.subPackage.root, dependencies: resolveTargetDependencies(candidates, entry.subPackage.dependencies) })),
  ]
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-npm-'))
  const assets: EmittedAsset[] = []
  async function collect(directory: string, outputPrefix: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const source = path.join(directory, entry.name)
      const fileName = path.posix.join(outputPrefix, entry.name)
      if (entry.isDirectory()) {
        await collect(source, fileName)
      }
      else if (entry.isFile()) {
        assets.push({ type: 'asset', fileName, source: await readFile(source) })
      }
    }
  }
  try {
    for (const [index, target] of targets.entries()) {
      if (!target.dependencies.length) {
        continue
      }
      const outDir = path.join(temporaryRoot, String(index))
      const results = await Promise.allSettled(target.dependencies.map(dep => ctx.npmService.buildPackage({
        dep,
        outDir,
        isDependenciesCacheOutdate: true,
      })))
      // 等全部子构建退出后才能移除中间目录，避免失败后仍有任务写回。
      const failure = results.find(result => result.status === 'rejected')
      if (failure?.status === 'rejected') {
        throw failure.reason
      }
      await collect(outDir, path.posix.join(target.root, 'miniprogram_npm'))
    }
    return assets
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
