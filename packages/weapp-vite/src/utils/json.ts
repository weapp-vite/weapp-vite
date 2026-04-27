import type { AliasOptions, MpPlatform, ResolvedAlias, SubPackage } from '@/types'
import { get, isObject, set } from '@weapp-core/shared'
import { parse as parseJson, stringify } from 'comment-json'
import path from 'pathe'
import {
  shouldFillComponentGenericsDefault,
  shouldNormalizeUsingComponents,
} from '../platform'
import { changeFileExtension } from './file'
import { hasNpmDependencyPrefix, normalizeNpmImportPathByPlatform } from './npmImport'
import { toPosixPath } from './path'

export interface JsonResolvableEntry {
  json?: any
  jsonPath?: string
  type?: 'app' | 'page' | 'component' | 'plugin'
}

interface ResolveJsonOptions {
  dependencies?: Record<string, string>
  alipayNpmMode?: string
}

export const ALIPAY_GENERIC_COMPONENT_PLACEHOLDER = './__weapp_vite_generic_component'
export const WEAPP_SCOPED_SLOT_GENERIC_COMPONENT_PLACEHOLDER = './__weapp_vite_scoped_slot_generic_component'
const JSON_FILE_JS_EXTENSION_RE = /\.[jt]s$/
const COMPONENT_NAME_LOWER_TO_UPPER_RE = /([a-z0-9])([A-Z])/g
const COMPONENT_NAME_MULTI_UPPER_RE = /([A-Z]+)([A-Z][a-z])/g
const COMPONENT_NAME_HAS_UPPER_RE = /[A-Z]/
const SCOPED_SLOT_GENERIC_KEY_RE = /^scoped-slots-/

export function parseCommentJson(json: string) {
  return parseJson(json, undefined, true)
}

export function jsonFileRemoveJsExtension(fileName: string) {
  return fileName.replace(JSON_FILE_JS_EXTENSION_RE, '')
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

export function toKebabCaseComponentName(name: string) {
  return name
    .replace(COMPONENT_NAME_LOWER_TO_UPPER_RE, '$1-$2')
    .replace(COMPONENT_NAME_MULTI_UPPER_RE, '$1-$2')
    .toLowerCase()
}

function normalizeUsingComponentPathByPlatform(
  importee: string,
  platform: MpPlatform,
  dependencies?: Record<string, string>,
  mode?: string,
) {
  if (!hasNpmDependencyPrefix(dependencies, importee) && !importee.trim().startsWith('/')) {
    return importee
  }
  return normalizeNpmImportPathByPlatform(importee, {
    platform,
    dependencies,
    alipayNpmMode: mode,
  })
}

function normalizeUsingComponentsByPlatform(
  usingComponents: Record<string, string>,
  platform?: MpPlatform,
  options?: ResolveJsonOptions,
) {
  if (!shouldNormalizeUsingComponents(platform)) {
    return usingComponents
  }

  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(usingComponents)) {
    const nextKey = COMPONENT_NAME_HAS_UPPER_RE.test(key)
      ? toKebabCaseComponentName(key)
      : key
    const nextValue = normalizeUsingComponentPathByPlatform(value, platform!, options?.dependencies, options?.alipayNpmMode)
    if (!Reflect.has(normalized, nextKey)) {
      normalized[nextKey] = nextValue
    }
  }
  return normalized
}

function normalizeComponentGenericsByPlatform(
  componentGenerics: Record<string, any>,
  platform?: MpPlatform,
) {
  if (!shouldFillComponentGenericsDefault(platform) && platform !== 'weapp') {
    return componentGenerics
  }

  const normalized: Record<string, any> = {}
  for (const [key, value] of Object.entries(componentGenerics)) {
    const placeholder = platform === 'weapp'
      ? (SCOPED_SLOT_GENERIC_KEY_RE.test(key) ? WEAPP_SCOPED_SLOT_GENERIC_COMPONENT_PLACEHOLDER : undefined)
      : ALIPAY_GENERIC_COMPONENT_PLACEHOLDER
    if (!placeholder) {
      normalized[key] = value
      continue
    }

    if (value === true) {
      normalized[key] = { default: placeholder }
      continue
    }

    if (isObject(value)) {
      const nextValue = { ...(value as Record<string, any>) }
      if (typeof nextValue.default !== 'string' || !nextValue.default.trim()) {
        nextValue.default = placeholder
      }
      normalized[key] = nextValue
      continue
    }

    normalized[key] = value
  }

  return normalized
}

export function resolveJson(entry: JsonResolvableEntry, aliasEntries?: ResolvedAlias[], platform?: MpPlatform, options?: ResolveJsonOptions) {
  if (entry.json) {
    const json = structuredClone(entry.json)
    if (entry.jsonPath && Array.isArray(aliasEntries)) {
      const usingComponents: Record<string, string> = get(json, 'usingComponents')
      if (isObject(usingComponents)) {
        for (const [key, importee] of Object.entries(usingComponents)) {
          const resolvedId = resolveImportee(importee, entry.jsonPath, aliasEntries)
          set(json, `usingComponents.${key}`, resolvedId)
        }

        set(json, 'usingComponents', normalizeUsingComponentsByPlatform(usingComponents, platform, options))
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
        set(json, 'usingComponents', normalizeUsingComponentsByPlatform(usingComponents, platform, options))
      }
    }

    const componentGenerics: Record<string, any> = get(json, 'componentGenerics')
    if (isObject(componentGenerics)) {
      set(json, 'componentGenerics', normalizeComponentGenericsByPlatform(componentGenerics, platform))
    }

    // 去除提示用的 $schema
    if (Reflect.has(json, '$schema')) {
      // @ts-ignore
      delete json.$schema
    }
    return stringifyJson(json)
  }
}
