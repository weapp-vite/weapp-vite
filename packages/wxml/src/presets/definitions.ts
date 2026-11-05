import type { PlatformPresetId, TemplateDialectDefinition, TemplateDirectives, TemplateInputRecipe, TemplatePreset, TemplateScriptModule, TemplateScriptModuleRecipe, TemplateScriptReferenceRecipe } from './types'

const compatibilityRawTags = Object.freeze(['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs'])
const filterScriptReference = Object.freeze({ tag: 'filter', sourceAttribute: 'src' })

function dialect(id: string, syntax: TemplateDialectDefinition['syntax'], rawTags: readonly string[]): TemplateDialectDefinition {
  return Object.freeze({ id, syntax, rawTags: Object.freeze([...rawTags]) })
}

function module(extension: string, tag: string, format: TemplateScriptModule['format'] = 'commonjs', sourceAttribute: TemplateScriptModule['sourceAttribute'] = 'src', moduleAttribute: TemplateScriptModule['moduleAttribute'] = 'module'): TemplateScriptModule {
  return Object.freeze({ extension, tag, format, sourceAttribute, moduleAttribute })
}

function directives(prefix: string, separator = ':'): TemplateDirectives {
  const name = (suffix: string) => `${prefix}${separator}${suffix}`
  return Object.freeze({
    if: name('if'),
    elif: name('elif'),
    else: name('else'),
    for: name('for'),
    forItem: name('for-item'),
    forIndex: name('for-index'),
    key: name('key'),
  })
}

interface PresetInput {
  readonly id: PlatformPresetId
  readonly templateExtension: string
  readonly styleExtension: string
  readonly directivePrefix: string
  readonly directiveSeparator?: ':' | '-'
  readonly portableScriptModule: TemplateScriptModule
  readonly nativeScriptModules?: readonly TemplateScriptModule[]
  readonly extraRawTags?: readonly string[]
  readonly eventStyle?: TemplatePreset['eventStyle']
}

function createPreset(input: PresetInput): TemplatePreset {
  const nativeModules = Object.freeze([...(input.nativeScriptModules ?? [])])
  const nativeRawTags = [input.portableScriptModule.tag, ...nativeModules.map(module => module.tag), ...(input.extraRawTags ?? [])]
  const compatibilityDialect = dialect(`${input.id}-compatibility`, input.id === 'weapp' ? 'legacy' : 'xml', [...new Set([...compatibilityRawTags, ...nativeModules.map(module => module.tag)])])
  const nativeDialect = dialect(`${input.id}-native`, compatibilityDialect.syntax, [...new Set(nativeRawTags)])
  return Object.freeze({
    id: input.id,
    templateExtension: input.templateExtension,
    styleExtension: input.styleExtension,
    dialect: nativeDialect,
    nativeDialect,
    compatibilityDialect,
    portableScriptModule: input.portableScriptModule,
    nativeScriptModules: nativeModules,
    directives: directives(input.directivePrefix, input.directiveSeparator),
    directivePrefix: input.directivePrefix,
    directiveSeparator: input.directiveSeparator ?? ':',
    eventStyle: input.eventStyle ?? 'default',
  })
}

/** 纯模板语言预设；不会暗示对应平台具备构建或宿主 runtime 支持。 */
export const weapp = createPreset({
  id: 'weapp',
  templateExtension: '.wxml',
  styleExtension: '.wxss',
  directivePrefix: 'wx',
  portableScriptModule: module('wxs', 'wxs'),
})

export const alipay = createPreset({
  id: 'alipay',
  templateExtension: '.axml',
  styleExtension: '.acss',
  directivePrefix: 'a',
  eventStyle: 'alipay',
  portableScriptModule: module('sjs', 'import-sjs', 'esm', 'from', 'name'),
})

export const tt = createPreset({
  id: 'tt',
  templateExtension: '.ttml',
  styleExtension: '.ttss',
  directivePrefix: 'tt',
  portableScriptModule: module('sjs', 'sjs'),
})

