import type { Statement } from '@babel/types'
import { createHash } from 'node:crypto'
import * as t from '@babel/types'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import { recursive as mergeRecursive } from 'merge'
import path from 'pathe'
import { bundleRequire } from 'rolldown-require'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, parseJsLike, traverse } from '../../../utils/babel'
import { withTempDirLock } from './tempDirLock'
import { rewriteRelativeImportSource } from './tempImportRewrite'
import { resolveWevuConfigTempDir } from './wevuTempDir'

const JSON_MACROS = new Set(['defineAppJson', 'definePageJson', 'defineComponentJson'])

function normalizeScriptSetupLang(lang?: string) {
  if (!lang) {
    return 'ts'
  }
  const lower = lang.toLowerCase()
  if (lower === 'txt') {
    return 'ts'
  }
  return lower
}

function resolveScriptSetupExtension(lang?: string) {
  const normalized = normalizeScriptSetupLang(lang)
  if (normalized === 'ts' || normalized === 'tsx' || normalized === 'cts' || normalized === 'mts') {
    return 'ts'
  }
  return 'js'
}

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
  path.traverse({
    Identifier(p: any) {
      if (!p.isReferencedIdentifier()) {
        return
      }
      const name = p.node.name
      const binding = p.scope.getBinding(name)
      if (!binding) {
        return
      }
      if (binding.scope?.block?.type === 'Program') {
        names.add(name)
      }
    },
  })
  return names
}

