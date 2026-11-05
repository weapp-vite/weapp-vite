/** 模板方言的最小定义；不包含构建器、IDE 或宿主 runtime 能力。 */
export interface TemplateDialectDefinition {
  readonly id: string
  readonly syntax: 'legacy' | 'xml'
  readonly rawTags: readonly string[]
}

export interface TemplateScriptModule {
  readonly extension: string
  readonly tag: string
  readonly format: 'commonjs' | 'esm'
  readonly sourceAttribute: 'src' | 'from'
  readonly moduleAttribute: 'module' | 'name'
}

/** 可移植兼容输入的引用属性，不为 filter 等标签推断模块制式。 */
export interface TemplateScriptReferenceRecipe {
  readonly tag: string
  readonly sourceAttributes: readonly string[]
}

export interface TemplateScriptModuleRecipe {
  readonly defaultScriptModule: TemplateScriptModule
  readonly scriptModules: readonly TemplateScriptModule[]
}

/** 历史构建输入的默认脚本约定；与某个平台的原生方言分开。 */
export interface TemplateInputRecipe extends TemplateScriptModuleRecipe {
  readonly scriptReferences: readonly TemplateScriptReferenceRecipe[]
  readonly rawTags: readonly string[]
}

export interface TemplateDirectives {
  readonly if: string
  readonly elif: string
  readonly else: string
  readonly for: string
  readonly forItem: string
  readonly forIndex: string
  readonly key: string
}

export interface TemplatePreset {
  readonly id: PlatformPresetId
  readonly templateExtension: string
  readonly styleExtension: string
  readonly dialect: TemplateDialectDefinition
  readonly nativeDialect: TemplateDialectDefinition
  readonly compatibilityDialect: TemplateDialectDefinition
  readonly portableScriptModule: TemplateScriptModule
  readonly nativeScriptModules: readonly TemplateScriptModule[]
  readonly directives: TemplateDirectives
  readonly directivePrefix: string
  readonly directiveSeparator: ':' | '-'
  readonly eventStyle: 'default' | 'alipay'
}

export type PlatformPresetId = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs' | 'qq' | 'ks' | 'ty'
