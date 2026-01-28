import * as t from '@babel/types'
import { RUNTIME_IMPORT_PATH } from './constants'

export function ensureRuntimeImport(program: t.Program, importedName: string, localName = importedName) {
  let targetImport = program.body.find(
    node => t.isImportDeclaration(node) && node.source.value === RUNTIME_IMPORT_PATH,
  ) as t.ImportDeclaration | undefined

  if (!targetImport) {
    targetImport = t.importDeclaration(
      [t.importSpecifier(t.identifier(localName), t.identifier(importedName))],
      t.stringLiteral(RUNTIME_IMPORT_PATH),
    )
    program.body.unshift(targetImport)
    return
  }

  const hasSpecifier = targetImport.specifiers.some(
    (spec) => {
      if (!t.isImportSpecifier(spec)) {
        return false
      }
      if (!t.isIdentifier(spec.imported, { name: importedName })) {
        return false
      }
      return t.isIdentifier(spec.local, { name: localName })
    },
  )
  if (!hasSpecifier) {
    targetImport.specifiers.push(
      t.importSpecifier(t.identifier(localName), t.identifier(importedName)),
    )
  }
}
