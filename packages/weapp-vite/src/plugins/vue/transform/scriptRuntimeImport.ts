import * as t from '@babel/types'
import { RUNTIME_IMPORT_PATH } from './constants'

export function ensureRuntimeImport(program: t.Program, importedName: string) {
  let targetImport = program.body.find(
    node => t.isImportDeclaration(node) && node.source.value === RUNTIME_IMPORT_PATH,
  ) as t.ImportDeclaration | undefined

  if (!targetImport) {
    targetImport = t.importDeclaration(
      [t.importSpecifier(t.identifier(importedName), t.identifier(importedName))],
      t.stringLiteral(RUNTIME_IMPORT_PATH),
    )
    program.body.unshift(targetImport)
    return
  }

  const hasSpecifier = targetImport.specifiers.some(
    spec => t.isImportSpecifier(spec) && spec.imported.type === 'Identifier' && spec.imported.name === importedName,
  )
  if (!hasSpecifier) {
    targetImport.specifiers.push(
      t.importSpecifier(t.identifier(importedName), t.identifier(importedName)),
    )
  }
}
