import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type { File as BabelFile } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../utils/babel'

function isScriptSetupReturnedObject(path: NodePath<t.ObjectExpression>) {
  const parent = path.parentPath
  if (
    parent?.isVariableDeclarator()
    && t.isIdentifier(parent.node.id, { name: '__returned__' })
  ) {
    return true
  }
  if (parent?.isReturnStatement()) {
    return true
  }
  return false
}

function isTemplateReturnGetterReference(path: NodePath<t.Identifier>) {
  const objectMethod = path.findParent(parent => parent.isObjectMethod())
  if (
    objectMethod?.isObjectMethod()
    && objectMethod.node.kind === 'get'
    && !objectMethod.node.computed
    && t.isIdentifier(objectMethod.node.key, { name: path.node.name })
    && objectMethod.parentPath?.isObjectExpression()
    && isScriptSetupReturnedObject(objectMethod.parentPath)
  ) {
    const getter = objectMethod.node.body.body.find(statement => t.isReturnStatement(statement))
    return Boolean(
      getter
      && t.isReturnStatement(getter)
      && t.isIdentifier(getter.argument, { name: path.node.name }),
    )
  }
  return false
}

function isReferencedOutsideTemplateReturn(path: NodePath<t.Identifier>) {
  if (!path.isReferencedIdentifier()) {
    return false
  }

  if (isTemplateReturnGetterReference(path)) {
    return false
  }

  return true
}

function collectReferencedNames(ast: BabelFile, candidateNames: Set<string>) {
  const referencedNames = new Set<string>()

  traverse(ast, {
    Identifier(path) {
      const name = path.node.name
      if (!candidateNames.has(name)) {
        return
      }
      if (isReferencedOutsideTemplateReturn(path)) {
        referencedNames.add(name)
      }
    },
  })

  return referencedNames
}

function removeSetupReturnProperties(ast: BabelFile, removableNames: Set<string>) {
  if (!removableNames.size) {
    return false
  }

  let changed = false
  traverse(ast, {
    ObjectMethod(path) {
      if (!path.parentPath?.isObjectExpression() || !isScriptSetupReturnedObject(path.parentPath)) {
        return
      }
      if (path.node.computed || !t.isIdentifier(path.node.key)) {
        return
      }
      const name = path.node.key.name
      if (!removableNames.has(name)) {
        return
      }
      if (path.node.kind !== 'get') {
        return
      }
      const getter = path.node.body.body.find(statement => t.isReturnStatement(statement))
      if (!getter || !t.isReturnStatement(getter) || !t.isIdentifier(getter.argument, { name })) {
        return
      }
      path.remove()
      changed = true
    },
  })
  return changed
}

export function pruneTemplateComponentMeta(
  ast: BabelFile,
  templateComponentMeta: Record<string, string>,
): boolean {
  if (!Object.keys(templateComponentMeta).length) {
    return false
  }

  const metaMap = templateComponentMeta
  const candidateNames = new Set(Object.keys(metaMap))
  const referencedNames = collectReferencedNames(ast, candidateNames)
  const removableNames = new Set([...candidateNames].filter(name => !referencedNames.has(name)))
  let changed = false

  traverse(ast, {
    ImportDeclaration(path) {
      if (!path.node.specifiers.length) {
        return
      }
      const kept = path.node.specifiers.filter((specifier) => {
        if (!('local' in specifier) || !t.isIdentifier(specifier.local)) {
          return true
        }
        const localName = specifier.local.name
        return !removableNames.has(localName)
      })

      if (kept.length !== path.node.specifiers.length) {
        changed = true
        if (kept.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = kept
      }
    },
  })

  changed = removeSetupReturnProperties(ast, removableNames) || changed

  return changed
}
