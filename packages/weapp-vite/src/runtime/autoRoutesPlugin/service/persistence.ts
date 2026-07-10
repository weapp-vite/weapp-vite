import type { MutableCompilerContext } from '../../../context'
import type { RuntimeState } from '../../runtimeState'
import type { AutoRoutesPersistentCache } from './shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { resolveWeappAutoRoutesConfig } from '../../../autoRoutesConfig'
import { logger } from '../../../context/shared'
import { applyPersistentCache, AUTO_ROUTES_CACHE_FILE, createPersistentCachePayload, resolvePersistentCacheBaseDir, resolveTypedRouterOutputPath, TYPED_ROUTER_OUTPUT_FILE } from './shared'

function getResolvedConfig(ctx: MutableCompilerContext) {
  return resolveWeappAutoRoutesConfig(ctx.configService?.weappViteConfig?.autoRoutes)
}

function resolvePersistentCachePath(ctx: MutableCompilerContext) {
  const autoRoutesConfig = getResolvedConfig(ctx)
  if (!autoRoutesConfig.persistentCache) {
    return undefined
  }
  const configService = ctx.configService
  if (!configService) {
    return undefined
  }
  const baseDir = resolvePersistentCacheBaseDir(configService)
  if (!baseDir) {
    return undefined
  }
  return path.resolve(baseDir, autoRoutesConfig.persistentCachePath ?? AUTO_ROUTES_CACHE_FILE)
}

function resolveDefaultPersistentCachePath(ctx: MutableCompilerContext) {
  const configService = ctx.configService
  if (!configService) {
    return undefined
  }
  const baseDir = resolvePersistentCacheBaseDir(configService)
  if (!baseDir) {
    return undefined
  }
  return path.resolve(baseDir, AUTO_ROUTES_CACHE_FILE)
}

async function hasSameTextContent(filePath: string, content: string) {
  try {
    return await fs.pathExists(filePath) && await fs.readFile(filePath, 'utf8') === content
  }
  catch {
    return false
  }
}

async function hasSamePersistentCachePayload(filePath: string, payload: AutoRoutesPersistentCache) {
  try {
    if (!await fs.pathExists(filePath)) {
      return false
    }
    const current = await fs.readJson(filePath) as AutoRoutesPersistentCache
    return JSON.stringify(current) === JSON.stringify(payload)
  }
  catch {
    return false
  }
}

async function collectWatchFileMtims(watchFiles: Iterable<string>) {
  const entries = await Promise.all([...watchFiles].map(async (filePath) => {
    const stat = await fs.stat(filePath)
    return [filePath, stat.mtimeMs] as const
  }))

  return Object.fromEntries(entries) as Record<string, number>
}

export async function restorePersistentCache(ctx: MutableCompilerContext, state: RuntimeState['autoRoutes']) {
  if (!getResolvedConfig(ctx).persistentCache) {
    return false
  }
  const cachePath = resolvePersistentCachePath(ctx)
  if (!cachePath || !await fs.pathExists(cachePath)) {
    return false
  }

  try {
    const cache = await fs.readJson(cachePath) as AutoRoutesPersistentCache
    if (cache?.version !== 1) {
      return false
    }
    const watchFiles = Array.isArray(cache.watchFiles) ? cache.watchFiles : []
    if (watchFiles.length === 0) {
      return false
    }

    const cachedMtims = cache.fileMtims
    if (!cachedMtims) {
      return false
    }
    const fileMtims = await collectWatchFileMtims(watchFiles)
    for (const filePath of watchFiles) {
      const expectedMtime = cachedMtims[filePath]
      if (
        typeof expectedMtime !== 'number'
        || !Number.isFinite(expectedMtime)
        || fileMtims[filePath] !== expectedMtime
      ) {
        return false
      }
    }

    applyPersistentCache(state, cache)
    return true
  }
  catch {
    return false
  }
}

export async function writePersistentCache(ctx: MutableCompilerContext, state: RuntimeState['autoRoutes']) {
  const cachePath = resolvePersistentCachePath(ctx)
  if (!cachePath || !state.initialized || !getResolvedConfig(ctx).persistentCache) {
    return
  }

  let fileMtims: Record<string, number>
  try {
    fileMtims = await collectWatchFileMtims(state.watchFiles)
  }
  catch {
    return
  }

  try {
    const payload = createPersistentCachePayload(state, fileMtims)
    if (await hasSamePersistentCachePayload(cachePath, payload)) {
      return
    }
    await fs.outputJson(cachePath, payload, { spaces: 2 })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`写入 auto-routes 缓存失败: ${message}`)
  }
}

export async function removePersistentCache(ctx: MutableCompilerContext) {
  const cachePath = resolvePersistentCachePath(ctx) ?? resolveDefaultPersistentCachePath(ctx)
  if (!cachePath) {
    return
  }

  try {
    if (await fs.pathExists(cachePath)) {
      await fs.remove(cachePath)
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`移除 auto-routes 缓存失败: ${message}`)
  }
}

export async function removeTypedRouterDefinition(ctx: MutableCompilerContext) {
  const configService = ctx.configService
  if (!configService) {
    return false
  }
  const outputPath = resolveTypedRouterOutputPath(configService)
  try {
    if (await fs.pathExists(outputPath)) {
      await fs.remove(outputPath)
    }
    return true
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`移除 ${TYPED_ROUTER_OUTPUT_FILE} 失败: ${message}`)
    return false
  }
}

export async function writeTypedRouterDefinition(
  ctx: MutableCompilerContext,
  typedDefinition: string,
  lastWrittenTypedDefinition: string | undefined,
) {
  const autoRoutesConfig = getResolvedConfig(ctx)
  if (!autoRoutesConfig.enabled || !autoRoutesConfig.typedRouter) {
    const removed = await removeTypedRouterDefinition(ctx)
    return removed ? undefined : lastWrittenTypedDefinition
  }

  const configService = ctx.configService
  if (!configService) {
    return lastWrittenTypedDefinition
  }
  const outputPath = resolveTypedRouterOutputPath(configService)
  if (!typedDefinition || typedDefinition === lastWrittenTypedDefinition) {
    return lastWrittenTypedDefinition
  }

  try {
    if (await hasSameTextContent(outputPath, typedDefinition)) {
      return typedDefinition
    }
    await fs.outputFile(outputPath, typedDefinition, 'utf8')
    return typedDefinition
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`写入 ${TYPED_ROUTER_OUTPUT_FILE} 失败: ${message}`)
    return lastWrittenTypedDefinition
  }
}
