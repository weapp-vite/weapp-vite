import type { Expression, JSXElement, JSXFragment } from '@weapp-vite/ast/babelTypes'
import type { WevuBindingManifestV1 } from '../../../types/bindingManifest'
import type { ClassStyleBinding, ForParseResult, InlineExpressionAsset, TemplateCompileOptions } from '../../vue/compiler/template/types'

export interface JsxModuleExport {
  expression: Expression | JSXElement | JSXFragment
  params: string[]
}

export interface JsxModuleResolver {
  getDependencies: () => string[]
  resolveExport: (filename: string, localName: string) => JsxModuleExport | undefined
  resolveImport: (filename: string, source: string, importedName: string) => JsxModuleExport | undefined
}

export interface JsxDynamicIslandMetadata {
  id: string
  expression: string
  reason: 'closure' | 'dynamic-component' | 'dynamic-spread' | 'spread-child' | 'unsupported-import' | 'unsupported-call'
  captures: string[]
}

export type JsxDynamicIslandReason = JsxDynamicIslandMetadata['reason']

export interface JsxCompileContext {
  platform: NonNullable<TemplateCompileOptions['platform']>
  mustacheInterpolation: NonNullable<TemplateCompileOptions['mustacheInterpolation']>
  formatWxml: boolean
  warnings: string[]
  bindingManifest: WevuBindingManifestV1
  inlineExpressions: InlineExpressionAsset[]
  classStyleBindings: ClassStyleBinding[]
  forStack: ForParseResult[]
  interpolationCache: WeakMap<Expression, string>
  inlineExpressionSeed: number
  scopeStack: string[]
  setupRefBindings?: Set<string>
  bindingScopeStack: Array<{
    locals: string[]
    sourceExpression: string
    sourceLocals: string[]
  }>
  filename?: string
  moduleResolver?: JsxModuleResolver
  importedBindings?: Map<string, { source: string, importedName: string }>
  resolvingExports?: Set<string>
  dynamicIslands?: JsxDynamicIslandMetadata[]
  dynamicIslandSeed?: number
  dynamicIslandMode?: 'auto' | 'static' | 'dynamic'
  /** 是否启用 Teleport → root-portal 映射，默认 `true`。 */
  teleportEnabled: boolean
  /** 当前文件是否已输出 root-portal 基础库要求提示，避免同一文件重复告警。 */
  teleportBaseLibraryHinted?: boolean
}

export interface JsxImportedComponent {
  localName: string
  importSource: string
  importedName?: string
  kind: 'default' | 'named'
}

export interface JsxAutoComponentContext {
  templateTags: Set<string>
  importedComponents: JsxImportedComponent[]
}
