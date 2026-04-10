export {
  getRequireImportLiteral,
  getStaticStringLiteral,
  normalizeRelativeChunkImport,
  normalizeWeappLocalNpmImport,
  prependChunkCodePreservingDirectives,
  setRequireImportLiteral,
} from './literals'

export {
  rewriteChunkNpmImportsToLocalRoot,
  rewriteJsonNpmImportsToLocalRoot,
  toRelativeRuntimeNpmImport,
} from './localRoot'

export {
  matchesSubPackageDependency,
  normalizeNpmImportByPlatform,
  replacePlatformApiAccess,
  rewriteBundleDynamicGlobalResolution,
  rewriteBundleNpmImportsByPlatform,
  rewriteBundlePlatformApi,
  rewriteChunkNpmImportsByPlatform,
} from './platform'
