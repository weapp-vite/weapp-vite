import type { AliasOptions, MpPlatform, ResolvedAlias, SubPackage } from '@/types'
import { get, isObject, set } from '@weapp-core/shared'
import { parse as parseJson, stringify } from 'comment-json'
import path from 'pathe'
import { changeFileExtension } from './file'
import { toPosixPath } from './path'

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
  // eslint-disable-next-line prefer-template -- 这里更适合用字符串拼接保持语义清晰
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
    return toPosixPath(path.relative(path.dirname(jsonPath), updatedId))
  }
  return importee
}

function toKebabCaseComponentName(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function normalizeUsingComponentsByPlatform(
  usingComponents: Record<string, string>,
  platform?: MpPlatform,
) {
  if (platform !== 'alipay') {
    return usingComponents
  }

  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(usingComponents)) {
    const nextKey = /[A-Z]/.test(key)
      ? toKebabCaseComponentName(key)
      : key
    if (!Reflect.has(normalized, nextKey)) {
      normalized[nextKey] = value
    }
  }
  return normalized
}

export function resolveJson(entry: JsonResolvableEntry, aliasEntries?: ResolvedAlias[], platform?: MpPlatform) {
  if (entry.json) {
    const json = structuredClone(entry.json)
    if (entry.jsonPath && Array.isArray(aliasEntries)) {
      const usingComponents: Record<string, string> = get(json, 'usingComponents')
      if (isObject(usingComponents)) {
        for (const [key, importee] of Object.entries(usingComponents)) {
          const resolvedId = resolveImportee(importee, entry.jsonPath, aliasEntries)
          set(json, `usingComponents.${key}`, resolvedId)
        }

        set(json, 'usingComponents', normalizeUsingComponentsByPlatform(usingComponents, platform))
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
    else {
      const usingComponents: Record<string, string> = get(json, 'usingComponents')
      if (isObject(usingComponents)) {
        set(json, 'usingComponents', normalizeUsingComponentsByPlatform(usingComponents, platform))
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
