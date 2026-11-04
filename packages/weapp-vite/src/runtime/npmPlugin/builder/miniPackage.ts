import type { MutableCompilerContext } from '../../../context'
import type { NpmBuildOptions } from '../../../types'
import type { PackageBuildOutput } from './output'
import type { BuildPackageArgs } from './packageBuilder'
import type { PlannedPackage } from './packagePlan'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { getPlatformNpmDistDirName, shouldCopyEsModuleDirectory, shouldHoistNestedMiniprogramDependencies, shouldNormalizeMiniprogramPackage, shouldRebuildCachedMiniprogramPackage } from '../../../platform'
import { copyEsModuleDirectoryForAlipay, hoistNestedMiniprogramDependenciesForAlipay, normalizeMiniprogramPackageForAlipay, shouldRebuildCachedAlipayMiniprogramPackage } from './alipay'
import { normalizeMiniprogramPackageJsModules } from './jsModule'

export interface ResolvedPackageBuildTarget {
  outDir: string
  options?: NpmBuildOptions
}

/** 原生包先完成过滤、规范化及缓存校验，依赖计划随后扫描这份实际保留的集合。 */
export async function prepareMiniPackage(node: PlannedPackage, operations: {
  ctx: MutableCompilerContext
  output?: PackageBuildOutput
  resolveTarget: (args: { entry: Record<string, string>, name: string, options?: NpmBuildOptions, outDir: string }) => ResolvedPackageBuildTarget
  copyBuild: (args: { from: string, to: string, name: string }) => Promise<void>
  shouldSkipBuild: (outDir: string, isOutdated: boolean) => Promise<boolean>
  skip: (dep: string) => void
}) {
  const { ctx, output } = operations
  if (!ctx.configService) {
    return
  }
  const { args, packageInfo: { packageJson, rootPath } } = node
  const { dep, outDir, options, isDependenciesCacheOutdate }: BuildPackageArgs = args
  const sourceDir = path.resolve(rootPath, packageJson.miniprogram!)
  output?.watchFile?.(sourceDir)
  const target = operations.resolveTarget({ entry: { index: sourceDir }, name: dep, options, outDir: path.resolve(outDir, dep) })
  if (!target.options) {
    operations.skip(dep)
    return
  }
  const destOutDir = output?.directory(target.outDir) ?? target.outDir
  const packageOutDir = output?.directory(outDir) ?? outDir
  let reuse = await operations.shouldSkipBuild(destOutDir, isDependenciesCacheOutdate)
  const npmDistDirName = getPlatformNpmDistDirName(ctx.configService.platform, { alipayNpmMode: ctx.configService.weappViteConfig?.npm?.alipayNpmMode })
  const esDirectory = shouldCopyEsModuleDirectory(ctx.configService.platform) && npmDistDirName === 'node_modules'
    && await fs.pathExists(path.join(rootPath, 'es'))
    ? path.join(rootPath, 'es')
    : undefined
  if (esDirectory) {
    output?.watchFile?.(esDirectory)
  }
  if (reuse) {
    await normalizeMiniprogramPackageJsModules(destOutDir, { markEsModule: true })
    reuse = !(shouldRebuildCachedMiniprogramPackage(ctx.configService.platform)
      && await shouldRebuildCachedAlipayMiniprogramPackage(destOutDir, packageOutDir, rootPath, npmDistDirName as 'miniprogram_npm' | 'node_modules'))
  }
  if (!reuse) {
    await operations.copyBuild({ from: sourceDir, to: destOutDir, name: dep })
    await normalizeMiniprogramPackageJsModules(destOutDir, { markEsModule: true })
    if (shouldNormalizeMiniprogramPackage(ctx.configService.platform)) {
      if (shouldCopyEsModuleDirectory(ctx.configService.platform) && npmDistDirName === 'node_modules') {
        await copyEsModuleDirectoryForAlipay(rootPath, destOutDir, { dereference: Boolean(output) })
      }
      await normalizeMiniprogramPackageForAlipay(destOutDir)
      if (shouldHoistNestedMiniprogramDependencies(ctx.configService.platform)) {
        await hoistNestedMiniprogramDependenciesForAlipay(destOutDir, packageOutDir)
      }
    }
  }
  // 命中原生包缓存也必须继续收集依赖；普通包可能缺少新增或被删除的子入口。
  return {
    directory: destOutDir,
    logicalDirectory: target.outDir,
    sourceDirectory: sourceDir,
    esDirectory,
  }
}
