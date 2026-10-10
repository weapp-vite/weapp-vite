import { readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { REQUEST_GLOBAL_BUNDLE_MARKER } from '@weapp-core/constants'
import ts from 'typescript'

const INSTALLER_EXPORT = 'installWebRuntimeGlobals'

function sourceFile(code: string) {
  return ts.createSourceFile('chunk.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
}

function propertyName(node: ts.PropertyName | undefined) {
  return node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : undefined
}

/** 检查真实的本地函数导出，排除注释、被动绑定及仅提到安装器名称的 chunk。 */
function exportsInstaller(source: ts.SourceFile) {
  const functions = new Set<string>()
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      functions.add(statement.name.text)
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer
          && (ts.isFunctionExpression(declaration.initializer) || ts.isArrowFunction(declaration.initializer))) {
          functions.add(declaration.name.text)
        }
      }
    }
  }

  return source.statements.some((statement) => {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === INSTALLER_EXPORT && statement.body) {
      return statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
    }
    if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier
      && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      return statement.exportClause.elements.some(element => element.name.text === INSTALLER_EXPORT
        && functions.has((element.propertyName ?? element.name).text))
    }
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
      return false
    }
    const call = statement.expression
    const [target, name, descriptor] = call.arguments
    if (!ts.isPropertyAccessExpression(call.expression)
      || !ts.isIdentifier(call.expression.expression) || call.expression.expression.text !== 'Object'
      || call.expression.name.text !== 'defineProperty'
      || !target || !ts.isIdentifier(target) || target.text !== 'exports'
      || !name || !ts.isStringLiteral(name) || name.text !== INSTALLER_EXPORT
      || !descriptor || !ts.isObjectLiteralExpression(descriptor)) {
      return false
    }
    return descriptor.properties.some((property) => {
      if (!ts.isPropertyAssignment(property)) {
        return false
      }
      if (propertyName(property.name) === 'value' && ts.isIdentifier(property.initializer)) {
        return functions.has(property.initializer.text)
      }
      if (propertyName(property.name) !== 'get' || !ts.isFunctionExpression(property.initializer)) {
        return false
      }
      const statements = property.initializer.body.statements
      return statements.length === 1 && ts.isReturnStatement(statements[0]!)
        && !!statements[0].expression && ts.isIdentifier(statements[0].expression)
        && functions.has(statements[0].expression.text)
    })
  })
}

function assertContained(root: string, target: string) {
  const relative = path.relative(root, target)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Module reference escapes fixture dist: ${target}`)
  }
}

async function containedRealPath(root: string, target: string) {
  assertContained(root, target)
  const resolved = await realpath(target)
  assertContained(root, resolved)
  return resolved
}

/** 仅在主包及其 vendor 目录寻找唯一的公开安装器，不纳入独立分包。 */
export async function resolveRequestGlobalsInstaller(distRoot: string) {
  const root = await realpath(distRoot)
  const candidates: { path: string, code: string }[] = []
  for (const directory of [root, path.join(root, 'weapp-vendors')]) {
    let entries: string[]
    try {
      entries = await readdir(await containedRealPath(root, directory))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && directory !== root) {
        continue
      }
      throw error
    }
    for (const entry of entries.sort()) {
      if (!entry.endsWith('.js')) {
        continue
      }
      const filePath = await containedRealPath(root, path.join(directory, entry))
      const code = await readFile(filePath, 'utf8')
      const hasMarker = ts.getLeadingCommentRanges(code, 0)?.some(comment => code.slice(comment.pos, comment.end).includes(REQUEST_GLOBAL_BUNDLE_MARKER))
      if (hasMarker && exportsInstaller(sourceFile(code))) {
        candidates.push({ path: filePath, code })
      }
    }
  }
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one exported request globals installer; found ${candidates.length}: ${candidates.map(candidate => candidate.path).join(', ')}`)
  }
  return candidates[0]!
}

/** 从实际 AST 读取相对引用并核对磁盘身份，禁止路径或符号链接逃出 fixture。 */
export async function resolveRelativeModuleReferences(distRoot: string, importer: string, code: string) {
  const root = await realpath(distRoot)
  const importerPath = await containedRealPath(root, importer)
  const specifiers = new Set<string>()
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.add(node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'
      && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]!)) {
      specifiers.add(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile(code))
  const references: string[] = []
  for (const specifier of specifiers) {
    if (path.isAbsolute(specifier)) {
      throw new Error(`Expected a relative fixture module reference: ${specifier}`)
    }
    if (specifier.startsWith('.')) {
      references.push(await containedRealPath(root, path.resolve(path.dirname(importerPath), specifier)))
    }
  }
  return references
}

export function requestGlobalsAppModuleExpression(distRoot: string, installerPath: string) {
  assertContained(path.resolve(distRoot), installerPath)
  const relative = path.relative(distRoot, installerPath).replaceAll('\\', '/')
  return `globalThis[${JSON.stringify(`__weappViteRequestGlobalsModule:${relative}`)}]`
}
