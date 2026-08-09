import type { Expression, JSXElement, JSXFragment } from '@weapp-vite/ast/babelTypes'
import type { InlineExpressionAsset, TemplateCompileOptions } from '../../vue/compiler/template/types'

export interface JsxModuleExport {
  expression: Expression | JSXElement | JSXFragment
  params: string[]
}

export interface JsxModuleResolver {
  resolveExport: (filename: string, localName: string) => JsxModuleExport | undefined
  resolveImport: (filename: string, source: string, importedName: string) => JsxModuleExport | undefined
}

export interface JsxCompileContext {
  platform: NonNullable<TemplateCompileOptions['platform']>
  mustacheInterpolation: NonNullable<TemplateCompileOptions['mustacheInterpolation']>
  formatWxml: boolean
  warnings: string[]
  inlineExpressions: InlineExpressionAsset[]
  inlineExpressionSeed: number
  scopeStack: string[]
  filename?: string
  moduleResolver?: JsxModuleResolver
  importedBindings?: Map<string, { source: string, importedName: string }>
  resolvingExports?: Set<string>
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
