import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type { ImportDeclaration, ImportSpecifier, Node } from '@weapp-vite/ast/babelTypes'
import type MagicString from 'magic-string'
import type { PageDeclarationImport, PageDeclarationParsedBlock, PageDeclarationTextEdit } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import path from 'pathe'
import { rewriteRelativeImportSource } from '../plugins/vue/transform/tempImportRewrite'

function nodeStart(node: Node) {
  return node.start ?? 0
}

function nodeEnd(node: Node) {
  return node.end ?? nodeStart(node)
}

function isValueBindingPath(bindingPath: NodePath) {
  const declarationPath = bindingPath.parentPath
  if (('declare' in bindingPath.node && bindingPath.node.declare === true)
    || (declarationPath?.isVariableDeclaration() && declarationPath.node.declare === true)) {
    return false
  }
  if (!declarationPath?.isImportDeclaration()) {
    return true
  }
  if (declarationPath.node.importKind === 'type') {
    return false
  }
  return !bindingPath.isImportSpecifier() || bindingPath.node.importKind !== 'type'
}

export function hasTypeScriptValueBinding(parsed: PageDeclarationParsedBlock, reference: NodePath, name: string) {
  for (let current: NodePath | null = reference; current; current = current.parentPath) {
    if (parsed.typeScriptValueBindings.get(current.node)?.has(name)) {
      return true
    }
  }
  return false
}

export function hasValueBinding(parsed: PageDeclarationParsedBlock, reference: NodePath, name: string) {
  const binding = reference.scope.getBinding(name)
  return Boolean(binding && isValueBindingPath(binding.path))
    || hasTypeScriptValueBinding(parsed, reference, name)
}

function hasModuleVisibleValueBinding(parsedBlocks: PageDeclarationParsedBlock[], name: string) {
  return parsedBlocks.some((parsed) => {
    if (parsed.block.kind === 'script' && parsed.typeScriptValueBindings.get(parsed.ast.program)?.has(name)) {
      return true
    }
    const binding = parsed.programPath.scope.getBinding(name)
    if (!binding || !isValueBindingPath(binding.path)) {
      return false
    }
    // 普通脚本顶层绑定属于模块作用域；setup 中只有运行时导入会被提升到该作用域。
    return parsed.block.kind === 'script' || binding.path.parentPath?.isImportDeclaration() === true
  })
}

export function getImportRemovalEdits(macroImports: PageDeclarationImport[]): PageDeclarationTextEdit[] {
  const byDeclaration = new Map<ImportDeclaration, PageDeclarationImport[]>()
  for (const macroImport of macroImports) {
    const entries = byDeclaration.get(macroImport.declaration) ?? []
    entries.push(macroImport)
    byDeclaration.set(macroImport.declaration, entries)
  }

  const edits: PageDeclarationTextEdit[] = []
  for (const [declaration, entries] of byDeclaration) {
    const block = entries[0]!.block
    const removed = new Set<ImportSpecifier>(entries.map(entry => entry.specifier))
    const remaining = declaration.specifiers.filter((specifier) => {
      return !t.isImportSpecifier(specifier) || !removed.has(specifier)
    })
    if (!remaining.length) {
      edits.push({
        block,
        start: nodeStart(declaration),
        end: nodeEnd(declaration),
      })
      continue
    }

    const namedSpecifiers = declaration.specifiers.filter(t.isImportSpecifier)
    const remainingNamed = namedSpecifiers.filter(specifier => !removed.has(specifier))
    if (!remainingNamed.length) {
      edits.push({
        block,
        start: nodeStart(namedSpecifiers[0]!),
        end: nodeEnd(namedSpecifiers[namedSpecifiers.length - 1]!),
      })
      continue
    }

    for (let index = 0; index < namedSpecifiers.length;) {
      if (!removed.has(namedSpecifiers[index]!)) {
        index += 1
        continue
      }
      const firstRemoved = index
      while (index < namedSpecifiers.length && removed.has(namedSpecifiers[index]!)) {
        index += 1
      }
      const lastRemoved = index - 1
      const nextKept = namedSpecifiers[index]
      const previousKept = namedSpecifiers[firstRemoved - 1]
      edits.push(nextKept
        ? {
            block,
            start: nodeStart(namedSpecifiers[firstRemoved]!),
            end: nodeStart(nextKept),
          }
        : {
            block,
            start: nodeEnd(previousKept!),
            end: nodeEnd(namedSpecifiers[lastRemoved]!),
          })
    }
  }
  return edits
}

export function rebaseExternalScriptImports(
  parsed: PageDeclarationParsedBlock,
  targetFilename: string,
  code: MagicString,
  parsedBlocks: PageDeclarationParsedBlock[],
) {
  const sourceDir = path.dirname(parsed.block.filename)
  const targetDir = path.dirname(targetFilename)
  if (sourceDir === targetDir) {
    return
  }
  const rewriteSource = (node: Node | null | undefined) => {
    if (!t.isStringLiteral(node) || !node.value.startsWith('.')) {
      return
    }
    code.overwrite(
      parsed.block.offset + nodeStart(node),
      parsed.block.offset + nodeEnd(node),
      JSON.stringify(rewriteRelativeImportSource(node.value, sourceDir, targetDir)),
    )
  }
  const hasModuleRequireBinding = hasModuleVisibleValueBinding(parsedBlocks, 'require')
  parsed.programPath.traverse({
    ImportDeclaration(path) {
      rewriteSource(path.node.source)
    },
    ExportNamedDeclaration(path) {
      rewriteSource(path.node.source)
    },
    ExportAllDeclaration(path) {
      rewriteSource(path.node.source)
    },
    ImportExpression(path) {
      rewriteSource(path.node.source)
    },
    CallExpression(path) {
      const { callee, arguments: args } = path.node
      if (t.isImport(callee)) {
        rewriteSource(args[0])
        return
      }
      if (!t.isIdentifier(callee, { name: 'require' })) {
        return
      }
      if (!hasModuleRequireBinding && !hasValueBinding(parsed, path, 'require')) {
        rewriteSource(args[0])
      }
    },
  })
}
