import type { AliasOptions, MpPlatform, ResolvedAlias, SubPackage } from '@/types'
import { get, isObject, set } from '@weapp-core/shared'
import { parse as parseJson, stringify } from 'comment-json'
import path from 'pathe'
import {
  shouldFillComponentGenericsDefault,
  shouldNormalizeUsingComponents,
} from '../platform'
import { getAlipayNpmImportPrefix, normalizeAlipayNpmImportPath } from './alipayNpm'
import { changeFileExtension } from './file'
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
const JSON_FILE_JS_EXTENSION_RE = /\.[jt]s$/
const COMPONENT_NAME_LOWER_TO_UPPER_RE = /([a-z0-9])([A-Z])/g
const COMPONENT_NAME_MULTI_UPPER_RE = /([A-Z]+)([A-Z][a-z])/g
const COMPONENT_NAME_HAS_UPPER_RE = /[A-Z]/
const WINDOWS_PATH_SEPARATORS_RE = /\\/g
const NPM_PROTOCOL_RE = /^npm:/
const PLUGIN_PROTOCOL_RE = /^plugin:\/\//
const EXPLICIT_ALIPAY_NPM_DIR_RE = /^\/(?:miniprogram_npm|node_modules)\//

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

function toKebabCaseComponentName(name: string) {
  return name
    .replace(COMPONENT_NAME_LOWER_TO_UPPER_RE, '$1-$2')
    .replace(COMPONENT_NAME_MULTI_UPPER_RE, '$1-$2')
    .toLowerCase()
}

function hasDependencyPrefix(dependencies: Record<string, string> | undefined, importee: string) {
  if (!dependencies) {
    return false
  }

  const normalizedImportee = importee.replace(WINDOWS_PATH_SEPARATORS_RE, '/').replace(NPM_PROTOCOL_RE, '')
  const importeeTokens = normalizedImportee.split('/').filter(Boolean)

  if (importeeTokens.length === 0) {
    return false
  }

  return Object.keys(dependencies).some((dep) => {
    const depTokens = dep.replace(WINDOWS_PATH_SEPARATORS_RE, '/').split('/').filter(Boolean)
    if (depTokens.length === 0 || depTokens.length > importeeTokens.length) {
      return false
    }

    for (let i = 0; i < depTokens.length; i++) {
      if (depTokens[i] !== importeeTokens[i]) {
        return false
      }
    }

    return true
  })
}

function normalizeUsingComponentPathForAlipay(importee: string, dependencies?: Record<string, string>, mode?: string) {
  const raw = importee.trim()
  if (!raw || PLUGIN_PROTOCOL_RE.test(raw)) {
    return importee
  }

  const normalized = raw.replace(NPM_PROTOCOL_RE, '')
  const npmPrefix = getAlipayNpmImportPrefix(mode)
  if (EXPLICIT_ALIPAY_NPM_DIR_RE.test(normalized)) {
    return normalizeAlipayNpmImportPath(normalized, mode)
  }

  if (!hasDependencyPrefix(dependencies, normalized)) {
    return importee
  }

  if (normalized.startsWith(npmPrefix)) {
    return normalized
  }

  return normalizeAlipayNpmImportPath(normalized, mode)
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
    const nextValue = normalizeUsingComponentPathForAlipay(value, options?.dependencies, options?.alipayNpmMode)
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
  if (!shouldFillComponentGenericsDefault(platform)) {
    return componentGenerics
  }

  const normalized: Record<string, any> = {}
  for (const [key, value] of Object.entries(componentGenerics)) {
    if (value === true) {
      normalized[key] = { default: ALIPAY_GENERIC_COMPONENT_PLACEHOLDER }
      continue
    }

    if (isObject(value)) {
      const nextValue = { ...(value as Record<string, any>) }
      if (typeof nextValue.default !== 'string' || !nextValue.default.trim()) {
        nextValue.default = ALIPAY_GENERIC_COMPONENT_PLACEHOLDER
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
