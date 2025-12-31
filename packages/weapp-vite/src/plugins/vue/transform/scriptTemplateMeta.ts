import type { File as BabelFile } from '@babel/types'
import * as t from '@babel/types'
import { traverse } from './babel'

export function injectTemplateComponentMeta(
  ast: BabelFile,
  templateComponentMeta: Record<string, string>,
): boolean {
  if (!Object.keys(templateComponentMeta).length) {
    return false
  }

  const metaMap = templateComponentMeta
  const candidateNames = new Set(Object.keys(metaMap))
  const injectedNames = new Set<string>()
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
        return !candidateNames.has(localName)
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

  const decls: t.Statement[] = []
  for (const name of Object.keys(metaMap)) {
    if (injectedNames.has(name)) {
      continue
    }
    injectedNames.add(name)
    decls.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(name),
          t.objectExpression([
            t.objectProperty(t.identifier('__weappViteUsingComponent'), t.booleanLiteral(true)),
            t.objectProperty(t.identifier('name'), t.stringLiteral(name)),
            t.objectProperty(t.identifier('from'), t.stringLiteral(metaMap[name])),
          ]),
        ),
      ]),
    )
  }

  if (decls.length) {
    const body = ast.program.body
    let insertAt = 0
    while (insertAt < body.length && t.isImportDeclaration(body[insertAt])) {
      insertAt += 1
    }
    body.splice(insertAt, 0, ...decls)
    changed = true
  }

  return changed
}
