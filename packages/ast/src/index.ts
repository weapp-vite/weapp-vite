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
  getStaticPropertyName,
  mapConstructorName,
  mayContainComponentPropsShape,
  resolveTypeFromNode,
} from './operations/componentProps'
export type { ComponentPropMap } from './operations/componentProps'
export { collectFeatureFlagsFromCode, mayContainFeatureFlagHints } from './operations/featureFlags'
export type { FeatureFlagOptions } from './operations/featureFlags'
export {
  collectJsxAutoComponentsFromCode,
  defaultIsDefineComponentSource,
  defaultResolveBabelComponentExpression,
  defaultResolveBabelRenderExpression,
  getJsxOxcStaticPropertyName,
  mayContainJsxAutoComponentEntry,
  resolveOxcComponentExpression,
  resolveOxcRenderExpression,
  unwrapOxcExpression,
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
  getMemberExpressionPropertyName,
  getOxcMemberExpressionPropertyName,
  getOxcStaticPropertyName,
  isStaticPropertyName,
} from './operations/onPageScroll'
export {
  isPlatformApiIdentifier,
  mayContainPlatformApiAccess,
  mayContainPlatformApiIdentifierByText,
  platformApiIdentifierList,
  platformApiIdentifiers,
} from './operations/platformApi'
export {
  collectRequireTokens,
  getRequireAsyncLiteralToken,
  getStaticRequireLiteralValue,
  mayContainRequireCallByText,
  mayContainStaticRequireLiteral,
} from './operations/require'
export type { RequireToken } from './operations/require'
export { collectScriptSetupImportsFromCode, mayContainRelevantScriptSetupImports } from './operations/scriptSetupImports'
export type { ScriptSetupImport } from './operations/scriptSetupImports'
export {
  collectLoopScopeAliases,
  collectSetDataPickKeysFromTemplateCode,
  extractTemplateExpressions,
} from './operations/setDataPick'
export type { AstEngineName, AstParserLike, WeappAstConfig } from './types'
