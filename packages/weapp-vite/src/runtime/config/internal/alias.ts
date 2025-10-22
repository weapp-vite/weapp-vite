import type { InlineConfig } from 'vite'

export interface AliasEntry {
  find: string | RegExp
  replacement: string
}

export interface AliasManager {
  injectBuiltinAliases: (config: InlineConfig) => void
}

type RawAliasOption = NonNullable<NonNullable<InlineConfig['resolve']>['alias']>

export function createAliasManager(
  oxcAlias: AliasEntry & { find: RegExp },
  builtinAliases: AliasEntry[],
): AliasManager {
  function normalizeAliasOptions(alias?: RawAliasOption | null): AliasEntry[] {
    if (!alias) {
      return []
    }
    if (Array.isArray(alias)) {
      return alias.filter((entry): entry is AliasEntry => {
        return Boolean(entry && typeof entry === 'object' && 'find' in entry && 'replacement' in entry)
      })
    }
    const record = alias as Record<string, string>
    return Object.entries(record).map(([find, replacement]) => {
      return { find, replacement }
    })
  }

  function injectBuiltinAliases(config: InlineConfig) {
    const resolve = config.resolve ?? (config.resolve = {})
    const aliasArray = normalizeAliasOptions(resolve.alias)

    const hasOxcAlias = aliasArray.some((entry) => {
      return entry.find instanceof RegExp && entry.find.source === oxcAlias.find.source
    })
    if (!hasOxcAlias) {
      aliasArray.unshift(oxcAlias)
    }

    for (const builtin of builtinAliases) {
      const exists = aliasArray.some((entry) => {
        return typeof entry.find === 'string' && entry.find === builtin.find
      })
      if (!exists) {
        aliasArray.unshift(builtin)
      }
    }

    resolve.alias = aliasArray
  }

  return {
    injectBuiltinAliases,
  }
}
