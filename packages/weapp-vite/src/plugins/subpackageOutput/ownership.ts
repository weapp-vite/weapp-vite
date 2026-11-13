import type { PreRenderedChunk } from 'rolldown'
import { realpathSync } from 'node:fs'
import path from 'pathe'
import { resolveGraphOutputOwner } from '../../moduleGraph/outputMetadata'
import { parseLogicalEntryId, parseSidecarModuleId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

export interface SubpackageNamingContext {
  root?: string
  preserveSymlinks?: boolean
  srcRoot: string
  roots: () => Iterable<string>
}

function pathIdentity(file: string, context: SubpackageNamingContext): string {
  if (context.preserveSymlinks) {
    return file
  }
  try {
    return path.normalize(realpathSync.native(file))
  }
  catch {
    // 尚未存在的虚拟来源仍按其声明路径定位。
    return file
  }
}

function packageRoot(id: string, context: SubpackageNamingContext) {
  const owner = resolveGraphOutputOwner(id)
    ?? parseLogicalEntryId(id)?.sourceId
    ?? parseSidecarModuleId(id)?.ownerId
    ?? parseSidecarSourceRequest(id)?.ownerId
    ?? id
  if (owner.startsWith('\0') || owner.startsWith('node:')) {
    return undefined
  }
  const normalized = normalizeFsResolvedId(owner)
  const source = path.isAbsolute(normalized) ? normalized : path.resolve(context.root ?? context.srcRoot, normalized)
  const relative = path.relative(pathIdentity(context.srcRoot, context), pathIdentity(source, context))
  const roots = Array.from(context.roots(), root => root.replaceAll('\\', '/').replace(/\/+$/, ''))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
  return roots.find(root => relative === root || relative.startsWith(`${root}/`)) ?? ''
}

export function resolveChunkPackage(chunk: PreRenderedChunk, context: SubpackageNamingContext) {
  const roots = new Set(chunk.moduleIds.map(id => packageRoot(id, context)).filter(root => root !== undefined))
  const facadeRoot = chunk.facadeModuleId ? packageRoot(chunk.facadeModuleId, context) : undefined
  if (facadeRoot !== undefined) {
    roots.add(facadeRoot)
  }
  const packages = Array.from(roots).filter(Boolean)
  if (packages.length > 1) {
    throw new Error(`[weapp-vite] [subpackage] 无法确定跨分包 chunk 的唯一归属：${packages.join(', ')}。请拆分分组或使用不含占位符的模板。`)
  }
  if (!roots.size) {
    const identities = [...chunk.moduleIds, ...chunk.facadeModuleId ? [chunk.facadeModuleId] : []]
    if (identities.every(id => /^(?:\0rolldown\/|\0vite\/|\0commonjsHelpers)/.test(id))) {
      return ''
    }
    throw new Error(`[weapp-vite] [subpackage] 无法确定 chunk "${chunk.name}" 的来源。`)
  }
  return facadeRoot ?? (roots.has('') ? '' : packages[0] ?? '')
}

export function resolveAssetPackage(asset: { originalFileNames: string[] }, context: SubpackageNamingContext) {
  if (!asset.originalFileNames.length) {
    throw new Error('[weapp-vite] [subpackage] 资源缺少 originalFileNames，无法确定归属；请提供源文件信息或显式设置资源输出路径。')
  }
  const roots = new Set(asset.originalFileNames.map(id => packageRoot(id, context)))
  if (roots.has(undefined)) {
    throw new Error('[weapp-vite] [subpackage] 资源来源为未知虚拟模块，无法确定归属。')
  }
  // 同一资源已由 bundler 去重合并时保留公共产物，不为命名复制资源。
  return roots.size === 1 ? roots.values().next().value! : ''
}

/** 根据最终合并来源验证资源落位，不改写 bundler 的命名、引用和写出。 */
export function assertAssetPackageAccess(asset: { fileName: string, originalFileNames: string[] }, context: SubpackageNamingContext) {
  const destination = Array.from(context.roots(), root => root.replaceAll('\\', '/').replace(/\/+$/, ''))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find(root => asset.fileName.startsWith(`${root}/`))
  if (destination && asset.originalFileNames.some(id => packageRoot(id, context) !== destination)) {
    throw new Error(`[weapp-vite] [subpackage] 跨分包资源 "${asset.fileName}" 无法独立访问；请为共享资源设置不含占位符的主包 assetFileNames。`)
  }
}
