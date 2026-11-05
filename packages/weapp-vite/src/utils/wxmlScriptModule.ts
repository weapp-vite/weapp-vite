import type { MiniProgramNativeScriptModule } from '@weapp-core/shared'
import type { MpPlatform } from '../types'
import { getMiniProgramNativeScriptModules } from '@weapp-core/shared'
import { defaultTemplateInputRecipe, getTemplatePreset } from '@weapp-vite/wxml/presets'
import { getPlatformScriptModuleTag } from '../platform'
import { MINI_PROGRAM_PLATFORM_ADAPTERS } from '../platforms/adapters'

const IMPORT_SJS_TAG_RE = /<import-sjs([\s\S]*?)>/g
const IMPORT_SJS_SRC_RE = /\bsrc\s*=\s*/g
const IMPORT_SJS_MODULE_RE = /\bmodule\s*=\s*/g
const scriptModuleTagNames = new Map<MpPlatform | undefined, readonly string[]>()
const nativeScriptModules = new Map<MpPlatform | undefined, ReadonlyMap<string, MiniProgramNativeScriptModule>>()
/** 纯预设只在模块初始化时建索引，普通标签查询不扫描 recipe 或创建属性数组。 */
function compileScriptRecipes() {
  const tags: Record<string, string | undefined> = Object.create(null)
  const attributes: Record<string, readonly string[] | undefined> = Object.create(null)
  const singleAttributes: Record<string, readonly string[] | undefined> = Object.create(null)
  const platforms: Partial<Record<MpPlatform, Readonly<typeof attributes>>> = Object.create(null)
  const singleAttribute = (name: string) => singleAttributes[name] ??= Object.freeze([name])
  for (const module of defaultTemplateInputRecipe.scriptModules) {
    tags[module.extension] = module.tag
  }
  for (const recipe of defaultTemplateInputRecipe.scriptReferences) {
    attributes[recipe.tag] = recipe.sourceAttributes
    for (const name of recipe.sourceAttributes) {
      singleAttribute(name)
    }
  }
  for (const adapter of MINI_PROGRAM_PLATFORM_ADAPTERS) {
    const preset = getTemplatePreset(adapter.id)
    const portable = preset.portableScriptModule
    const selected: typeof attributes = Object.assign(Object.create(null), attributes)
    if (attributes[portable.tag]) {
      selected[portable.tag] = singleAttribute(portable.sourceAttribute)
    }
    for (const native of preset.nativeScriptModules) {
      singleAttribute(native.sourceAttribute)
    }
    platforms[adapter.id] = Object.freeze(selected)
  }
  return Object.freeze({
    tags: Object.freeze(tags),
    attributes: Object.freeze(attributes),
    singleAttributes: Object.freeze(singleAttributes),
    platforms: Object.freeze(platforms),
  })
}

const scriptRecipes = compileScriptRecipes()

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
  const normalizedExtension = normalizeScriptModuleExtension(scriptModuleExtension)
  return (normalizedExtension ? scriptRecipes.tags[normalizedExtension] : undefined)
    ?? defaultTemplateInputRecipe.defaultScriptModule.tag
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
    names = Object.freeze([...new Set([...defaultTemplateInputRecipe.rawTags, ...getDerivedScriptModuleTagNames(), ...getMiniProgramNativeScriptModules(platform).map(module => module.tag)])])
    scriptModuleTagNames.set(platform, names)
  }
  return names
}

/** 最终产物只将目标平台的脚本标签视为原始正文，避免遮蔽同名普通组件。 */
export function getOutputTemplateRawTags(platform: MpPlatform) {
  return [...getTemplatePreset(platform).dialect.rawTags]
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
    return scriptRecipes.singleAttributes[native.sourceAttribute]
  }
  return (platform ? scriptRecipes.platforms[platform]! : scriptRecipes.attributes)[tagName]
}

export function isScriptModuleImportAttr(tagName: string | undefined, attrName: string, platform?: MpPlatform) {
  if (!tagName) {
    return false
  }
  return getScriptModuleImportAttrs(tagName, platform)?.includes(attrName) === true
}

export function shouldNormalizeScriptModuleAttributes(tagName?: string, platform?: MpPlatform) {
  return tagName === 'import-sjs' && (!platform || getTemplatePreset(platform).portableScriptModule.sourceAttribute === 'from')
}

export function normalizeImportSjsAttributes(source: string) {
  return source
    .replace(IMPORT_SJS_TAG_RE, (tag) => {
      return tag
        .replace(IMPORT_SJS_SRC_RE, 'from=')
        .replace(IMPORT_SJS_MODULE_RE, 'name=')
    })
}
