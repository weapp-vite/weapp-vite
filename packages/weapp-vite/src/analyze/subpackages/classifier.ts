import type { CompilerContext } from '../../context'
import type { BuildOrigin, ClassifiedPackage, ModuleSourceType, PackageClassifierContext } from './types'
import { posix as path } from 'pathe'
import { SHARED_CHUNK_VIRTUAL_PREFIX } from '../../runtime/chunkStrategy'
import { isPathInside } from '../../utils'

const VIRTUAL_MODULE_INDICATOR = '\u0000'
const VIRTUAL_PREFIX = `${SHARED_CHUNK_VIRTUAL_PREFIX}/`

export function classifyPackage(
  fileName: string,
  origin: BuildOrigin,
  context: PackageClassifierContext,
): ClassifiedPackage {
  if (fileName.startsWith(VIRTUAL_PREFIX)) {
    const combination = fileName.slice(VIRTUAL_PREFIX.length).split('/')[0] || 'shared'
    return {
      id: `virtual:${combination}`,
      label: `共享虚拟包 ${combination}`,
      type: 'virtual',
    }
  }

  const segments = fileName.split('/')
  const rootCandidate = segments[0] ?? ''
  if (rootCandidate && context.subPackageRoots.has(rootCandidate)) {
    const isIndependent = context.independentRoots.has(rootCandidate)
    return {
      id: rootCandidate,
      label: `${isIndependent ? '独立分包' : '分包'} ${rootCandidate}`,
      type: isIndependent || origin === 'independent' ? 'independent' : 'subPackage',
    }
  }

  return {
    id: '__main__',
    label: '主包',
    type: 'main',
  }
}

export function normalizeModuleId(id: string) {
  if (!id || id.includes(VIRTUAL_MODULE_INDICATOR)) {
    return undefined
  }
  if (!path.isAbsolute(id)) {
    return undefined
  }
  return path.normalize(id)
}

export function resolveModuleSourceType(
  absoluteId: string,
  ctx: CompilerContext,
): { source: string, sourceType: ModuleSourceType } {
  const { configService } = ctx
  const isNodeModule = absoluteId.includes('/node_modules/')
    || absoluteId.includes('\\node_modules\\')
  const pluginRoot = configService.absolutePluginRoot
  const srcRoot = configService.absoluteSrcRoot
  const inSrc = isPathInside(srcRoot, absoluteId)
  const inPlugin = pluginRoot ? isPathInside(pluginRoot, absoluteId) : false

  let sourceType: ModuleSourceType
  if (isNodeModule) {
    sourceType = 'node_modules'
  }
  else if (inSrc) {
    sourceType = 'src'
  }
  else if (inPlugin) {
    sourceType = 'plugin'
  }
  else {
    sourceType = 'workspace'
  }

  return {
    source: configService.relativeAbsoluteSrcRoot(absoluteId),
    sourceType,
  }
}

export function resolveAssetSource(
  fileName: string,
  ctx: CompilerContext,
): { absolute: string, source: string, sourceType: ModuleSourceType } | undefined {
  const { configService } = ctx
  const normalized = path.normalize(fileName)
  const srcCandidate = path.resolve(configService.absoluteSrcRoot, normalized)

  if (isPathInside(configService.absoluteSrcRoot, srcCandidate)) {
    return {
      absolute: srcCandidate,
      source: configService.relativeAbsoluteSrcRoot(srcCandidate),
      sourceType: 'src',
    }
  }

  const pluginRoot = configService.absolutePluginRoot
  if (pluginRoot) {
    const pluginBase = path.basename(pluginRoot)
    if (normalized === pluginBase || normalized.startsWith(`${pluginBase}/`)) {
      const relative = normalized === pluginBase
        ? ''
        : normalized.slice(pluginBase.length + 1)
      const absolute = path.resolve(pluginRoot, relative)
      if (isPathInside(pluginRoot, absolute)) {
        return {
          absolute,
          source: configService.relativeAbsoluteSrcRoot(absolute),
          sourceType: 'plugin',
        }
      }
    }
  }
}
