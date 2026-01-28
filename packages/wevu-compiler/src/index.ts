export * from './constants'
export { compileVueStyleToWxss as compileStyle, compileVueStyleToWxss } from './plugins/vue/compiler/style'
export type { StyleCompileOptions, StyleCompileResult } from './plugins/vue/compiler/style'
export { compileVueTemplateToWxml as compileTemplate, compileVueTemplateToWxml } from './plugins/vue/compiler/template'

export type { MiniProgramPlatform, TemplateCompileOptions, TemplateCompileResult } from './plugins/vue/compiler/template'
export { alipayPlatform, getMiniProgramTemplatePlatform, swanPlatform, ttPlatform, wechatPlatform } from './plugins/vue/compiler/template'
export {
  buildClassStyleWxsTag,
  CLASS_STYLE_WXS_FILE,
  CLASS_STYLE_WXS_MODULE,
  getClassStyleWxsSource,
  resolveClassStyleWxsLocation,
} from './plugins/vue/compiler/template/classStyleRuntime'
export type {
  ClassStyleBinding,
  ClassStyleRuntime,
  ForParseResult,
  InlineExpressionAsset,
  ScopedSlotComponentAsset,
  TemplateRefBinding,
} from './plugins/vue/compiler/template/types'
export { buildClassStyleComputedCode } from './plugins/vue/transform/classStyleComputed'
export { compileVueFile as compileSfc, compileVueFile } from './plugins/vue/transform/compileVueFile'
export type { AutoImportTagsOptions, AutoUsingComponentsOptions, CompileVueFileOptions, VueTransformResult } from './plugins/vue/transform/compileVueFile'
export { compileConfigBlocks, evaluateJsLikeConfig, isJsonLikeLang, normalizeConfigLang, resolveJsLikeLang } from './plugins/vue/transform/config'
export type { JsLikeLang } from './plugins/vue/transform/config'
export { extractJsonMacroFromScriptSetup, stripJsonMacroCallsFromCode } from './plugins/vue/transform/jsonMacros'

export { createJsonMerger, mergeJsonWithStrategy } from './plugins/vue/transform/jsonMerge'
export { generateScopedId } from './plugins/vue/transform/scopedId'
export { transformScript, transformScript as transformSfcScript } from './plugins/vue/transform/script'
export type { TransformResult, TransformScriptOptions } from './plugins/vue/transform/script'
export {
  collectWevuPageFeatureFlags,
  createPageEntryMatcher,
  injectWevuPageFeatureFlagsIntoOptionsObject,
  injectWevuPageFeaturesInJs,
  injectWevuPageFeaturesInJsWithResolver,
} from './plugins/wevu/pageFeatures'
export type { ModuleResolver, WevuPageFeatureFlag, WevuPageHookName } from './plugins/wevu/pageFeatures'
export type { JsonConfig, JsonMergeContext, JsonMergeStage, JsonMergeStrategy } from './types/json'

export type { MpPlatform } from './types/platform'
export type { WevuDefaults } from './types/wevu'
