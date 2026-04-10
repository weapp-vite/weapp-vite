import type { Expression, ObjectExpression } from '@babel/types'
import type * as t from '@babel/types'
import type { AstEngineName } from '../../types'

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

export interface JsxAutoComponentAnalysisOptions {
  astEngine?: AstEngineName
  isCollectableTag: (tag: string) => boolean
  isDefineComponentSource?: (source: string) => boolean
  resolveBabelComponentExpression?: (
    declaration: t.Declaration | t.Expression | null,
    defineComponentDecls: Map<string, ObjectExpression>,
    defineComponentAliases: Set<string>,
  ) => Expression | null
  resolveBabelRenderExpression?: (componentExpr: Expression) => Expression | null
}

export interface JsxBabelModuleAnalysisOptions {
  isDefineComponentSource?: (source: string) => boolean
  resolveBabelComponentExpression?: (
    declaration: t.Declaration | t.Expression | null,
    defineComponentDecls: Map<string, ObjectExpression>,
    defineComponentAliases: Set<string>,
  ) => Expression | null
}
