import type { CompilerContext } from '../../context'
import type { BuildOrigin, ClassifiedPackage, ModuleSourceType, PackageClassifierContext } from './types'
import { posix as path } from 'pathe'
import { SHARED_CHUNK_VIRTUAL_PREFIX } from '../../runtime/chunkStrategy'
import { isPathInside } from '../../utils'

const VIRTUAL_MODULE_INDICATOR = '\u0000'
const VIRTUAL_PREFIX = `${SHARED_CHUNK_VIRTUAL_PREFIX}/`

function classifyModuleSourceKind(options: {
  isNodeModule: boolean
  inSrc: boolean
  inPlugin: boolean
}): ModuleSourceType {
  if (options.isNodeModule) {
    return 'node_modules'
  }
  if (options.inSrc) {
    return 'src'
  }
  if (options.inPlugin) {
    return 'plugin'
  }
  return 'workspace'
}

function resolvePluginAssetAbsolute(
  normalizedFileName: string,
  pluginRoot?: string,
) {
  if (!pluginRoot) {
    return undefined
  }

  const pluginBase = path.basename(pluginRoot)
  if (normalizedFileName !== pluginBase && !normalizedFileName.startsWith(`${pluginBase}/`)) {
    return undefined
  }

  const relative = normalizedFileName === pluginBase
    ? ''
    : normalizedFileName.slice(pluginBase.length + 1)
  const absolute = path.resolve(pluginRoot, relative)

  return isPathInside(pluginRoot, absolute)
    ? absolute
    : undefined
}

function resolveSubPackageRoot(fileName: string, context: PackageClassifierContext) {
  const normalized = path.normalize(fileName)
  const roots = Array.from(context.subPackageRoots)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)

  return roots.find(root => normalized === root || normalized.startsWith(`${root}/`))
}

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

  const rootCandidate = resolveSubPackageRoot(fileName, context)
  if (rootCandidate) {
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

  const sourceType = classifyModuleSourceKind({
    isNodeModule,
    inSrc,
    inPlugin,
  })

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

  const pluginAbsolute = resolvePluginAssetAbsolute(normalized, configService.absolutePluginRoot)
  if (pluginAbsolute) {
    return {
      absolute: pluginAbsolute,
      source: configService.relativeAbsoluteSrcRoot(pluginAbsolute),
      sourceType: 'plugin',
    }
  }
}

export {
  classifyModuleSourceKind,
  resolvePluginAssetAbsolute,
  resolveSubPackageRoot,
}
