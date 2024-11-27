// https://cn.vitejs.dev/guide/build.html#library-mode
// miniprogram_dist
// miniprogram

import type { PackageJson } from 'pkg-types'
import type { SubPackage, TsupOptions } from '../../types'
import type { CompilerContext } from '../CompilerContext'
import { defu, isObject } from '@weapp-core/shared'
import fs from 'fs-extra'
import { getPackageInfo, resolveModule } from 'local-pkg'
import path from 'pathe'
import { regExpTest } from '../../utils'
import { debug, logger } from '../shared'

// https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E7%BB%84%E4%BB%B6%E7%9B%B8%E5%85%B3%E7%A4%BA%E4%BE%8B
export async function buildNpm(this: CompilerContext, subPackage?: SubPackage, options?: TsupOptions) {
  debug?.('buildNpm start')
  const { build: tsupBuild } = await import('tsup')
  const isDependenciesCacheOutdate = await this.checkDependenciesCacheOutdate()

  let packNpmRelationList: {
    packageJsonPath: string
    miniprogramNpmDistDir: string
  }[] = []
  if (this.projectConfig.setting?.packNpmManually && Array.isArray(this.projectConfig.setting.packNpmRelationList)) {
    packNpmRelationList = this.projectConfig.setting.packNpmRelationList
  }
  else {
    packNpmRelationList = [
      {
        miniprogramNpmDistDir: '.',
        packageJsonPath: './package.json',
      },
    ]
  }
  const heading = subPackage?.root ? `分包[${subPackage.root}]:` : ''
  for (const relation of packNpmRelationList) {
    const packageJsonPath = path.resolve(this.cwd, relation.packageJsonPath)
    if (await fs.exists(packageJsonPath)) {
      const pkgJson: PackageJson = await fs.readJson(packageJsonPath)
      const outDir = path.resolve(this.cwd, relation.miniprogramNpmDistDir, subPackage?.root ?? '', 'miniprogram_npm')
      if (pkgJson.dependencies) {
        const dependencies = Object.keys(pkgJson.dependencies)
        if (dependencies.length > 0) {
          for (const dep of dependencies) {
            if (Array.isArray(subPackage?.dependencies)) {
              if (!regExpTest(subPackage.dependencies, dep)) {
                continue
              }
            }
            const packageInfo = await getPackageInfo(dep)
            if (!packageInfo) {
              continue
            }
            const { packageJson: targetJson, rootPath } = packageInfo
            if (Reflect.has(targetJson, 'miniprogram') && targetJson.miniprogram) {
              const destOutDir = path.join(outDir, dep)
              if (!isDependenciesCacheOutdate && await fs.exists(destOutDir)) {
                logger.info(`${heading} ${dep} 依赖未发生变化，跳过处理!`)
                continue
              }
              await fs.copy(
                path.resolve(
                  rootPath,
                  targetJson.miniprogram,
                ),
                destOutDir,
              )
            }
            else {
              const destOutDir = path.join(outDir, dep)
              if (!isDependenciesCacheOutdate && await fs.exists(destOutDir)) {
                logger.info(`${heading} ${dep} 依赖未发生变化，跳过处理!`)
                continue
              }
              const index = resolveModule(dep)
              if (!index) {
                continue
              }
              const mergedOptions: TsupOptions = defu<TsupOptions, TsupOptions[]>(options, {
                entry: {
                  index,
                },
                format: ['cjs'],
                outDir: destOutDir,
                silent: true,
                shims: true,
                outExtension: () => {
                  return {
                    js: '.js',
                  }
                },
                sourcemap: false,
                config: false,
                // https://tsup.egoist.dev/#compile-time-environment-variables
                env: {
                  NODE_ENV: 'production',
                },
                // external: [],
                // clean: false,
              })
              const resolvedOptions = this.inlineConfig.weapp?.npm?.tsup?.(mergedOptions, { entry: index, name: dep })
              let finalOptions: TsupOptions | undefined
              if (resolvedOptions === undefined) {
                finalOptions = mergedOptions
              }
              else if (isObject(resolvedOptions)) {
                finalOptions = resolvedOptions
              }
              finalOptions && await tsupBuild(finalOptions)
            }
            logger.success(`${heading} ${dep} 依赖处理完成!`)
          }
        }
      }
    }
  }
  await this.writeDependenciesCache()
  debug?.('buildNpm end')
}