export const swan = createPreset({
  id: 'swan',
  templateExtension: '.swan',
  styleExtension: '.css',
  directivePrefix: 's',
  directiveSeparator: '-',
  extraRawTags: [filterScriptReference.tag],
  portableScriptModule: module('sjs', 'import-sjs', 'esm'),
})

export const jd = createPreset({
  id: 'jd',
  templateExtension: '.jxml',
  styleExtension: '.jxss',
  directivePrefix: 'wx',
  portableScriptModule: module('wxs', 'wxs'),
  nativeScriptModules: [module('jds', 'jds')],
})

export const xhs = createPreset({
  id: 'xhs',
  templateExtension: '.xhsml',
  styleExtension: '.css',
  directivePrefix: 'wx',
  portableScriptModule: module('wxs', 'wxs'),
})

export const qq = createPreset({
  id: 'qq',
  templateExtension: '.qml',
  styleExtension: '.qss',
  directivePrefix: 'qq',
  portableScriptModule: module('wxs', 'wxs'),
  nativeScriptModules: [module('qs', 'qs')],
})

export const ks = createPreset({
  id: 'ks',
  templateExtension: '.ksml',
  styleExtension: '.css',
  directivePrefix: 'ks',
  portableScriptModule: module('ks', 'ks'),
})

export const ty = createPreset({
  id: 'ty',
  templateExtension: '.tyml',
  styleExtension: '.tyss',
  directivePrefix: 'ty',
  portableScriptModule: module('sjs', 'sjs'),
})

function referenceRecipe(script: Pick<TemplateScriptModule, 'tag' | 'sourceAttribute'>): TemplateScriptReferenceRecipe {
  return Object.freeze({ tag: script.tag, sourceAttributes: Object.freeze([script.sourceAttribute]) })
}

/** 兼容构建输入保留原有标签次序；平台原生别名由各自预设追加。 */
export const portableCompatibilityScriptRecipes: readonly TemplateScriptReferenceRecipe[] = Object.freeze([
  referenceRecipe(weapp.portableScriptModule),
  referenceRecipe(tt.portableScriptModule),
  referenceRecipe(filterScriptReference),
  referenceRecipe(alipay.portableScriptModule),
])

/** 无平台构建入口的历史默认，不暗示微信或其他宿主能力。 */
export const defaultTemplateInputRecipe: TemplateInputRecipe = Object.freeze({
  defaultScriptModule: weapp.portableScriptModule,
  scriptModules: Object.freeze([weapp.portableScriptModule, tt.portableScriptModule]),
  scriptReferences: portableCompatibilityScriptRecipes,
  rawTags: Object.freeze(portableCompatibilityScriptRecipes.map(recipe => recipe.tag)),
})

/** 旧共享 helper 在无平台时将 SJS 视为 ESM；有平台的缺省回退仍为 CommonJS。 */
export const legacyScriptModuleRecipes: Readonly<Record<'unprofiled' | 'platform', TemplateScriptModuleRecipe>> = Object.freeze({
  unprofiled: Object.freeze({
    defaultScriptModule: weapp.portableScriptModule,
    scriptModules: Object.freeze([
      weapp.portableScriptModule,
      module(tt.portableScriptModule.extension, tt.portableScriptModule.tag, 'esm'),
    ]),
  }),
  platform: defaultTemplateInputRecipe,
})

export const presets: readonly TemplatePreset[] = Object.freeze([weapp, alipay, tt, swan, jd, xhs, qq, ks, ty])

const presetById: ReadonlyMap<PlatformPresetId, TemplatePreset> = new Map(presets.map(preset => [preset.id, preset]))

/** 获取已登记的平台模板预设；平台输入校验和错误兼容由根入口负责。 */
export function getTemplatePreset(id: PlatformPresetId): TemplatePreset {
  return presetById.get(id)!
}
