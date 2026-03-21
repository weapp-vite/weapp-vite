import * as t from '@weapp-vite/ast/babelTypes'
import fs from 'fs-extra'
import path from 'pathe'
import { generate, parseJsLike, traverse } from '../../../utils'
import { collectFiles } from './shared'

const ALIPAY_EXTENSION_MAP: Record<string, string> = {
  '.wxml': '.axml',
  '.wxss': '.acss',
  '.wxs': '.sjs',
}

const WX_TEMPLATE_REFERENCE_RE = /\.wxml\b|\.wxss\b|\.wxs\b/
const ESM_SYNTAX_RE = /\bimport\s|\bexport\s/
const NULLISH_COALESCING_RE = /\?\?/
const WX_DIRECTIVE_RE = /\bwx:(?:if|elif|else|for|for-item|for-index|key)\b/
const WX_DIRECTIVE_CAPTURE_RE = /\bwx:(if|elif|else|for|for-item|for-index|key)\b/g
const WXS_TAG_RE = /<\s*(?:\/\s*)?wxs\b/
const WXS_CLOSING_TAG_RE = /<\s*\/\s*wxs\b/g
const ELSE_ATTRIBUTE_RE = /\selse(?=[\s/>])/
const IMPORT_SJS_TAG_RE = /<import-sjs([\s\S]*?)>/g
const SRC_ATTRIBUTE_RE = /\bsrc\s*=\s*/g
const MODULE_ATTRIBUTE_RE = /\bmodule\s*=\s*/g
const WXML_EXTENSION_RE = /\.wxml\b/g
const WXSS_EXTENSION_RE = /\.wxss\b/g
const WXS_EXTENSION_RE = /\.wxs\b/g

const ALIPAY_TEXT_FILE_EXTENSIONS = new Set([
  '.js',
  '.json',
  '.axml',
  '.acss',
  '.sjs',
  '.wxml',
  '.wxss',
  '.wxs',
])

function hasEsmSyntax(source: string) {
  return ESM_SYNTAX_RE.test(source)
}

function rewriteAlipayWxmlSyntax(source: string) {
  return source
    .replace(WX_DIRECTIVE_CAPTURE_RE, (_, directive: string) => `a:${directive}`)
    .replace(WXS_CLOSING_TAG_RE, '</import-sjs')
    .replace(WXS_TAG_RE, '<import-sjs')
    .replace(IMPORT_SJS_TAG_RE, (tag) => {
      return tag
        .replace(SRC_ATTRIBUTE_RE, 'from=')
        .replace(MODULE_ATTRIBUTE_RE, 'name=')
    })
    .replace(ELSE_ATTRIBUTE_RE, ' a:else')
}

function rewriteAlipayExtensionReferences(source: string) {
  return source
    .replace(WXML_EXTENSION_RE, '.axml')
    .replace(WXSS_EXTENSION_RE, '.acss')
    .replace(WXS_EXTENSION_RE, '.sjs')
}

