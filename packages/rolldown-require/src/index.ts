import type { Options } from './types'
import { bundleFile } from './bundler'
import {
  importCachedCode,
  maybeReadCache,
  resolveCacheOptions,
  writeMemoryCache,
} from './cache'
import { configDefaults } from './config'
import { loadFromBundledFile } from './loader'
import { createInternalOptions, detectModuleType, resolveEntryFilepath } from './options'

export { configDefaults }
export { bundleFile } from './bundler'
export { loadFromBundledFile } from './loader'

export async function bundleRequire<T = any>(options: Options): Promise<{
  mod: T
  dependencies: string[]
}> {
  const resolvedPath = resolveEntryFilepath(options)
  const isESM = detectModuleType(resolvedPath)
  const internalOptions = createInternalOptions(options, isESM)

  const cacheConfig = resolveCacheOptions(resolvedPath, internalOptions)
  if (cacheConfig.enabled) {
    const cached = await maybeReadCache(cacheConfig, internalOptions)
    if (cached) {
      const mod = await importCachedCode(cached, internalOptions)
      if (cacheConfig.memory && cached.meta) {
        writeMemoryCache(cacheConfig, mod, cached.meta)
      }
      const dependencies = cached.meta?.files
        ?.map(file => file.path)
        .filter(file => file !== cacheConfig.entryPath)
        ?? []
      return { mod, dependencies }
    }
  }

  const bundled = await bundleFile(
    resolvedPath,
    internalOptions,
  )
  const mod = await loadFromBundledFile(
    resolvedPath,
    bundled.code,
    internalOptions,
    bundled.dependencies,
  )

  return {
    mod,
    dependencies: bundled.dependencies,
  }
}
