import type { MutableCompilerContext } from '../../context'
import { isObject, objectHash } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { requireConfigService } from '../utils/requireConfigService'

const CACHE_KEY_RE = /[\\/]/

function serializeDependencyScope(scope?: false | (string | RegExp)[]) {
  if (scope === false) {
    return false
  }

  if (!Array.isArray(scope)) {
    return undefined
  }

  return scope.map((item) => {
    return typeof item === 'string' ? item : item.toString()
  })
}

export interface DependenciesCache {
  getDependenciesCacheFilePath: (key?: string) => string
  dependenciesCacheHash: () => string
  writeDependenciesCache: (root?: string) => Promise<void>
  readDependenciesCache: (root?: string) => Promise<any>
  checkDependenciesCacheOutdate: (root?: string) => Promise<boolean>
}

export function createDependenciesCache(ctx: MutableCompilerContext): DependenciesCache {
  function getDependenciesCacheFilePath(key: string = '/') {
    const configService = requireConfigService(ctx, '生成 npm 缓存路径前必须初始化 configService。')
    return path.resolve(configService.cwd, `node_modules/weapp-vite/.cache/${key.replace(CACHE_KEY_RE, '-')}.json`)
  }

  function resolveDependencyScope(root?: string) {
    const configService = requireConfigService(ctx, '读取依赖缓存哈希前必须初始化 configService。')
    if (root === '__all__') {
      return undefined
    }
    if (root && root !== '/') {
      return ctx.scanService?.independentSubPackageMap.get(root)?.subPackage.dependencies
    }
    return configService.weappViteConfig?.npm?.mainPackageDependencies
  }

  function dependenciesCacheHash(root?: string) {
    const configService = requireConfigService(ctx, '读取依赖缓存哈希前必须初始化 configService。')
    return objectHash({
      dependencies: configService.packageJson.dependencies ?? {},
      scope: serializeDependencyScope(resolveDependencyScope(root)),
    })
  }

  async function writeDependenciesCache(root?: string) {
    const configService = requireConfigService(ctx, '写入 npm 缓存前必须初始化 configService。')
    if (configService.weappViteConfig?.npm?.cache) {
      await fs.outputJSON(getDependenciesCacheFilePath(root), {
        hash: dependenciesCacheHash(root),
      })
    }
  }

  async function readDependenciesCache(root?: string) {
    const cachePath = getDependenciesCacheFilePath(root)
    if (await fs.pathExists(cachePath)) {
      return await fs.readJson(cachePath, { throws: false })
    }
  }

  async function checkDependenciesCacheOutdate(root?: string) {
    if (ctx.configService?.weappViteConfig?.npm?.cache) {
      const json = await readDependenciesCache(root)
      if (isObject(json)) {
        return dependenciesCacheHash(root) !== json.hash
      }
      return true
    }
    return true
  }

  return {
    getDependenciesCacheFilePath,
    dependenciesCacheHash: () => dependenciesCacheHash(),
    writeDependenciesCache,
    readDependenciesCache,
    checkDependenciesCacheOutdate,
  }
}
