export {
  getRequireImportLiteral,
  getStaticStringLiteral,
  normalizeRelativeChunkImport,
  normalizeWeappLocalNpmImport,
  prependChunkCodePreservingDirectives,
  setRequireImportLiteral,
} from './literals'

export {
  rewriteBundleNpmImportsToLocalRoots,
  rewriteChunkNpmImportsToLocalRoot,
  rewriteJsonNpmImportsToLocalRoot,
  toRelativeRuntimeNpmImport,
} from './localRoot'

export {
  type ChunkScriptAnalysisCache,
  matchesSubPackageDependency,
  normalizeNpmImportByPlatform,
  replacePlatformApiAccess,
  rewriteBundleDynamicGlobalResolution,
  rewriteBundleNpmImportsByPlatform,
  rewriteBundlePlatformApi,
  rewriteChunkNpmImportsByPlatform,
  warmupBundleScriptAnalysis,
} from './platform'
