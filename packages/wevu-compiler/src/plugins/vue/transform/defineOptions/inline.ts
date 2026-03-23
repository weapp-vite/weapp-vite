import vm from 'node:vm'
import * as t from '@weapp-vite/ast/babelTypes'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { bundleRequire } from 'rolldown-require'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'
import { collectKeptStatementPaths } from '../jsonMacros/analyze'
import { withTempDirLock } from '../tempDirLock'
import { rewriteRelativeImportSource } from '../tempImportRewrite'
import { resolveWevuConfigTempDir } from '../wevuTempDir'
import {
  resolveScriptSetupExtension,
  serializeStaticValueToExpression,
  shouldFallbackToRawDefineOptions,
} from './serialize'

interface DefineOptionsStatement {
  statementPath: any
  callPath: any
  argPath: any
}

interface EvaluateDefineOptionsResult {
  values: unknown[]
  dependencies: string[]
  scopeValues: Record<string, unknown>
}

function collectDefineOptionsStatements(content: string, filename: string) {
  const ast = babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS)
  const statements: DefineOptionsStatement[] = []

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (!t.isIdentifier(callee, { name: 'defineOptions' })) {
        return
      }
      const isTopLevelStatement = path.parentPath?.isExpressionStatement() && path.parentPath.parentPath?.isProgram()
      if (!isTopLevelStatement) {
        return
      }
      if (path.node.arguments.length !== 1) {
        throw new Error(`defineOptions() 在 ${filename} 中必须且只能传 1 个参数。`)
      }
      statements.push({
        statementPath: path.parentPath,
        callPath: path,
        argPath: path.get('arguments.0'),
      })
    },
  })

  return { statements }
}

function evaluateStaticExpression(source: string) {
  return vm.runInNewContext(`(${source})`, {})
}

function collectStaticTopLevelScopeValues(content: string) {
  const ast = babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS)
  const scopeValues: Record<string, unknown> = {}

  for (const statement of ast.program.body) {
    if (!t.isVariableDeclaration(statement) || statement.kind !== 'const') {
      continue
    }
    for (const declarator of statement.declarations) {
      if (!t.isIdentifier(declarator.id) || !declarator.init) {
        continue
      }
      try {
        scopeValues[declarator.id.name] = evaluateStaticExpression(declarator.init.end != null && declarator.init.start != null
          ? content.slice(declarator.init.start, declarator.init.end)
          : '')
      }
      catch {
        // ignore non-static top-level constants
      }
    }
  }

  return scopeValues
}

function collectKeptBindingNames(keptStatementPaths: Set<any>) {
  const names = new Set<string>()

  for (const statementPath of keptStatementPaths) {
    if (statementPath.isImportDeclaration()) {
      if (statementPath.node.importKind === 'type') {
        continue
      }
      for (const specifier of statementPath.get('specifiers')) {
        if (specifier.isImportSpecifier() || specifier.isImportDefaultSpecifier() || specifier.isImportNamespaceSpecifier()) {
          if (specifier.isImportSpecifier() && specifier.node.importKind === 'type') {
            continue
          }
          const local = specifier.node.local
          if (t.isIdentifier(local)) {
            names.add(local.name)
          }
        }
      }
      continue
    }

    if (statementPath.isVariableDeclaration()) {
      for (const declarator of statementPath.get('declarations')) {
        const id = declarator.get('id')
        if (id.isIdentifier()) {
          names.add(id.node.name)
        }
      }
      continue
    }

    if (statementPath.isFunctionDeclaration() || statementPath.isClassDeclaration()) {
      const id = statementPath.node.id
      if (t.isIdentifier(id)) {
        names.add(id.name)
      }
    }
  }

  return [...names]
}

