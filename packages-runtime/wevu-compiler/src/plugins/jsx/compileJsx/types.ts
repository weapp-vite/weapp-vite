import type { Expression, JSXElement, JSXFragment } from '@weapp-vite/ast/babelTypes'
import type { WevuBindingManifestV1 } from '../../../types/bindingManifest'
import type { CompilerDiagnostic } from '../../../types/diagnostics'
import type { BaseLibraryCompileContext } from '../../../utils/baseLibrary'
import type { ClassStyleBinding, ForParseResult, InlineExpressionAsset, ResolvedTeleportCompileOptions, TemplateCompileOptions } from '../../vue/compiler/template/types'

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
  warningDiagnostics: Map<number, CompilerDiagnostic>
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
  /** 已归一化的 Teleport 编译配置，与模板编译上下文共用同一结构。 */
  teleport: ResolvedTeleportCompileOptions
  /** 基础库版本与提示去重上下文，各功能按主题复用。 */
  baseLibrary: BaseLibraryCompileContext
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
