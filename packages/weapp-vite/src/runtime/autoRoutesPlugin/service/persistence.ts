import type { MutableCompilerContext } from '../../../context'
import type { RuntimeState } from '../../runtimeState'
import type { AutoRoutesPersistentCache } from './shared'
import { isObject } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { resolveWeappAutoRoutesConfig } from '../../../autoRoutesConfig'
import { logger } from '../../../context/shared'
import {
  applyPersistentCache,
  AUTO_ROUTES_CACHE_FILE,
  createAutoRoutesSourceFingerprint,
  createPersistentCachePayload,
  resolvePersistentCacheBaseDir,
  resolveTypedRouterOutputPath,
  TYPED_ROUTER_OUTPUT_FILE,
} from './shared'

function getResolvedConfig(ctx: MutableCompilerContext) {
  return resolveWeappAutoRoutesConfig(ctx.configService?.weappViteConfig?.autoRoutes)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  return isObject(value)
    && !Array.isArray(value)
    && Object.values(value).every(isStringArray)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isObject(value)
    && !Array.isArray(value)
    && Object.values(value).every(item => typeof item === 'string')
}

function isPersistentCache(value: unknown, topologyKey: string): value is AutoRoutesPersistentCache {
  if (
    !isObject(value)
    || Array.isArray(value)
    || !isObject(value.snapshot)
    || Array.isArray(value.snapshot)
    || !isObject(value.fileMtims)
    || Array.isArray(value.fileMtims)
    || !isStringArrayRecord(value.pageDeclarationDependencies)
    || !isStringRecord(value.pageDeclarationFingerprints)
  ) {
    return false
  }
  const subPackages = value.snapshot.subPackages
  const namedRoutes = value.namedRoutes
  const pageSourceFiles = value.pageSourceFiles
  const dependencyEntries = Object.entries(value.pageDeclarationDependencies)
  const fingerprints = value.pageDeclarationFingerprints
  return value.version === 4
    && value.topologyKey === topologyKey
    && typeof value.usesOpaquePageDeclarationResolver === 'boolean'
    && isStringArray(value.snapshot.pages)
    && isStringArray(value.snapshot.entries)
    && Array.isArray(subPackages)
    && subPackages.every(pkg =>
      isObject(pkg)
      && !Array.isArray(pkg)
      && typeof pkg.root === 'string'
      && isStringArray(pkg.pages),
    )
    && Array.isArray(namedRoutes)
    && namedRoutes.every(route =>
      isObject(route)
      && !Array.isArray(route)
      && typeof route.name === 'string'
      && typeof route.path === 'string'
      && isObject(route.meta)
      && !Array.isArray(route.meta),
    )
    && isStringArray(pageSourceFiles)
    && isStringArray(value.namedRouteSourceFiles)
    && isStringArray(value.watchFiles)
    && isStringArray(value.watchDirs)
    && dependencyEntries.every(([, owners]) => isStringArray(owners))
    && Object.values(fingerprints).every(fingerprint => typeof fingerprint === 'string')
    && pageSourceFiles.every(sourceFile => Object.hasOwn(fingerprints, sourceFile))
    && dependencyEntries.every(([dependency, owners]) =>
      Object.hasOwn(fingerprints, dependency)
      && owners.every(owner => pageSourceFiles.includes(owner)),
    )
    && Object.values(value.fileMtims).every(mtime => typeof mtime === 'number' && Number.isFinite(mtime))
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
    const current: unknown = await fs.readJson(filePath)
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

export async function restorePersistentCache(
  ctx: MutableCompilerContext,
  state: RuntimeState['autoRoutes'],
  topologyKey: string,
  isCurrent: () => boolean = () => true,
  hasOpaquePageDeclarationSourceResolver = false,
) {
  if (!getResolvedConfig(ctx).persistentCache) {
    return false
  }
  const cachePath = resolvePersistentCachePath(ctx)
  if (!cachePath || !await fs.pathExists(cachePath)) {
    return false
  }

  try {
    const cached: unknown = await fs.readJson(cachePath)
    if (!isPersistentCache(cached, topologyKey)) {
      return false
    }
    const cache = cached
    if (
      Object.keys(cache.pageDeclarationDependencies).length > 0
      && (cache.usesOpaquePageDeclarationResolver || hasOpaquePageDeclarationSourceResolver)
    ) {
      return false
    }
    const watchFiles = cache.watchFiles
    if (watchFiles.length === 0) {
      return false
    }
    const cachedMtims = cache.fileMtims
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
    const sourceEntries = await Promise.all(
      Object.entries(cache.pageDeclarationFingerprints).map(async ([sourceFile, expectedFingerprint]) => {
        const source = await fs.readFile(sourceFile, 'utf8')
        return [expectedFingerprint, createAutoRoutesSourceFingerprint(source)] as const
      }),
    )
    if (sourceEntries.some(([expected, current]) => expected !== current) || !isCurrent()) {
      return false
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

  const payload = createPersistentCachePayload(state, {})
  try {
    payload.fileMtims = await collectWatchFileMtims(payload.watchFiles)
  }
  catch {
    return
  }

  try {
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
