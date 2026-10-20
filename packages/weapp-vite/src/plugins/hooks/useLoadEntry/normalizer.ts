import type { CompilerContext } from '../../../context'
import path from 'pathe'
import { resolveNpmBuildCandidateDependencyRecordSync } from '../../../runtime/npmPlugin/service/dependencies'
import { matches } from '../../../utils'
import { hasNpmDependencyPrefix, normalizeNpmImportLookupPath } from '../../../utils/npmImport'

const PLUGIN_PROTOCOL_RE = /plugin:\/\//
const WINDOWS_PATH_SEPARATOR_RE = /\\/g

function resolveImportee(
  importee: string,
  jsonPath: string,
  configService: CompilerContext['configService'],
) {
  let updated = importee

  if (jsonPath && Array.isArray(configService.aliasEntries)) {
    const matchedEntry = configService.aliasEntries.find(entry => matches(entry.find, importee))
    if (matchedEntry) {
      updated = importee.replace(matchedEntry.find, matchedEntry.replacement)
    }
  }

  const baseDir = jsonPath
    ? path.dirname(jsonPath)
    : configService.absoluteSrcRoot

  return path.resolve(baseDir, updated)
}

export function createEntryNormalizer(
  configService: CompilerContext['configService'],
) {
  const npmDependencies = resolveNpmBuildCandidateDependencyRecordSync({ configService }, configService.packageJson)

  return function normalizeEntry(entry: string, jsonPath: string) {
    if (PLUGIN_PROTOCOL_RE.test(entry)) {
      return entry
    }

    const normalizedEntry = normalizeNpmImportLookupPath(entry)
    if (
      normalizedEntry
      && npmDependencies
      && hasNpmDependencyPrefix(npmDependencies, normalizedEntry)
    ) {
      return `npm:${normalizedEntry}`
    }

    if (entry.replace(WINDOWS_PATH_SEPARATOR_RE, '/').startsWith('/')) {
      return normalizedEntry
    }

    const normalized = resolveImportee(normalizedEntry, jsonPath, configService)

    return configService.relativeAbsoluteSrcRoot(normalized)
  }
}
