import type { MiniProgramNativeScriptModule } from '@weapp-core/shared'
import type { MpPlatform } from '../types'
import { getMiniProgramNativeScriptModules, getMiniProgramScriptModuleOptions } from '@weapp-core/shared'
import { getPlatformOutputExtensions, getPlatformScriptModuleTag } from '../platform'
import { MINI_PROGRAM_PLATFORM_ADAPTERS } from '../platforms/adapters'

const IMPORT_SJS_TAG_RE = /<import-sjs([\s\S]*?)>/g
const IMPORT_SJS_SRC_RE = /\bsrc\s*=\s*/g
const IMPORT_SJS_MODULE_RE = /\bmodule\s*=\s*/g
const DEFAULT_SCRIPT_MODULE_TAG_NAMES = ['wxs', 'sjs', 'filter'] as const
const DEFAULT_SCRIPT_MODULE_TAG_BY_EXTENSION = Object.freeze({
  wxs: 'wxs',
  sjs: 'sjs',
} as const)
const SCRIPT_MODULE_IMPORT_ATTRS = Object.freeze({
  'wxs': ['src'],
  'sjs': ['src'],
  'import-sjs': ['from'],
  'filter': ['src'],
} satisfies Readonly<Record<string, readonly string[]>>)

type ScriptModuleExtensionKey = keyof typeof DEFAULT_SCRIPT_MODULE_TAG_BY_EXTENSION
type ScriptModuleImportTagName = keyof typeof SCRIPT_MODULE_IMPORT_ATTRS
const scriptModuleTagNames = new Map<MpPlatform | undefined, readonly string[]>()
const nativeScriptModules = new Map<MpPlatform | undefined, ReadonlyMap<string, MiniProgramNativeScriptModule>>()

/** 额外原生脚本身份仅在对应平台内成立，不扩大普通组件的原文边界。 */
export function getNativeScriptModuleByTag(tagName?: string, platform?: MpPlatform) {
  if (!tagName) {
    return undefined
  }
  let modules = nativeScriptModules.get(platform)
  if (!modules) {
    modules = new Map(getMiniProgramNativeScriptModules(platform).map(module => [module.tag, module]))
    nativeScriptModules.set(platform, modules)
  }
  return modules.get(tagName)
}

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
  if (!normalizedExtension || !Object.hasOwn(DEFAULT_SCRIPT_MODULE_TAG_BY_EXTENSION, normalizedExtension)) {
    return 'wxs'
  }
  return DEFAULT_SCRIPT_MODULE_TAG_BY_EXTENSION[normalizedExtension as ScriptModuleExtensionKey]
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

export function getDerivedScriptModuleTagNames() {
  return MINI_PROGRAM_PLATFORM_ADAPTERS
    .flatMap(adapter => Object.values(adapter.scriptModuleTagByExtension ?? {}))
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export function getScriptModuleTagNames(platform?: MpPlatform) {
  let names = scriptModuleTagNames.get(platform)
  if (!names) {
    names = Object.freeze([...new Set([...DEFAULT_SCRIPT_MODULE_TAG_NAMES, ...getDerivedScriptModuleTagNames(), ...getMiniProgramNativeScriptModules(platform).map(module => module.tag)])])
    scriptModuleTagNames.set(platform, names)
  }
  return names
}

/** 最终产物只将目标平台的脚本标签视为原始正文，避免遮蔽同名普通组件。 */
export function getOutputTemplateRawTags(platform: MpPlatform) {
  const tag = getMiniProgramScriptModuleOptions(platform, getPlatformOutputExtensions(platform).wxs).tag
  return [...new Set([tag, ...(platform === 'swan' ? ['filter'] : []), ...getMiniProgramNativeScriptModules(platform).map(module => module.tag)])]
}

export function isScriptModuleTagName(tagName?: string, platform?: MpPlatform) {
  return typeof tagName === 'string' && getScriptModuleTagNames(platform).includes(tagName)
}

export function getScriptModuleImportAttrs(tagName?: string, platform?: MpPlatform) {
  if (!tagName) {
    return undefined
  }
  const native = getNativeScriptModuleByTag(tagName, platform)
  if (native) {
    return [native.sourceAttribute]
  }
  if (!Object.hasOwn(SCRIPT_MODULE_IMPORT_ATTRS, tagName)) {
    return undefined
  }
  if (platform && tagName === getMiniProgramScriptModuleOptions(platform, 'sjs').tag) {
    return [getMiniProgramScriptModuleOptions(platform, 'sjs').sourceAttribute]
  }
  return SCRIPT_MODULE_IMPORT_ATTRS[tagName as ScriptModuleImportTagName]
}

export function isScriptModuleImportAttr(tagName: string | undefined, attrName: string, platform?: MpPlatform) {
  if (!tagName) {
    return false
  }
  return getScriptModuleImportAttrs(tagName, platform)?.includes(attrName) === true
}

export function shouldNormalizeScriptModuleAttributes(tagName?: string, platform?: MpPlatform) {
  return tagName === 'import-sjs' && (!platform || getMiniProgramScriptModuleOptions(platform, 'sjs').sourceAttribute === 'from')
}

export function normalizeImportSjsAttributes(source: string) {
  return source
    .replace(IMPORT_SJS_TAG_RE, (tag) => {
      return tag
        .replace(IMPORT_SJS_SRC_RE, 'from=')
        .replace(IMPORT_SJS_MODULE_RE, 'name=')
    })
}
