export { BABEL_TS_MODULE_PARSER_OPTIONS, BABEL_TS_MODULE_PLUGINS, generate, getVisitorKeys, parse, parseJsLike, traverse } from './babel'
export {
  getObjectPropertyByKey,
  getRenderPropertyFromComponentOptions,
  resolveRenderableExpression,
  resolveRenderExpressionFromComponentOptions,
  toStaticObjectKey,
  unwrapTypeScriptExpression,
} from './babelNodes'
export { parseJsLikeWithEngine } from './engine'
export { babelAstEngine } from './engines/babel'
export { oxcAstEngine } from './engines/oxc'
export {
  collectComponentPropsFromCode,
  mapConstructorName,
  mayContainComponentPropsShape,
} from './operations/componentProps'
export type { ComponentPropMap } from './operations/componentProps'
export { collectFeatureFlagsFromCode, mayContainFeatureFlagHints } from './operations/featureFlags'
export type { FeatureFlagOptions } from './operations/featureFlags'
export {
  collectJsxAutoComponentsFromCode,
  defaultIsDefineComponentSource,
  mayContainJsxAutoComponentEntry,
} from './operations/jsxAutoComponents'
export { collectJsxImportedComponentsAndDefaultExportFromBabelAst } from './operations/jsxAutoComponents'
export { collectJsxTemplateTagsFromBabelExpression } from './operations/jsxAutoComponents'
export type {
  JsxAutoComponentAnalysisOptions,
  JsxAutoComponentContext,
  JsxBabelModuleAnalysisOptions,
  JsxImportedComponent,
} from './operations/jsxAutoComponents'
export {
  collectOnPageScrollPerformanceWarnings,
  createLineStartOffsets,
  createWarningPrefix,
  getLocationFromOffset,
} from './operations/onPageScroll'
export {
  isPlatformApiIdentifier,
  mayContainPlatformApiAccess,
  mayContainPlatformApiIdentifierByText,
  platformApiIdentifierList,
  platformApiIdentifiers,
} from './operations/platformApi'
export { collectRequireTokens, mayContainStaticRequireLiteral } from './operations/require'
export type { RequireToken } from './operations/require'
export { collectScriptSetupImportsFromCode } from './operations/scriptSetupImports'
export type { ScriptSetupImport } from './operations/scriptSetupImports'
export { collectSetDataPickKeysFromTemplateCode } from './operations/setDataPick'
export type { AstEngineName, AstParserLike, WeappAstConfig } from './types'
