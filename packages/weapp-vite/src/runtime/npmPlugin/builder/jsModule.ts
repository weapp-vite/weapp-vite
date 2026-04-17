import { fs } from '@weapp-core/shared/fs'
import * as t from '@weapp-vite/ast/babelTypes'
import path from 'pathe'
import { generate, parseJsLike, traverse } from '../../../utils'
import { collectFiles } from './shared'

const ESM_SYNTAX_RE = /\bimport\s|\bexport\s/

function hasEsmSyntax(source: string) {
  return ESM_SYNTAX_RE.test(source)
}

function createExportsMember(name: string) {
  return t.memberExpression(
    t.identifier('exports'),
    t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name),
    !t.isValidIdentifier(name),
  )
}

function createExportsAssignment(name: string, value: t.Expression) {
  return t.expressionStatement(
    t.assignmentExpression(
      '=',
      createExportsMember(name),
      value,
    ),
  )
}

function createRequireMemberExpression(base: t.Identifier, name: string) {
  return t.memberExpression(
    base,
    t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name),
    !t.isValidIdentifier(name),
  )
}

function getModuleExportName(name: t.Identifier | t.StringLiteral) {
  return t.isIdentifier(name) ? name.name : name.value
}

function getExportedDeclarationNames(declaration: t.Declaration) {
  if (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) {
    return declaration.id ? [declaration.id.name] : []
  }

  if (t.isVariableDeclaration(declaration)) {
    return declaration.declarations.flatMap(item => Object.keys(t.getBindingIdentifiers(item.id)))
  }

  return Object.keys(t.getBindingIdentifiers(declaration))
}

function createEsModuleMarker() {
  return t.expressionStatement(
    t.callExpression(
      t.memberExpression(
        t.identifier('Object'),
        t.identifier('defineProperty'),
      ),
      [
        t.identifier('exports'),
        t.stringLiteral('__esModule'),
        t.objectExpression([
          t.objectProperty(
            t.identifier('value'),
            t.booleanLiteral(true),
          ),
        ]),
      ],
    ),
  )
}

export async function transformJsModuleToCjs(
  source: string,
  options?: {
    markEsModule?: boolean
  },
) {
  if (!hasEsmSyntax(source)) {
    return source
  }

  try {
    const ast = parseJsLike(source)
    let transformed = false
    let hasConvertedExport = false
    const exportAssignments: t.Statement[] = []

    traverse(ast as any, {
      ImportDeclaration(path: any) {
        const sourceLiteral = t.stringLiteral(path.node.source.value)
        const specifiers = path.node.specifiers ?? []
        if (specifiers.length === 0) {
          path.replaceWith(
            t.expressionStatement(
              t.callExpression(t.identifier('require'), [sourceLiteral]),
            ),
          )
          transformed = true
          return
        }

        const requireId = path.scope.generateUidIdentifier('imported')
        const statements: t.Statement[] = [
          t.variableDeclaration('const', [
            t.variableDeclarator(
              requireId,
              t.callExpression(t.identifier('require'), [sourceLiteral]),
            ),
          ]),
        ]

        for (const specifier of specifiers) {
          if (t.isImportDefaultSpecifier(specifier)) {
            statements.push(
              t.variableDeclaration('const', [
                t.variableDeclarator(
                  specifier.local,
                  t.conditionalExpression(
                    t.binaryExpression(
                      '!==',
                      createRequireMemberExpression(requireId, 'default'),
                      t.identifier('undefined'),
                    ),
                    createRequireMemberExpression(requireId, 'default'),
                    requireId,
                  ),
                ),
              ]),
            )
            continue
          }

          if (t.isImportNamespaceSpecifier(specifier)) {
            statements.push(
              t.variableDeclaration('const', [
                t.variableDeclarator(specifier.local, requireId),
              ]),
            )
            continue
          }

          const importedName = t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value
          statements.push(
            t.variableDeclaration('const', [
              t.variableDeclarator(
                specifier.local,
                createRequireMemberExpression(requireId, importedName),
              ),
            ]),
          )
        }

        path.replaceWithMultiple(statements)
        transformed = true
      },

      ExportDefaultDeclaration(path: any) {
        const declaration = path.node.declaration
        hasConvertedExport = true

        if (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) {
          const exportId = declaration.id ?? path.scope.generateUidIdentifier('defaultExport')
          if (!declaration.id) {
            declaration.id = exportId
          }
          path.replaceWith(declaration)
          exportAssignments.push(createExportsAssignment('default', exportId))
          transformed = true
          return
        }

        const targetId = path.scope.generateUidIdentifier('defaultExport')
        path.replaceWith(
          t.variableDeclaration('const', [
            t.variableDeclarator(targetId, declaration),
          ]),
        )
        exportAssignments.push(createExportsAssignment('default', targetId))
        transformed = true
      },

      ExportNamedDeclaration(path: any) {
        const declaration = path.node.declaration
        if (declaration) {
          hasConvertedExport = true
          path.replaceWith(declaration)
          const names = getExportedDeclarationNames(declaration)
          for (const name of names) {
            exportAssignments.push(createExportsAssignment(name, t.identifier(name)))
          }
          transformed = true
          return
        }

        const specifiers = path.node.specifiers ?? []
        if (specifiers.length === 0) {
          path.remove()
          transformed = true
          return
        }

        if (path.node.source) {
          hasConvertedExport = true
          const requireId = path.scope.generateUidIdentifier('reExported')
          const exportSpecifiers = specifiers.filter(t.isExportSpecifier)
          const statements: t.Statement[] = [
            t.variableDeclaration('const', [
              t.variableDeclarator(
                requireId,
                t.callExpression(t.identifier('require'), [t.stringLiteral(path.node.source.value)]),
              ),
            ]),
          ]
          for (const specifier of exportSpecifiers) {
            const localName = specifier.local.name
            const exportedName = getModuleExportName(specifier.exported)
            statements.push(createExportsAssignment(exportedName, createRequireMemberExpression(requireId, localName)))
          }
          path.replaceWithMultiple(statements)
          transformed = true
          return
        }

        const exportSpecifiers = specifiers.filter(t.isExportSpecifier)
        if (exportSpecifiers.length > 0) {
          hasConvertedExport = true
        }
        const statements: t.Statement[] = []
        for (const specifier of exportSpecifiers) {
          const localName = specifier.local.name
          const exportedName = getModuleExportName(specifier.exported)
          statements.push(createExportsAssignment(exportedName, t.identifier(localName)))
        }

        path.replaceWithMultiple(statements)
        transformed = true
      },
    })

    if (exportAssignments.length > 0) {
      ast.program.body.push(...exportAssignments)
      transformed = true
    }

    if (!transformed) {
      return source
    }

    if (options?.markEsModule && hasConvertedExport) {
      ast.program.body.unshift(createEsModuleMarker())
    }

    return generate(ast as any).code
  }
  catch {
    return source
  }
}

export async function normalizeMiniprogramPackageJsModules(
  pkgRoot: string,
  options?: {
    markEsModule?: boolean
  },
) {
  if (!(await fs.pathExists(pkgRoot))) {
    return
  }

  const files = await collectFiles(pkgRoot)
  for (const filePath of files) {
    if (path.extname(filePath) !== '.js') {
      continue
    }

    let source = ''
    try {
      source = await fs.readFile(filePath, 'utf8')
    }
    catch {
      continue
    }

    const nextSource = await transformJsModuleToCjs(source, options)
    if (nextSource !== source) {
      await fs.writeFile(filePath, nextSource)
    }
  }
}
