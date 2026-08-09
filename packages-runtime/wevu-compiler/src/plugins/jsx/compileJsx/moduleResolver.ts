import type { File } from '@weapp-vite/ast/babelTypes'
import type { JsxModuleExport, JsxModuleResolver } from './types'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse } from '../../../utils/babel'

const EXTENSIONS = ['', '.tsx', '.jsx', '.ts', '.js'] as const

function resolveFile(source: string, importer: string) {
  if (!source.startsWith('.')) {
    return undefined
  }
  const base = path.resolve(path.dirname(importer), source)
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`
    try {
      if (readFileSync(candidate, 'utf8') !== undefined) {
        return candidate
      }
    }
    catch {
      continue
    }
  }
  for (const extension of EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`)
    try {
      if (readFileSync(candidate, 'utf8') !== undefined) {
        return candidate
      }
    }
    catch {
      continue
    }
  }
  return undefined
}

function expressionFromDeclaration(node: t.Declaration | t.Expression | null): JsxModuleExport | undefined {
  if (!node) {
    return undefined
  }
  if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    return { expression: node, params: [] }
  }
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    const body = t.isBlockStatement(node.body)
      ? node.body.body.find(statement => t.isReturnStatement(statement) && !!statement.argument)?.argument
      : node.body
    if (body && (t.isJSXElement(body) || t.isJSXFragment(body))) {
      return {
        expression: body,
        params: node.params.filter(t.isIdentifier).map(param => param.name),
      }
    }
  }
  if (t.isFunctionDeclaration(node)) {
    const body = node.body.body.find(statement => t.isReturnStatement(statement) && !!statement.argument)
    if (body?.argument && (t.isJSXElement(body.argument) || t.isJSXFragment(body.argument))) {
      return {
        expression: body.argument,
        params: node.params.filter(t.isIdentifier).map(param => param.name),
      }
    }
  }
  return undefined
}

function collectExports(ast: File) {
  const locals = new Map<string, t.Declaration | t.Expression>()
  const exports = new Map<string, string>()
  const reexports = new Map<string, { source: string, importedName: string }>()
  for (const statement of ast.program.body) {
    if (t.isVariableDeclaration(statement)) {
      for (const declaration of statement.declarations) {
        if (t.isIdentifier(declaration.id) && declaration.init && t.isExpression(declaration.init)) {
          locals.set(declaration.id.name, declaration.init)
        }
      }
    }
    if (t.isFunctionDeclaration(statement) && statement.id) {
      locals.set(statement.id.name, statement)
    }
    if (t.isExportNamedDeclaration(statement)) {
      if (statement.declaration) {
        if (t.isVariableDeclaration(statement.declaration)) {
          for (const declaration of statement.declaration.declarations) {
            if (t.isIdentifier(declaration.id) && declaration.init && t.isExpression(declaration.init)) {
              locals.set(declaration.id.name, declaration.init)
              exports.set(declaration.id.name, declaration.id.name)
            }
          }
        }
        if (t.isFunctionDeclaration(statement.declaration) && statement.declaration.id) {
          locals.set(statement.declaration.id.name, statement.declaration)
          exports.set(statement.declaration.id.name, statement.declaration.id.name)
        }
      }
      for (const specifier of statement.specifiers) {
        if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.local) && t.isIdentifier(specifier.exported)) {
          exports.set(specifier.exported.name, specifier.local.name)
          if (statement.source) {
            reexports.set(specifier.exported.name, {
              source: statement.source.value,
              importedName: specifier.local.name,
            })
          }
        }
      }
    }
    if (t.isExportDefaultDeclaration(statement) && statement.declaration) {
      if (t.isFunctionDeclaration(statement.declaration) && statement.declaration.id) {
        locals.set('default', statement.declaration)
      }
      else if (t.isExpression(statement.declaration)) {
        locals.set('default', statement.declaration)
      }
    }
  }
  return { locals, exports, reexports }
}

export function createJsxModuleResolver(warn?: (message: string) => void): JsxModuleResolver {
  const cache = new Map<string, { code: string, exports: ReturnType<typeof collectExports> }>()
  const active = new Set<string>()

  function read(filename: string) {
    const code = readFileSync(filename, 'utf8')
    const cached = cache.get(filename)
    if (cached?.code === code) {
      return cached.exports
    }
    const ast = parse(code, BABEL_TS_MODULE_PARSER_OPTIONS) as File
    const collected = collectExports(ast)
    cache.set(filename, { code, exports: collected })
    return collected
  }

  function resolveExport(filename: string, localName: string): JsxModuleExport | undefined {
    if (active.has(filename)) {
      warn?.(`[JSX 编译] 检测到跨文件 JSX 循环引用：${filename}`)
      return undefined
    }
    active.add(filename)
    try {
      const { locals, reexports } = read(filename)
      const direct = expressionFromDeclaration(locals.get(localName) ?? null)
      if (direct) {
        return direct
      }
      const forwarded = reexports.get(localName)
      if (!forwarded) {
        return undefined
      }
      const target = resolveFile(forwarded.source, filename)
      return target ? resolveExport(target, forwarded.importedName) : undefined
    }
    finally {
      active.delete(filename)
    }
  }

  function resolveImport(filename: string, source: string, importedName: string) {
    const target = resolveFile(source, filename)
    if (!target) {
      return undefined
    }
    return resolveExport(target, importedName === 'default' ? 'default' : importedName)
  }

  return { resolveExport, resolveImport }
}
