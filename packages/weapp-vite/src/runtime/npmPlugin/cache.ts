import type { MutableCompilerContext } from '../../context'
import { isObject, objectHash } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { requireConfigService } from '../utils/requireConfigService'

export interface DependenciesCache {
  getDependenciesCacheFilePath: (key?: string) => string
  dependenciesCacheHash: () => string
  writeDependenciesCache: (root?: string) => Promise<void>
  readDependenciesCache: (root?: string) => Promise<any>
  checkDependenciesCacheOutdate: (root?: string) => Promise<boolean>
}

export function createDependenciesCache(ctx: MutableCompilerContext): DependenciesCache {
  function getDependenciesCacheFilePath(key: string = '/') {
    const configService = requireConfigService(ctx, 'configService must be initialized before generating npm cache path')
    return path.resolve(configService.cwd, `node_modules/weapp-vite/.cache/${key.replaceAll('/', '-')}.json`)
  }

  function dependenciesCacheHash() {
    const configService = requireConfigService(ctx, 'configService must be initialized before accessing dependencies cache hash')
    return objectHash(configService.packageJson.dependencies ?? {})
  }

  async function writeDependenciesCache(root?: string) {
    const configService = requireConfigService(ctx, 'configService must be initialized before writing npm cache')
    if (configService.weappViteConfig?.npm?.cache) {
      await fs.outputJSON(getDependenciesCacheFilePath(root), {
        hash: dependenciesCacheHash(),
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
        return dependenciesCacheHash() !== json.hash
      }
      return true
    }
    return true
  }

  return {
    getDependenciesCacheFilePath,
    dependenciesCacheHash,
    writeDependenciesCache,
    readDependenciesCache,
    checkDependenciesCacheOutdate,
  }
}