async function evaluateScriptSetupJsonMacro(
  originalContent: string,
  filename: string,
  lang?: string,
): Promise<Record<string, any> | undefined> {
  let ast: any
  try {
    ast = babelParse(originalContent, BABEL_TS_MODULE_PARSER_OPTIONS)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse <script setup> in ${filename}: ${message}`)
  }

  let macroName: string | undefined
  const macroStatements: any[] = []

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (!t.isIdentifier(callee)) {
        return
      }
      if (!JSON_MACROS.has(callee.name)) {
        return
      }
      const isTopLevelStatement = path.parentPath?.isExpressionStatement() && path.parentPath.parentPath?.isProgram()
      if (!isTopLevelStatement) {
        throw new Error(`${callee.name}() must be used as a top-level statement in <script setup> (${filename})`)
      }
      macroName = macroName ?? callee.name
      if (macroName !== callee.name) {
        throw new Error(`Only one of ${Array.from(JSON_MACROS).join(', ')} can be used in a single <script setup> (${filename})`)
      }
      macroStatements.push(path.parentPath)
    },
  })

  if (!macroStatements.length) {
    return undefined
  }

  let programPath: any
  traverse(ast, {
    Program(path) {
      programPath = path
      path.stop()
    },
  })
  if (!programPath) {
    return undefined
  }

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

  const ms = new MagicString(originalContent)

  const dir = path.dirname(filename)
  const tempDir = resolveWevuConfigTempDir(dir)

  for (const statementPath of keptStatementPaths) {
    if (!statementPath.isImportDeclaration()) {
      continue
    }
    const sourceNode = statementPath.node.source
    if (!sourceNode || !t.isStringLiteral(sourceNode)) {
      continue
    }
    const originalSource = sourceNode.value
    if (!originalSource.startsWith('.')) {
      continue
    }
    const next = rewriteRelativeImportSource(originalSource, dir, tempDir)
    if (typeof sourceNode.start === 'number' && typeof sourceNode.end === 'number') {
      ms.overwrite(sourceNode.start, sourceNode.end, JSON.stringify(next))
    }
  }

  const alias = macroName === 'defineAppJson'
    ? '__weapp_defineAppJson'
    : macroName === 'definePageJson'
      ? '__weapp_definePageJson'
      : '__weapp_defineComponentJson'

  for (const statementPath of macroStatements) {
    const callPath = statementPath.get('expression')
    const calleePath = callPath.get('callee')
    if (calleePath?.isIdentifier() && typeof calleePath.node.start === 'number' && typeof calleePath.node.end === 'number') {
      ms.overwrite(calleePath.node.start, calleePath.node.end, alias)
    }
  }

  for (const statementPath of bodyPaths) {
    if (keptStatementPaths.has(statementPath)) {
      continue
    }
    const start = statementPath.node.start
    const end = statementPath.node.end
    if (typeof start === 'number' && typeof end === 'number') {
      ms.remove(start, end)
    }
  }

  const header = `
const __weapp_json_macro_values = []
const __weapp_defineAppJson = (config) => (__weapp_json_macro_values.push(config), config)
const __weapp_definePageJson = (config) => (__weapp_json_macro_values.push(config), config)
const __weapp_defineComponentJson = (config) => (__weapp_json_macro_values.push(config), config)
`.trimStart()
  const footer = `\nexport default __weapp_json_macro_values\n`
  const evalSource = header + ms.toString() + footer

  const extension = resolveScriptSetupExtension(lang)
  return await withTempDirLock(tempDir, async () => {
    await fs.ensureDir(tempDir)
    const basename = path.basename(filename, path.extname(filename))
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const tempFile = path.join(tempDir, `${basename}.json-macro.${unique}.${extension}`)
    await fs.writeFile(tempFile, evalSource, 'utf8')

    try {
      const { mod } = await bundleRequire<{ default?: any }>({
        filepath: tempFile,
        cwd: dir,
      })

      const resolved: any = mod?.default ?? mod
      const values: any[] = Array.isArray(resolved) ? resolved : [resolved]

      const accumulator: Record<string, any> = {}
      for (const raw of values) {
        if (raw === undefined) {
          continue
        }
        let next: any = raw
        if (typeof next === 'function') {
          next = next()
        }
        if (next && typeof next.then === 'function') {
          next = await next
        }
        if (!next || typeof next !== 'object' || Array.isArray(next)) {
          throw new Error('Macro value must resolve to an object')
        }
        if (Object.prototype.hasOwnProperty.call(next, '$schema')) {
          delete next.$schema
        }
        mergeRecursive(accumulator, next)
      }

      if (!Object.keys(accumulator).length) {
        return undefined
      }
      return accumulator
    }
    finally {
      try {
        await fs.remove(tempFile)
      }
      catch {
        // ignore
      }
      try {
        const remains = await fs.readdir(tempDir)
        if (remains.length === 0) {
          await fs.remove(tempDir)
        }
      }
      catch {
        // ignore
      }
    }
  })
}

export async function extractJsonMacroFromScriptSetup(
  content: string,
  filename: string,
  lang?: string,
): Promise<{ stripped: string, config?: Record<string, any>, macroHash?: string }> {
  let ast: any
  try {
    ast = babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse <script setup> in ${filename}: ${message}`)
  }

  const ms = new MagicString(content)
  const macroNames = new Set<string>()
  const macroStatementSources: string[] = []

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (!t.isIdentifier(callee)) {
        return
      }
      if (!JSON_MACROS.has(callee.name)) {
        return
      }

      const isTopLevelStatement = path.parentPath?.isExpressionStatement() && path.parentPath.parentPath?.isProgram()
      if (!isTopLevelStatement) {
        throw new Error(`${callee.name}() must be used as a top-level statement in <script setup> (${filename})`)
      }

      macroNames.add(callee.name)
    },
  })

  if (macroNames.size > 1) {
    throw new Error(`Only one of ${Array.from(JSON_MACROS).join(', ')} can be used in a single <script setup> (${filename})`)
  }

  const body: Statement[] = ast.program?.body ?? []
  for (const statement of body) {
    if (!t.isExpressionStatement(statement)) {
      continue
    }
    const expr = statement.expression
    if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) {
      continue
    }
    const name = expr.callee.name
    if (!JSON_MACROS.has(name)) {
      continue
    }
    if (expr.arguments.length !== 1) {
      throw new Error(`${name}() in ${filename} expects exactly 1 argument`)
    }

    if (typeof statement.start === 'number' && typeof statement.end === 'number') {
      macroStatementSources.push(content.slice(statement.start, statement.end))
    }

    if (typeof statement.start === 'number' && typeof statement.end === 'number') {
      ms.remove(statement.start, statement.end)
    }
  }

  const stripped = ms.toString()
  if (macroNames.size === 0) {
    return { stripped }
  }

  const macroHash = createHash('sha256')
    .update(macroStatementSources.join('\n'))
    .digest('hex')
    .slice(0, 12)

  const config = await evaluateScriptSetupJsonMacro(content, filename, lang)
  return config ? { stripped, config, macroHash } : { stripped, macroHash }
}

export function stripJsonMacroCallsFromCode(code: string, filename: string) {
  let ast: any
  try {
    ast = babelParse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
  }
  catch (error) {
    try {
      ast = parseJsLike(code)
    }
    catch (fallbackError) {
      const message = error instanceof Error ? error.message : String(error)
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      throw new Error(
        `Failed to parse compiled script in ${filename}: ${message}; fallback parse error: ${fallbackMessage}`,
      )
    }
  }

  const ms = new MagicString(code)

  traverse(ast, {
    ExpressionStatement(path) {
      const expr = path.node.expression
      if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) {
        return
      }
      if (!JSON_MACROS.has(expr.callee.name)) {
        return
      }

      const start = path.node.start
      const end = path.node.end
      if (typeof start === 'number' && typeof end === 'number') {
        ms.remove(start, end)
      }
    },
  })

  return ms.toString()
}
