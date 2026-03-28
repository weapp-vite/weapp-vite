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
  collectComponentPropsWithBabel,
  collectComponentPropsWithOxc,
  extractComponentProperties,
  extractPropertiesObject,
  getStaticPropertyName,
  mapConstructorName,
  mayContainComponentPropsShape,
  resolveOptionsObjectExpression,
  resolveOptionsObjectExpressionWithBabel,
  resolveTypeFromNode,
} from './operations/componentProps'
export type { ComponentPropMap } from './operations/componentProps'
export {
  collectFeatureFlagsFromCode,
  collectFeatureFlagsWithBabel,
  collectFeatureFlagsWithOxc,
  consumeNamedFeatureFlag,
  consumeNamespaceFeatureFlag,
  mayContainFeatureFlagHints,
  registerNamedFeatureFlagLocal,
  registerNamespaceFeatureFlagLocal,
} from './operations/featureFlags'
export type { FeatureFlagOptions } from './operations/featureFlags'
export {
  collectJsxAutoComponentsFromCode,
  collectJsxAutoComponentsWithBabel,
  collectJsxAutoComponentsWithOxc,
  collectJsxTemplateTagsFromOxc,
  createJsxImportedComponent,
  defaultIsDefineComponentSource,
  defaultResolveBabelComponentExpression,
  defaultResolveBabelRenderExpression,
  getJsxImportedName,
  getJsxImportLocalName,
  getJsxOxcStaticPropertyName,
  isJsxDefineComponentImportSpecifier,
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
  collectOnPageScrollWarningsWithBabel,
  collectOnPageScrollWarningsWithOxc,
  collectPageScrollInspection,
  collectPageScrollInspectionWithOxc,
  createLineStartOffsets,
  createWarningPrefix,
  getCallExpressionCalleeName,
  getLocationFromOffset,
  getMemberExpressionPropertyName,
  getOnPageScrollCallbackArgument,
  getOxcCallExpressionCalleeName,
  getOxcMemberExpressionPropertyName,
  getOxcStaticPropertyName,
  isOnPageScrollCallee,
  isOxcFunctionLike,
  isOxcOnPageScrollCallee,
  isStaticPropertyName,
} from './operations/onPageScroll'
export {
  hasPlatformApiMemberExpression,
  isPlatformApiIdentifier,
  isPlatformApiMemberExpression,
  mayContainPlatformApiAccess,
  mayContainPlatformApiIdentifierByText,
  platformApiIdentifierList,
  platformApiIdentifiers,
} from './operations/platformApi'
export {
  collectRequireTokens,
  getRequireAsyncLiteralToken,
  getStaticRequireLiteralValue,
  hasStaticRequireCall,
  isStaticRequireCall,
  mayContainRequireCallByText,
  mayContainStaticRequireLiteral,
} from './operations/require'
export type { RequireToken } from './operations/require'
export {
  collectScriptSetupImportsFromCode,
  collectScriptSetupImportsWithBabel,
  collectScriptSetupImportsWithOxc,
  createScriptSetupImport,
  getScriptSetupImportedName,
  mayContainRelevantScriptSetupImports,
} from './operations/scriptSetupImports'
export type { ScriptSetupImport } from './operations/scriptSetupImports'
export {
  collectIdentifiersFromExpression,
  collectIdentifiersFromExpressionWithOxc,
  collectLoopScopeAliases,
  collectPatternBindingNames,
  collectSetDataPickKeysFromTemplateCode,
  collectSetDataPickKeysWithBabel,
  collectSetDataPickKeysWithOxc,
  extractTemplateExpressions,
  hasBindingInScopes,
} from './operations/setDataPick'
export type { AstEngineName, AstParserLike, WeappAstConfig } from './types'
