import type { PackageJson } from 'pkg-types'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { PreparedNpmOutput } from './output'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { createPackageBuilder } from '../../runtime/npmPlugin/builder'
import { settlePackageBuilds } from '../../runtime/npmPlugin/builder/output'
import { getPackNpmRelationList } from '../../runtime/npmPlugin/relations'
import {
  resolveMainBuildDependencyPatterns,
  resolveNpmBuildCandidateDependenciesSync,
  resolveNpmDistDirName,
  resolveTargetDependencies,
} from '../../runtime/npmPlugin/service/dependencies'
import { createOxcRuntimeSupport } from '../../runtime/oxcRuntime'
import { createNpmOutput } from './output'

export type { PreparedNpmOutput } from './output'

/** 复用依赖编译器和 npm 关联配置，最终输出统一交给宿主 emit/write。 */
export async function prepareNpmAssets(ctx: CompilerContext): Promise<PreparedNpmOutput> {
  const config = ctx.configService
  const empty = { assets: [], external: new Map(), watchFiles: [] }
  if (config.weappLibConfig?.enabled || !config.weappViteConfig.npm?.enable) {
    return empty
  }
  const [main, ...mirrors] = getPackNpmRelationList(ctx, { defaultOutputRoot: config.outDir })
  if (!main) {
    return empty
  }
  const packageJsonPath = path.resolve(config.cwd, main.packageJsonPath)
  const resolveFrom = path.dirname(packageJsonPath)
  let packageJson: PackageJson
  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return empty
    }
    throw error
  }
  const candidates = resolveNpmBuildCandidateDependenciesSync(ctx, packageJson, resolveFrom)
  ctx.scanService.loadSubPackages()
  const npmDirName = resolveNpmDistDirName(config)
  const mainOutDir = path.resolve(config.cwd, main.miniprogramNpmDistDir, npmDirName)
  const targets = [
    { outDir: mainOutDir, dependencies: resolveTargetDependencies(candidates, resolveMainBuildDependencyPatterns(ctx)) },
    ...[...ctx.scanService.subPackageMap.values()]
      .filter(entry => entry.subPackage.dependencies?.length)
      .map(entry => ({ outDir: path.join(config.outDir, entry.subPackage.root, npmDirName), dependencies: resolveTargetDependencies(candidates, entry.subPackage.dependencies) })),
  ]
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-npm-'))
  const capture = createNpmOutput(temporaryRoot, targets.map(target => target.outDir))
  capture.output.watchFile?.(packageJsonPath)
  const builder = createPackageBuilder(ctx, createOxcRuntimeSupport().vitePlugin as Plugin | undefined, capture.output)
  try {
    for (const target of targets) {
      await settlePackageBuilds(target.dependencies.map(dep => builder.buildPackage({
        dep,
        resolveFrom,
        outDir: target.outDir,
        isDependenciesCacheOutdate: true,
      })))
    }
    const result = await capture.finish(config.outDir, mainOutDir, mirrors.map(relation => path.resolve(config.cwd, relation.miniprogramNpmDistDir, npmDirName)))
    if (result.external.size && config.inlineConfig.build?.write === false) {
      throw new Error('[weapp-vite] build.write=false 无法表示宿主输出目录之外的 npm 产物；请使用 write=true 或将 npm 输出映射到宿主 outDir 内。')
    }
    return result
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
