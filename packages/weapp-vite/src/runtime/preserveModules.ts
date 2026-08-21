import type { CodeSplittingGroup } from 'rolldown'
import type { ChunkingContextLike } from './chunkStrategy/collector'
import type { ConfigService } from './config/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import picomatch from 'picomatch'
import { parseLogicalEntryId, parseSidecarSourceRequest } from '../moduleGraph/protocol'
import { isPathInside, normalizeRelativePath } from '../utils/path'
import { isRegexp } from '../utils/regexp'
import { normalizeViteId } from '../utils/viteId'
import { assertModuleScopedToRoot, resolveSubPackagePrefix } from './chunkStrategy/collector'

const PRESERVED_MODULE_GROUP_PRIORITY = 100

function createPatternMatcher(pattern: string | RegExp) {
  if (typeof pattern === 'string') {
    const matcher = picomatch(pattern, { dot: true })
    return (value: string) => matcher(value)
  }

  if (isRegexp(pattern)) {
    return (value: string) => {
      pattern.lastIndex = 0
      return pattern.test(value)
    }
  }
}

export function createPreserveModuleMatcher(patterns?: (string | RegExp)[]) {
  const matchers = patterns
    ?.map(pattern => createPatternMatcher(pattern))
    .filter((matcher): matcher is (value: string) => boolean => typeof matcher === 'function')

  if (!matchers?.length) {
    return undefined
  }

  return (relativeId: string, absoluteId: string) => {
    return matchers.some(matcher => matcher(relativeId) || matcher(absoluteId))
  }
}

function normalizePreservedSourceId(id: string) {
  return normalizeViteId(id, {
    stripQuery: true,
    fileProtocolToPath: true,
    stripAtFsPrefix: true,
    stripLeadingNullByte: true,
  })
}

interface ResolvePreservedModuleNameOptions {
  configService: ConfigService
  ctx: ChunkingContextLike
  getSubPackageRoots: () => Iterable<string>
  id: string
}

export function normalizePreserveModulesRolldownOptions(
  configService: ConfigService,
  rolldownOptions: Record<string, unknown>,
) {
  if (
    configService.weappViteConfig?.chunks?.preserveModules?.length
    && (rolldownOptions.preserveEntrySignatures === undefined
      || rolldownOptions.preserveEntrySignatures === 'exports-only')
  ) {
    rolldownOptions.preserveEntrySignatures = 'allow-extension'
  }
  return rolldownOptions
}

export function resolvePreservedModuleName(options: ResolvePreservedModuleNameOptions) {
  const {
    configService,
    ctx,
    getSubPackageRoots,
    id,
  } = options
  if (parseSidecarSourceRequest(id)) {
    return undefined
  }

  const absoluteId = normalizePreservedSourceId(id)
  if (!path.isAbsolute(absoluteId) || !isPathInside(configService.absoluteSrcRoot, absoluteId)) {
    return undefined
  }

  const moduleInfo = ctx.getModuleInfo(id)
  const isLogicalEntrySource = moduleInfo?.importers?.some((importer) => {
    return parseLogicalEntryId(importer)?.sourceId === absoluteId
  })
  if (isLogicalEntrySource) {
    return undefined
  }

  const relativeId = normalizeRelativePath(path.relative(configService.absoluteSrcRoot, absoluteId))
  if (!relativeId || relativeId.startsWith('..')) {
    return undefined
  }

  const subPackageRoots = Array.from(getSubPackageRoots())
  const moduleRoot = resolveSubPackagePrefix(relativeId, subPackageRoots)
  if (moduleRoot) {
    assertModuleScopedToRoot({
      moduleInfo,
      moduleRoot,
      relativeAbsoluteSrcRoot: configService.relativeAbsoluteSrcRoot,
      subPackageRoots,
      moduleId: id,
    })
  }

  const name = removeExtensionDeep(relativeId)
  return name && name !== '.' ? name : undefined
}

export function createPreserveModulesGroup(
  configService: ConfigService,
  getSubPackageRoots: () => Iterable<string>,
): CodeSplittingGroup | undefined {
  const matches = createPreserveModuleMatcher(configService.weappViteConfig?.chunks?.preserveModules)
  if (!matches) {
    return undefined
  }

  return {
    name: (id, ctx) => resolvePreservedModuleName({
      configService,
      ctx,
      getSubPackageRoots,
      id,
    }),
    test: (id) => {
      const absoluteId = normalizePreservedSourceId(id)
      const relativeId = configService.relativeAbsoluteSrcRoot(absoluteId)
      return matches(relativeId, absoluteId)
    },
    priority: PRESERVED_MODULE_GROUP_PRIORITY,
    minShareCount: 1,
    minSize: 0,
    minModuleSize: 0,
    includeDependenciesRecursively: false,
  }
}