function transformWxmlToAxmlForAlipay(source: string) {
  return rewriteAlipayWxmlSyntax(source)
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

async function transformJsModuleToCjsForAlipay(source: string) {
  if (!hasEsmSyntax(source)) {
    return source
  }

  try {
    const ast = parseJsLike(source)
    let transformed = false
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
          path.replaceWith(declaration)
          const names = Object.keys(t.getBindingIdentifiers(declaration))
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
          const requireId = path.scope.generateUidIdentifier('reExported')
          const statements: t.Statement[] = [
            t.variableDeclaration('const', [
              t.variableDeclarator(
                requireId,
                t.callExpression(t.identifier('require'), [t.stringLiteral(path.node.source.value)]),
              ),
            ]),
          ]
          for (const specifier of specifiers) {
            if (!t.isExportSpecifier(specifier)) {
              continue
            }
            const localName = specifier.local.name
            const exportedName = getModuleExportName(specifier.exported)
            statements.push(createExportsAssignment(exportedName, createRequireMemberExpression(requireId, localName)))
          }
          path.replaceWithMultiple(statements)
          transformed = true
          return
        }

        const statements: t.Statement[] = []
        for (const specifier of specifiers) {
          if (!t.isExportSpecifier(specifier)) {
            continue
          }
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

    return generate(ast as any).code
  }
  catch {
    return source
  }
}

export async function shouldRebuildCachedAlipayMiniprogramPackage(
  pkgRoot: string,
  outDir: string,
  sourceRoot?: string,
  alipayNpmDistDirName: 'node_modules' | 'miniprogram_npm' = 'miniprogram_npm',
) {
  if (!(await fs.pathExists(pkgRoot))) {
    return true
  }

  if (sourceRoot && alipayNpmDistDirName === 'node_modules') {
    const sourceEsRoot = path.resolve(sourceRoot, 'es')
    const targetEsRoot = path.resolve(pkgRoot, 'es')
    if (await fs.pathExists(sourceEsRoot) && !(await fs.pathExists(targetEsRoot))) {
      return true
    }
  }

  const files = await collectFiles(pkgRoot)
  for (const filePath of files) {
    const ext = path.extname(filePath)
    if (ext === '.wxml' || ext === '.wxss' || ext === '.wxs') {
      return true
    }

    if (!ALIPAY_TEXT_FILE_EXTENSIONS.has(ext)) {
      continue
    }

    let source = ''
    try {
      source = await fs.readFile(filePath, 'utf8')
    }
    catch {
      continue
    }

    if (WX_TEMPLATE_REFERENCE_RE.test(source)) {
      return true
    }

    if (ext === '.js' && (ESM_SYNTAX_RE.test(source) || NULLISH_COALESCING_RE.test(source))) {
      return true
    }

    if ((ext === '.axml' || ext === '.wxml') && (WX_DIRECTIVE_RE.test(source) || WXS_TAG_RE.test(source) || ELSE_ATTRIBUTE_RE.test(source))) {
      return true
    }
  }

  const nestedRoot = path.resolve(pkgRoot, 'miniprogram_npm')
  if (!(await fs.pathExists(nestedRoot))) {
    return false
  }

  const entries = await fs.readdir(nestedRoot)
  for (const name of entries) {
    const target = path.resolve(outDir, name)
    if (!(await fs.pathExists(target))) {
      return true
    }
  }

  return false
}

export async function normalizeMiniprogramPackageForAlipay(pkgRoot: string) {
  if (!(await fs.pathExists(pkgRoot))) {
    return
  }

  const initialFiles = await collectFiles(pkgRoot)
  const renameTasks = initialFiles
    .map((filePath) => {
      const ext = path.extname(filePath)
      const nextExt = ALIPAY_EXTENSION_MAP[ext]
      if (!nextExt) {
        return null
      }
      return {
        from: filePath,
        to: `${filePath.slice(0, -ext.length)}${nextExt}`,
      }
    })
    .filter((item): item is { from: string, to: string } => item !== null)

  for (const task of renameTasks) {
    if (task.from === task.to) {
      continue
    }
    await fs.move(task.from, task.to, { overwrite: true })
  }

  const normalizedFiles = await collectFiles(pkgRoot)
  for (const filePath of normalizedFiles) {
    const ext = path.extname(filePath)
    if (!ALIPAY_TEXT_FILE_EXTENSIONS.has(ext)) {
      continue
    }

    const source = await fs.readFile(filePath, 'utf8')
    let nextSource = source

    if (ext === '.js') {
      nextSource = await transformJsModuleToCjsForAlipay(nextSource)
    }

    if (ext === '.axml' || ext === '.wxml') {
      nextSource = transformWxmlToAxmlForAlipay(nextSource)
    }

    nextSource = rewriteAlipayExtensionReferences(nextSource)

    if (nextSource !== source) {
      await fs.writeFile(filePath, nextSource)
    }
  }
}

export async function hoistNestedMiniprogramDependenciesForAlipay(pkgRoot: string, outDir: string) {
  const nestedRoot = path.resolve(pkgRoot, 'miniprogram_npm')
  if (!(await fs.pathExists(nestedRoot))) {
    return
  }

  const entries = await fs.readdir(nestedRoot)
  for (const name of entries) {
    const source = path.resolve(nestedRoot, name)
    const target = path.resolve(outDir, name)

    if (await fs.pathExists(target)) {
      continue
    }

    await fs.copy(source, target, {
      overwrite: false,
      errorOnExist: false,
    })

    await normalizeMiniprogramPackageForAlipay(target)
  }
}

export async function copyEsModuleDirectoryForAlipay(sourceRoot: string, targetRoot: string) {
  const sourceDir = path.resolve(sourceRoot, 'es')
  if (!(await fs.pathExists(sourceDir))) {
    return false
  }

  await fs.copy(sourceDir, path.resolve(targetRoot, 'es'), {
    overwrite: true,
  })
  return true
}
