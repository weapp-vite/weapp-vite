import type { CompilerContext } from '../../../context'
import { isObject } from '@weapp-core/shared'
import path from 'pathe'
import { matches } from '../../../utils'

export function createEntryNormalizer(
  configService: CompilerContext['configService'],
) {
  return function normalizeEntry(entry: string, jsonPath: string) {
    if (/plugin:\/\//.test(entry)) {
      return entry
    }

    const tokens = entry.split('/')
    if (
      tokens[0]
      && isObject(configService.packageJson.dependencies)
      && hasDependencyPrefix(configService.packageJson.dependencies, tokens)
    ) {
      return `npm:${entry}`
    }

    if (tokens[0] === '') {
      return entry.substring(1)
    }

    const normalized = resolveImportee(entry, jsonPath, configService)

    return configService.relativeAbsoluteSrcRoot(normalized)
  }
}

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

function hasDependencyPrefix(dependencies: Record<string, string>, tokens: string[]) {
  return Object.keys(dependencies).some((dep) => {
    const depTokens = dep.split('/')
    for (let i = 0; i < Math.min(tokens.length, depTokens.length); i++) {
      if (tokens[i] !== depTokens[i]) {
        return false
      }
    }
    return true
  })
}