async function evaluateDefineOptionsValues(params: {
  content: string
  filename: string
  lang?: string
  statements: DefineOptionsStatement[]
}): Promise<EvaluateDefineOptionsResult> {
  const { content, filename, lang, statements } = params
  const ms = new MagicString(content)
  const dir = path.dirname(filename)
  const tempRoot = resolveWevuConfigTempDir(dir)
  const basename = path.basename(filename, path.extname(filename))
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const tempDir = path.join(tempRoot, `${basename}.define-options.${unique}`)
  const programPath = statements[0]?.statementPath.parentPath
  if (!programPath) {
    return {
      values: [],
      dependencies: [],
      scopeValues: {},
    }
  }
  const bodyPaths = programPath?.get('body') ?? []
  const macroStatementPaths = statements.map(item => item.statementPath)

  const { keptStatementPaths } = collectKeptStatementPaths(programPath, macroStatementPaths)
  const keptBindingNames = collectKeptBindingNames(keptStatementPaths)

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

  for (const statementPath of macroStatementPaths) {
    const callPath = statementPath.get('expression')
    const calleePath = callPath.get('callee')
    if (calleePath?.isIdentifier() && typeof calleePath.node.start === 'number' && typeof calleePath.node.end === 'number') {
      ms.overwrite(calleePath.node.start, calleePath.node.end, '__weapp_defineOptions')
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

  const extension = resolveScriptSetupExtension(lang)
  const header = `
const __weapp_define_options_values = []
const __weapp_define_scope_values = {}
const __weapp_defineOptions = (value) => (__weapp_define_options_values.push(value), value)
`.trimStart()
  const scopeFooter = keptBindingNames
    .map(name => `__weapp_define_scope_values[${JSON.stringify(name)}] = ${name}`)
    .join('\n')
  const footer = '\nexport const __weapp_define_options = __weapp_define_options_values\n'
  const evalSource = `${header
    + ms.toString()
    + (scopeFooter ? `\n${scopeFooter}\n` : '\n')
  }export const __weapp_define_scope = __weapp_define_scope_values\n${
    footer}`

  return await withTempDirLock(tempRoot, async () => {
    await fs.ensureDir(tempDir)
    const tempFile = path.join(tempDir, `${basename}.define-options.${unique}.${extension}`)
    await fs.writeFile(tempFile, evalSource, 'utf8')
    try {
      const { mod, dependencies } = await bundleRequire<{ __weapp_define_options?: unknown[], __weapp_define_scope?: Record<string, unknown> }>({
        filepath: tempFile,
        cwd: dir,
      })
      const exported = mod?.__weapp_define_options ?? mod
      const values = Array.isArray(exported) ? exported : [exported]
      return {
        values,
        dependencies,
        scopeValues: mod?.__weapp_define_scope ?? {},
      }
    }
    finally {
      try {
        await fs.remove(tempDir)
      }
      catch {
        // ignore
      }
    }
  })
}

async function resolveDefineOptionsValue(raw: unknown) {
  let next = raw

  if (typeof next === 'function') {
    next = next()
  }
  if (next && typeof (next as PromiseLike<unknown>).then === 'function') {
    next = await next
  }
  if (!next || typeof next !== 'object' || Array.isArray(next)) {
    throw new Error('defineOptions 的参数最终必须解析为对象。')
  }

  return next
}

/**
 * 将 defineOptions 的参数内联为静态字面量，允许参数引用局部变量或导入值。
 */
export async function inlineScriptSetupDefineOptionsArgs(
  content: string,
  filename: string,
  lang?: string,
) {
  const { statements } = collectDefineOptionsStatements(content, filename)
  if (!statements.length) {
    return {
      code: content,
      dependencies: [],
    }
  }

  let values: unknown[] = []
  let dependencies: string[] = []
  let scopeValues: Record<string, unknown> = collectStaticTopLevelScopeValues(content)
  try {
    const evaluated = await evaluateDefineOptionsValues({
      content,
      filename,
      lang,
      statements,
    })
    values = evaluated.values
    dependencies = evaluated.dependencies
    scopeValues = {
      ...scopeValues,
      ...evaluated.scopeValues,
    }
  }
  catch (error) {
    if (shouldFallbackToRawDefineOptions(error)) {
      return {
        code: content,
        dependencies: [],
      }
    }
    throw error
  }

  const ms = new MagicString(content)
  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index]
    const argNode = statement.argPath?.node
    if (!argNode || typeof argNode.start !== 'number' || typeof argNode.end !== 'number') {
      continue
    }
    const value = await resolveDefineOptionsValue(values[index])
    const literal = serializeStaticValueToExpression(value, new WeakSet<object>(), scopeValues)
    ms.overwrite(argNode.start, argNode.end, literal)
  }

  return {
    code: ms.toString(),
    dependencies: dependencies.filter(Boolean),
  }
}
