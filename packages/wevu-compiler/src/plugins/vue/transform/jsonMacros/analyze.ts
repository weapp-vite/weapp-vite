import type { Statement } from '@babel/types'
import * as t from '@babel/types'

function collectPatternNames(pattern: any, out: Set<string>) {
  if (!pattern) {
    return
  }
  if (t.isIdentifier(pattern)) {
    out.add(pattern.name)
    return
  }
  if (t.isRestElement(pattern)) {
    collectPatternNames(pattern.argument, out)
    return
  }
  if (t.isAssignmentPattern(pattern)) {
    collectPatternNames(pattern.left, out)
    return
  }
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isRestElement(prop)) {
        collectPatternNames(prop.argument, out)
      }
      else if (t.isObjectProperty(prop)) {
        collectPatternNames(prop.value, out)
      }
    }
    return
  }
  if (t.isArrayPattern(pattern)) {
    for (const el of pattern.elements) {
      collectPatternNames(el, out)
    }
  }
}

function declaredNamesInStatement(statement: Statement): Set<string> {
  const out = new Set<string>()

  if (t.isImportDeclaration(statement)) {
    for (const specifier of statement.specifiers) {
      if (t.isImportSpecifier(specifier) || t.isImportDefaultSpecifier(specifier) || t.isImportNamespaceSpecifier(specifier)) {
        if (t.isIdentifier(specifier.local)) {
          out.add(specifier.local.name)
        }
      }
    }
    return out
  }

  if (t.isVariableDeclaration(statement)) {
    for (const decl of statement.declarations) {
      collectPatternNames(decl.id, out)
    }
    return out
  }

  if (t.isFunctionDeclaration(statement) || t.isClassDeclaration(statement)) {
    if (statement.id && t.isIdentifier(statement.id)) {
      out.add(statement.id.name)
    }
    return out
  }

  if (t.isExportNamedDeclaration(statement) && statement.declaration) {
    return declaredNamesInStatement(statement.declaration as any)
  }

  return out
}

function collectTopLevelReferencedNames(path: any) {
  const names = new Set<string>()
  if (!path) {
    return names
  }

  const addIfTopLevelReferenced = (p: any) => {
    if (!p?.isReferencedIdentifier?.()) {
      return
    }
    const name = p.node.name
    const binding = p.scope?.getBinding(name)
    if (!binding) {
      return
    }
    if (binding.scope?.block?.type === 'Program') {
      names.add(name)
    }
  }

  addIfTopLevelReferenced(path)
  path.traverse({
    Identifier(p: any) {
      addIfTopLevelReferenced(p)
    },
  })
  return names
}

export function collectKeptStatementPaths(programPath: any, macroStatements: any[]) {
  const bodyPaths: any[] = programPath.get('body')
  const nameToStatementPath = new Map<string, any>()
  for (const statementPath of bodyPaths) {
    const declared = declaredNamesInStatement(statementPath.node)
    for (const name of declared) {
      if (!nameToStatementPath.has(name)) {
        nameToStatementPath.set(name, statementPath)
      }
    }
  }

  const neededNames = new Set<string>()
  for (const statementPath of macroStatements) {
    const callPath = statementPath.get('expression')
    const argPath = callPath.get('arguments.0')
    const deps = collectTopLevelReferencedNames(argPath)
    for (const dep of deps) {
      neededNames.add(dep)
    }
  }

  const keptStatementPaths = new Set<any>()
  const queue = [...neededNames]
  while (queue.length) {
    const name = queue.pop()!
    const declPath = nameToStatementPath.get(name)
    if (!declPath || keptStatementPaths.has(declPath)) {
      continue
    }
    keptStatementPaths.add(declPath)

    const deps = collectTopLevelReferencedNames(declPath)
    for (const dep of deps) {
      if (dep !== name) {
        queue.push(dep)
      }
    }
  }

  for (const statementPath of macroStatements) {
    keptStatementPaths.add(statementPath)
  }

  return { bodyPaths, keptStatementPaths }
}
