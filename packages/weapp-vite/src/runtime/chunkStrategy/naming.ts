import type { SharedChunkMode, SharedChunkStrategy } from '../../types'
import type { ChunkingContextLike } from './collector'
import { removeExtensionDeep } from '@weapp-core/shared'
import { posix as path } from 'pathe'
import { normalizeRelativePath } from '../../utils/path'
import { assertModuleScopedToRoot, resolveSubPackagePrefix, summarizeImportPrefixes } from './collector'
import { SHARED_CHUNK_VIRTUAL_PREFIX } from './constants'
import { getCachedSharedChunkName, getTakeImporters, markForceDuplicateSharedChunk, recordSharedChunkDiagnostics, setCachedSharedChunkName } from './state'

export interface ResolveSharedChunkNameOptions {
  id: string
  ctx: ChunkingContextLike
  subPackageRoots: Iterable<string>
  relativeAbsoluteSrcRoot: (id: string) => string
  strategy: SharedChunkStrategy
  sharedMode?: SharedChunkMode
  resolveSharedMode?: (relativeId: string, absoluteId: string) => SharedChunkMode
  resolveSharedPath?: (absoluteId: string, relativeId: string) => string | undefined
  /**
   * 可选判定函数：当返回 true 时，即使模块位于主包目录，也允许将其视为“可安全复制”的共享模块。
   * 参数分别为：基于 srcRoot 的相对路径、以及绝对 id。
   */
  forceDuplicateTester?: (relativeId: string, absoluteId: string) => boolean
}

interface ResolveTakeSharedChunkNameOptions {
  id: string
  ctx: ChunkingContextLike
  relativeAbsoluteSrcRoot: (id: string) => string
  subPackageRoots: string[]
  importers: string[]
}

function resolveTakeSharedChunkName(options: ResolveTakeSharedChunkNameOptions) {
  const {
    ctx,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    importers,
  } = options

  if (!importers.length) {
    return undefined
  }

  const { summary } = summarizeImportPrefixes({
    ctx,
    importers,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
  })

  const keys = Object.keys(summary).filter(Boolean)
  if (!keys.length) {
    return undefined
  }

  const sharedName = createSharedChunkNameFromKeys(keys)
  markForceDuplicateSharedChunk(sharedName)
  return sharedName
}

function createSharedChunkNameFromKeys(keys: string[]) {
  const sanitize = (value: string) => value.replace(/[\\/]+/g, '_')
  const combination = keys
    .filter(Boolean)
    .map(sanitize)
    .sort()
    .join('+')
  const combinationSegment = combination ? `${combination}/` : ''
  return `${SHARED_CHUNK_VIRTUAL_PREFIX}/${combinationSegment}common`
}

export function resolveSharedChunkName(options: ResolveSharedChunkNameOptions): string | undefined {
  const {
    id,
    ctx,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    strategy,
    sharedMode,
    resolveSharedMode,
    resolveSharedPath,
    forceDuplicateTester,
  } = options

  const cached = getCachedSharedChunkName(id)
  if (cached !== undefined) {
    return cached ?? undefined
  }

  const subPackageRootList = Array.from(subPackageRoots)
  const moduleInfo = ctx.getModuleInfo(id)
  const relativeId = relativeAbsoluteSrcRoot(id)
  const resolvedMode = resolveSharedMode?.(relativeId, id) ?? sharedMode ?? 'common'

  if (resolvedMode === 'inline') {
    setCachedSharedChunkName(id, undefined)
    return undefined
  }

  if (resolvedMode === 'path') {
    if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
      setCachedSharedChunkName(id, undefined)
      return undefined
    }

    const moduleRoot = resolveSubPackagePrefix(relativeId, subPackageRootList)
    if (moduleRoot) {
      assertModuleScopedToRoot({
        moduleInfo,
        moduleRoot,
        relativeAbsoluteSrcRoot,
        subPackageRoots: subPackageRootList,
        moduleId: id,
      })
    }

    const candidate = resolveSharedPath?.(id, relativeId) ?? relativeId
    const normalized = normalizeRelativePath(candidate)
    if (!normalized || normalized.startsWith('..')) {
      setCachedSharedChunkName(id, undefined)
      return undefined
    }
    const sharedName = removeExtensionDeep(normalized)
    if (!sharedName || sharedName === '.') {
      setCachedSharedChunkName(id, undefined)
      return undefined
    }
    setCachedSharedChunkName(id, sharedName)
    return sharedName
  }

  const takeImporters = getTakeImporters(id)
  if (takeImporters?.size) {
    const takeSharedName = resolveTakeSharedChunkName({
      id,
      ctx,
      relativeAbsoluteSrcRoot,
      subPackageRoots: subPackageRootList,
      importers: Array.from(takeImporters),
    })
    if (takeSharedName) {
      setCachedSharedChunkName(id, takeSharedName)
      return takeSharedName
    }
  }
  if (strategy === 'hoist') {
    const moduleRoot = resolveSubPackagePrefix(relativeId, subPackageRootList)

    if (moduleRoot) {
      assertModuleScopedToRoot({
        moduleInfo,
        moduleRoot,
        relativeAbsoluteSrcRoot,
        subPackageRoots: subPackageRootList,
        moduleId: id,
      })
      if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
        setCachedSharedChunkName(id, undefined)
        return undefined
      }
      const sharedName = path.join(moduleRoot, 'common')
      setCachedSharedChunkName(id, sharedName)
      return sharedName
    }

    if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
      setCachedSharedChunkName(id, undefined)
      return undefined
    }
    setCachedSharedChunkName(id, 'common')
    return 'common'
  }

  if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
    setCachedSharedChunkName(id, undefined)
    return undefined
  }

  const { summary, ignoredMainImporters } = summarizeImportPrefixes({
    ctx,
    importers: moduleInfo.importers,
    relativeAbsoluteSrcRoot,
    subPackageRoots: subPackageRootList,
    forceDuplicateTester,
  })

  const keys = Object.keys(summary)
  if (keys.length === 0) {
    setCachedSharedChunkName(id, undefined)
    return undefined
  }

  if (keys.length === 1) {
    const prefix = keys[0]
    const sharedName = prefix ? path.join(prefix, 'common') : 'common'
    setCachedSharedChunkName(id, sharedName)
    return sharedName
  }

  const hasMainImporter = keys.includes('')
  if (strategy === 'duplicate' && !hasMainImporter) {
    const sharedName = createSharedChunkNameFromKeys(keys)
    if (ignoredMainImporters.length) {
      recordSharedChunkDiagnostics(sharedName, ignoredMainImporters)
    }
    setCachedSharedChunkName(id, sharedName)
    return sharedName
  }

  setCachedSharedChunkName(id, 'common')
  return 'common'
}
