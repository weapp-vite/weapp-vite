import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type { CallExpression, ExpressionStatement, File, ImportDeclaration, ImportSpecifier, Node, Program } from '@weapp-vite/ast/babelTypes'

export type StaticRouteValue
  = | null
    | boolean
    | number
    | string
    | StaticRouteValue[]
    | { [key: string]: StaticRouteValue }

export interface StaticPageDeclaration {
  name: string
  meta?: Record<string, StaticRouteValue>
}

export type PageDeclarationScriptBlockKind = 'script' | 'scriptSetup'

export interface PageDeclarationScriptBlock {
  content: string
  filename: string
  kind: PageDeclarationScriptBlockKind
  offset: number
  order: number
  source: string
}

export interface PageDeclarationParsedBlock {
  ast: File
  block: PageDeclarationScriptBlock
  programPath: NodePath<Program>
  typeScriptValueBindings: Map<Node, Set<string>>
}

export interface PageDeclarationImport {
  block: PageDeclarationScriptBlock
  declaration: ImportDeclaration
  specifier: ImportSpecifier
}

export interface PageDeclarationCall {
  block: PageDeclarationScriptBlock
  call: CallExpression
  statement: ExpressionStatement
}

export interface PageDeclarationTextEdit {
  block: PageDeclarationScriptBlock
  end: number
  start: number
}

export interface PageDeclarationAnalysis {
  declaration?: StaticPageDeclaration
  declarationSourceFile?: string
  edits: PageDeclarationTextEdit[]
  parsedBlocks: PageDeclarationParsedBlock[]
}
