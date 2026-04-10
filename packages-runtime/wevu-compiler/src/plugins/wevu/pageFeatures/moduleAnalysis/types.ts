import type * as t from '@weapp-vite/ast/babelTypes'
import type { AstEngineName } from '../../../../ast/types'
import type { WevuPageFeatureFlag } from '../types'

export type FunctionLike
  = | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression
    | t.ObjectMethod
    | { type: string, [key: string]: any }

export type ExportTarget
  = | { type: 'local', localName: string }
    | { type: 'reexport', source: string, importedName: string }
    | { type: 'inline', node: FunctionLike }

export type ImportBinding
  = | { kind: 'named', source: string, importedName: string }
    | { kind: 'default', source: string }
    | { kind: 'namespace', source: string }

export interface ModuleAnalysis {
  id: string
  engine: AstEngineName
  ast?: t.File
  wevuNamedHookLocals: Map<string, WevuPageFeatureFlag>
  wevuNamespaceLocals: Set<string>
  importedBindings: Map<string, ImportBinding>
  localFunctions: Map<string, FunctionLike>
  exports: Map<string, ExportTarget>
}
