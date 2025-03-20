import type { AliasOptions, Entry, EntryJsonFragment, ResolvedAlias, SubPackage } from '@/types'
import { changeFileExtension, get, isObject, path, set, stringifyJson } from '@weapp-core/shared'

function matches(pattern: string | RegExp, importee: string) {
  if (pattern instanceof RegExp) {
    return pattern.test(importee)
  }
  if (importee.length < pattern.length) {
    return false
  }
  if (importee === pattern) {
    return true
  }
  // eslint-disable-next-line prefer-template
  return importee.startsWith(pattern + '/')
}

export function getAliasEntries({ entries }: AliasOptions = {}): ResolvedAlias[] {
  if (!entries) {
    return []
  }

  if (Array.isArray(entries)) {
    return entries.map((entry) => {
      return {
        find: entry.find,
        replacement: entry.replacement,

      }
    })
  }

  return Object.entries(entries).map(([key, value]) => {
    return { find: key, replacement: value }
  })
}

export function resolveImportee(importee: string, entry: EntryJsonFragment, aliasEntries?: ResolvedAlias[]) {
  if (Array.isArray(aliasEntries)) {
    if (!entry.jsonPath) {
      return importee
    }
    const matchedEntry = aliasEntries.find(x => matches(x.find, importee))
    if (!matchedEntry) {
      return importee
    }

    const updatedId = importee.replace(matchedEntry.find, matchedEntry.replacement)
    return path.relative(path.dirname(entry.jsonPath), updatedId)
  }
  return importee
}

export function resolveJson(entry: Partial<Pick<Entry, 'json' | 'jsonPath' | 'type'>>, aliasEntries?: ResolvedAlias[]) {
  if (entry.json) {
    const json = structuredClone(entry.json)
    if (entry.jsonPath && Array.isArray(aliasEntries)) {
      const usingComponents: Record<string, string> = get(json, 'usingComponents')
      if (isObject(usingComponents)) {
        for (const [key, importee] of Object.entries(usingComponents)) {
          const resolvedId = resolveImportee(importee, entry, aliasEntries)
          set(json, `usingComponents.${key}`, resolvedId)
        }

        set(json, 'usingComponents', usingComponents)
      }

      if (entry.type === 'app') {
        const fields = ['subPackages', 'subpackages']
        for (const field of fields) {
          const subPackages: SubPackage[] = get(json, field)
          if (Array.isArray(subPackages)) {
            for (const subPackage of subPackages) {
              if (subPackage.entry) {
                subPackage.entry = changeFileExtension(subPackage.entry, 'js')
              }
            }
          }
        }
      }
    }
    // 去除提示用的 $schema
    if (Reflect.has(json, '$schema')) {
      // @ts-ignore
      delete json.$schema
    }
    return stringifyJson(json)
  }
  return JSON.stringify({})
}
