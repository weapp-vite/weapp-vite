import type { SharedChunkStrategy } from '../../types'
import type { ChunkingContextLike } from './collector'
import { posix as path } from 'pathe'
import { assertModuleScopedToRoot, resolveSubPackagePrefix, summarizeImportPrefixes } from './collector'
import { SHARED_CHUNK_VIRTUAL_PREFIX } from './constants'
import { getTakeImporters, markForceDuplicateSharedChunk, recordSharedChunkDiagnostics } from './state'

export interface ResolveSharedChunkNameOptions {
  id: string
  ctx: ChunkingContextLike
  subPackageRoots: Iterable<string>
  relativeAbsoluteSrcRoot: (id: string) => string
  strategy: SharedChunkStrategy
  /**
   * 可选判定函数：当返回 true 时，即使模块位于主包目录，也允许将其视为“可安全复制”的共享模块。
   * 参数分别为：基于 srcRoot 的相对路径、以及绝对 id。
   */
  forceDuplicateTester?: (relativeId: string, absoluteId: string) => boolean
}

export function resolveSharedChunkName(options: ResolveSharedChunkNameOptions): string | undefined {
  const {
    id,
    ctx,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    strategy,
    forceDuplicateTester,
  } = options

  const subPackageRootList = Array.from(subPackageRoots)
  const moduleInfo = ctx.getModuleInfo(id)
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
      return takeSharedName
    }
  }
  if (strategy === 'hoist') {
    const relativeId = relativeAbsoluteSrcRoot(id)
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
        return undefined
      }
      return path.join(moduleRoot, 'common')
    }

    if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
      return undefined
    }
    return 'common'
  }

  if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
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
    return undefined
  }

  if (keys.length === 1) {
    const prefix = keys[0]
    return prefix ? path.join(prefix, 'common') : 'common'
  }

  const hasMainImporter = keys.includes('')
  if (strategy === 'duplicate' && !hasMainImporter) {
    const sharedName = createSharedChunkNameFromKeys(keys)
    if (ignoredMainImporters.length) {
      recordSharedChunkDiagnostics(sharedName, ignoredMainImporters)
    }
    return sharedName
  }

  return 'common'
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
