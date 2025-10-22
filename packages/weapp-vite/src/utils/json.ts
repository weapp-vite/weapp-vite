import type { AliasOptions, ResolvedAlias, SubPackage } from '@/types'
import { get, isObject, set } from '@weapp-core/shared'
import { parse as parseJson, stringify } from 'comment-json'
import path from 'pathe'
import { changeFileExtension } from './file'

export interface JsonResolvableEntry {
  json?: any
  jsonPath?: string
  type?: 'app' | 'page' | 'component' | 'plugin'
}

export function parseCommentJson(json: string) {
  return parseJson(json, undefined, true)
}

export function jsonFileRemoveJsExtension(fileName: string) {
  return fileName.replace(/\.[jt]s$/, '')
}

export function stringifyJson(value: object, replacer?: (
  (key: string, value: unknown) => unknown
) | Array<number | string> | null) {
  return stringify(value, replacer, 2)
}

export function matches(pattern: string | RegExp, importee: string) {
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

export function resolveImportee(importee: string, jsonPath: string, aliasEntries?: ResolvedAlias[]) {
  if (Array.isArray(aliasEntries)) {
    if (!jsonPath) {
      return importee
    }
    const matchedEntry = aliasEntries.find(x => matches(x.find, importee))
    if (!matchedEntry) {
      return importee
    }

    const updatedId = importee.replace(matchedEntry.find, matchedEntry.replacement)
    return path.relative(path.dirname(jsonPath), updatedId)
  }
  return importee
}

export function resolveJson(entry: JsonResolvableEntry, aliasEntries?: ResolvedAlias[]) {
  if (entry.json) {
    const json = structuredClone(entry.json)
    if (entry.jsonPath && Array.isArray(aliasEntries)) {
      const usingComponents: Record<string, string> = get(json, 'usingComponents')
      if (isObject(usingComponents)) {
        for (const [key, importee] of Object.entries(usingComponents)) {
          const resolvedId = resolveImportee(importee, entry.jsonPath, aliasEntries)
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
}
