export interface ModuleInfoLike {
  importers?: string[]
}

export interface ChunkingContextLike {
  getModuleInfo: (id: string) => ModuleInfoLike | null
}

interface SummarizeOptions {
  ctx: ChunkingContextLike
  importers: string[]
  relativeAbsoluteSrcRoot: (id: string) => string
  subPackageRoots: string[]
  forceDuplicateTester?: (relativeId: string, absoluteId: string) => boolean
}

interface CollectorResult {
  prefixes: string[]
  hasRealMain: boolean
  ignored: string[]
}

interface CollectorState {
  cache: Map<string, CollectorResult>
  stack: Set<string>
}

interface CollectorOptions {
  ctx: ChunkingContextLike
  relativeAbsoluteSrcRoot: (id: string) => string
  subPackageRoots: string[]
  forceDuplicateTester?: (relativeId: string, absoluteId: string) => boolean
}

export function summarizeImportPrefixes(options: SummarizeOptions) {
  const {
    ctx,
    importers,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    forceDuplicateTester,
  } = options
  const summary: Record<string, number> = {}
  const ignoredImporters = new Set<string>()
  const state: CollectorState = {
    cache: new Map(),
    stack: new Set(),
  }

  for (const importer of importers) {
    const { prefixes, ignored } = collectEffectivePrefixes(importer, {
      ctx,
      relativeAbsoluteSrcRoot,
      subPackageRoots,
      forceDuplicateTester,
    }, state)

    for (const prefix of prefixes) {
      summary[prefix] = (summary[prefix] || 0) + 1
    }

    for (const entry of ignored) {
      ignoredImporters.add(entry)
    }
  }

  return {
    summary,
    ignoredMainImporters: Array.from(ignoredImporters),
  }
}

function collectEffectivePrefixes(
  importer: string,
  options: CollectorOptions,
  state: CollectorState,
): CollectorResult {
  const cached = state.cache.get(importer)
  if (cached) {
    return {
      prefixes: [...cached.prefixes],
      hasRealMain: cached.hasRealMain,
      ignored: [...cached.ignored],
    }
  }

  if (state.stack.has(importer)) {
    return {
      prefixes: [''],
      hasRealMain: true,
      ignored: [],
    }
  }

  state.stack.add(importer)

  const {
    ctx,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    forceDuplicateTester,
  } = options

  const relativeId = relativeAbsoluteSrcRoot(importer)
  const subPackagePrefix = resolveSubPackagePrefix(relativeId, subPackageRoots)

  if (subPackagePrefix) {
    const result: CollectorResult = {
      prefixes: [subPackagePrefix],
      hasRealMain: false,
      ignored: [],
    }
    state.cache.set(importer, result)
    state.stack.delete(importer)
    return {
      prefixes: [...result.prefixes],
      hasRealMain: result.hasRealMain,
      ignored: [],
    }
  }

  const moduleInfo = ctx.getModuleInfo(importer)
  const importerParents = moduleInfo?.importers ?? []
  const forcedDuplicate = forceDuplicateTester?.(relativeId, importer) ?? false

  if (!importerParents.length) {
    const result: CollectorResult = forcedDuplicate
      ? {
          prefixes: [],
          hasRealMain: false,
          ignored: [relativeId],
        }
      : {
          prefixes: [''],
          hasRealMain: true,
          ignored: [],
        }
    state.cache.set(importer, result)
    state.stack.delete(importer)
    return {
      prefixes: [...result.prefixes],
      hasRealMain: result.hasRealMain,
      ignored: [...result.ignored],
    }
  }

  const aggregatedPrefixes = new Set<string>()
  let hasRealMain = false
  const aggregatedIgnored: string[] = []

  for (const parent of importerParents) {
    const collectorResult = collectEffectivePrefixes(parent, options, state)
    for (const prefix of collectorResult.prefixes) {
      aggregatedPrefixes.add(prefix)
    }
    if (collectorResult.hasRealMain) {
      hasRealMain = true
    }
    if (collectorResult.ignored.length) {
      aggregatedIgnored.push(...collectorResult.ignored)
    }
  }

  if (!aggregatedPrefixes.size) {
    aggregatedPrefixes.add('')
    hasRealMain = true
  }

  const shouldIgnoreAsMain = !aggregatedPrefixes.has('') && importerParents.length > 0
  const ignored: string[] = shouldIgnoreAsMain || (forcedDuplicate && !aggregatedPrefixes.has(''))
    ? [relativeId]
    : []

  const result: CollectorResult = {
    prefixes: Array.from(aggregatedPrefixes),
    hasRealMain,
    ignored: Array.from(new Set([...aggregatedIgnored, ...ignored])),
  }

  state.cache.set(importer, result)
  state.stack.delete(importer)

  return {
    prefixes: [...result.prefixes],
    hasRealMain: result.hasRealMain,
    ignored: [...result.ignored],
  }
}

export function resolveSubPackagePrefix(fileName: string, subPackageRoots: string[]): string {
  for (const root of subPackageRoots) {
    if (!root) {
      continue
    }
    if (fileName === root || fileName.startsWith(`${root}/`)) {
      return root
    }
  }
  return ''
}

interface ModuleScopeAssertionOptions {
  moduleInfo: ModuleInfoLike | null
  moduleRoot: string
  relativeAbsoluteSrcRoot: (id: string) => string
  subPackageRoots: string[]
  moduleId: string
}

export function assertModuleScopedToRoot(options: ModuleScopeAssertionOptions) {
  const {
    moduleInfo,
    moduleRoot,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    moduleId,
  } = options

  if (!moduleRoot || !moduleInfo?.importers?.length) {
    return
  }

  for (const importer of moduleInfo.importers) {
    const importerRoot = resolveSubPackagePrefix(relativeAbsoluteSrcRoot(importer), subPackageRoots)
    if (importerRoot !== moduleRoot) {
      const moduleLabel = relativeAbsoluteSrcRoot(moduleId)
      const importerLabel = relativeAbsoluteSrcRoot(importer)
      throw new Error(
        `[分包] 模块 "${moduleLabel}" 位于分包 "${moduleRoot}"，但被 "${importerLabel}" 引用，`
        + '请将该模块移动到主包或公共目录以进行跨分包共享。',
      )
    }
  }
}
