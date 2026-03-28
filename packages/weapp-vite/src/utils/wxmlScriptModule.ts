import type { MpPlatform } from '../types'
import { getPlatformScriptModuleTag } from '../platform'
import { MINI_PROGRAM_PLATFORM_ADAPTERS } from '../platforms/adapters'

const IMPORT_SJS_TAG_RE = /<import-sjs([\s\S]*?)>/g
const IMPORT_SJS_SRC_RE = /\bsrc\s*=\s*/g
const IMPORT_SJS_MODULE_RE = /\bmodule\s*=\s*/g
const DEFAULT_SCRIPT_MODULE_TAG_NAMES = ['wxs', 'sjs'] as const
const DEFAULT_SCRIPT_MODULE_TAG_BY_EXTENSION = Object.freeze({
  wxs: 'wxs',
  sjs: 'sjs',
} as const)
const SCRIPT_MODULE_IMPORT_ATTRS = Object.freeze({
  'wxs': ['src'],
  'sjs': ['src'],
  'import-sjs': ['from'],
} satisfies Readonly<Record<string, readonly string[]>>)

export function resolveScriptModuleTagByPlatform(platform?: MpPlatform, scriptModuleExtension?: string) {
  return getPlatformScriptModuleTag(platform, scriptModuleExtension)
}

export function normalizeScriptModuleExtension(scriptModuleExtension?: string) {
  if (!scriptModuleExtension) {
    return undefined
  }
  return scriptModuleExtension.startsWith('.')
    ? scriptModuleExtension.slice(1)
    : scriptModuleExtension
}

export function getDefaultScriptModuleTagByExtension(scriptModuleExtension?: string) {
  if (!scriptModuleExtension) {
    return 'wxs'
  }
  const normalizedExtension = normalizeScriptModuleExtension(scriptModuleExtension)
  return DEFAULT_SCRIPT_MODULE_TAG_BY_EXTENSION[normalizedExtension] ?? 'wxs'
}

export function resolveScriptModuleTagName(options?: {
  platform?: MpPlatform
  scriptModuleExtension?: string
  scriptModuleTag?: string
}) {
  if (options?.scriptModuleTag) {
    return options.scriptModuleTag
  }
  return resolveScriptModuleTagByPlatform(options?.platform, options?.scriptModuleExtension)
    ?? getDefaultScriptModuleTagByExtension(options?.scriptModuleExtension)
}

export function getScriptModuleTagNames() {
  const derivedTagNames = MINI_PROGRAM_PLATFORM_ADAPTERS
    .flatMap(adapter => Object.values(adapter.scriptModuleTagByExtension ?? {}))
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  return [...new Set([...DEFAULT_SCRIPT_MODULE_TAG_NAMES, ...derivedTagNames])]
}

export function isScriptModuleTagName(tagName?: string) {
  return typeof tagName === 'string' && getScriptModuleTagNames().includes(tagName)
}

export function getScriptModuleImportAttrs(tagName?: string) {
  if (!tagName) {
    return undefined
  }
  return SCRIPT_MODULE_IMPORT_ATTRS[tagName]
}

export function isScriptModuleImportAttr(tagName: string | undefined, attrName: string) {
  if (!tagName) {
    return false
  }
  return getScriptModuleImportAttrs(tagName)?.includes(attrName) === true
}

export function shouldNormalizeScriptModuleAttributes(tagName?: string) {
  return tagName === 'import-sjs'
}

export function normalizeImportSjsAttributes(source: string) {
  return source
    .replace(IMPORT_SJS_TAG_RE, (tag) => {
      return tag
        .replace(IMPORT_SJS_SRC_RE, 'from=')
        .replace(IMPORT_SJS_MODULE_RE, 'name=')
    })
}
