import type { InlineExpressionAsset, TemplateCompileOptions } from '../../vue/compiler/template/types'

export interface JsxCompileContext {
  platform: NonNullable<TemplateCompileOptions['platform']>
  mustacheInterpolation: NonNullable<TemplateCompileOptions['mustacheInterpolation']>
  warnings: string[]
  inlineExpressions: InlineExpressionAsset[]
  inlineExpressionSeed: number
  scopeStack: string[]
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
