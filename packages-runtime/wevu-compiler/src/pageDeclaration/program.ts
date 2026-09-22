import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type { File } from '@weapp-vite/ast/babelTypes'
import type {
  PageDeclarationParsedBlock,
  PageDeclarationScriptBlock,
  PageDeclarationScriptBlockKind,
} from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../utils/babel'
import { createPageDeclarationParseError } from './diagnostics'

type ProgramPath = NodePath<t.Program>

function hasRuntimeCode(node: t.Node): boolean {
  if (('declare' in node && node.declare === true)
    || t.isTSInterfaceDeclaration(node)
    || t.isTSTypeAliasDeclaration(node)
    || t.isTSDeclareFunction(node)
    || t.isEmptyStatement(node)) {
    return false
  }
  if (t.isImportDeclaration(node) || t.isTSImportEqualsDeclaration(node)) {
    return node.importKind !== 'type'
  }
  if (t.isExportNamedDeclaration(node)) {
    return node.exportKind !== 'type'
      && (node.declaration ? hasRuntimeCode(node.declaration) : node.specifiers.some(specifier => !t.isExportSpecifier(specifier) || specifier.exportKind !== 'type'))
  }
  if (t.isTSModuleDeclaration(node)) {
    return Boolean(node.body && hasRuntimeCode(node.body))
  }
  if (t.isTSModuleBlock(node)) {
    return node.body.some(hasRuntimeCode)
  }
  return true
}

function createParsedBlock(ast: File, block: PageDeclarationScriptBlock): PageDeclarationParsedBlock {
  let programPath: ProgramPath | undefined
  // Babel 不登记 enum/namespace 的值绑定；按原 AST 作用域补齐，不改写源码位置。
  const typeScriptValueBindings: PageDeclarationParsedBlock['typeScriptValueBindings'] = new Map()
  const registerTypeScriptValue = (path: NodePath<t.TSEnumDeclaration | t.TSModuleDeclaration | t.TSImportEqualsDeclaration>) => {
    if (!t.isIdentifier(path.node.id) || !hasRuntimeCode(path.node)
      || path.findParent(parent => 'declare' in parent.node && parent.node.declare === true)) {
      return
    }
    let owner: t.Node = path.scope.block
    for (let parent: NodePath | null = path.parentPath; parent && parent.node !== owner; parent = parent.parentPath) {
      if (parent.isTSModuleBlock() || parent.isTSModuleDeclaration()) {
        owner = parent.node
        break
      }
    }
    const names = typeScriptValueBindings.get(owner) ?? new Set<string>()
    names.add(path.node.id.name)
    typeScriptValueBindings.set(owner, names)
  }
  traverse(ast, {
    Program(path: ProgramPath) {
      programPath = path
    },
    TSEnumDeclaration: registerTypeScriptValue,
    TSModuleDeclaration: registerTypeScriptValue,
    TSImportEqualsDeclaration: registerTypeScriptValue,
  })
  if (!programPath) {
    throw new Error(`${block.filename}:1:1 无法读取页面声明模块。`)
  }
  return { ast, block, programPath, typeScriptValueBindings }
}

export function parsePageDeclarationBlock(block: PageDeclarationScriptBlock): PageDeclarationParsedBlock {
  let ast: File
  try {
    ast = parse(block.content, {
      ...BABEL_TS_MODULE_PARSER_OPTIONS,
      sourceFilename: block.filename,
    }) as File
  }
  catch (error) {
    throw createPageDeclarationParseError(block, error)
  }
  return createParsedBlock(ast, block)
}

export function createProgramBlock(ast: File, kind: PageDeclarationScriptBlockKind) {
  return createParsedBlock(ast, {
    content: '',
    filename: '',
    kind,
    offset: 0,
    order: 0,
    source: '',
  })
}
