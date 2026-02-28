import * as t from '@babel/types'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { bundleRequire } from 'rolldown-require'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'
import { collectKeptStatementPaths } from '../jsonMacros/analyze'
import { withTempDirLock } from '../tempDirLock'
import { rewriteRelativeImportSource } from '../tempImportRewrite'
import { resolveWevuConfigTempDir } from '../wevuTempDir'

interface DefineOptionsStatement {
  statementPath: any
  callPath: any
  argPath: any
}

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

function isIdentifierLikeKey(key: string) {
  return /^[A-Z_$][\w$]*$/i.test(key)
}

function serializeStaticValueToExpression(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'undefined'
  }

  const valueType = typeof value
  if (valueType === 'string') {
    return JSON.stringify(value)
  }
  if (valueType === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (valueType === 'number') {
    if (Number.isNaN(value)) {
      return 'Number.NaN'
    }
    if (value === Number.POSITIVE_INFINITY) {
      return 'Number.POSITIVE_INFINITY'
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return 'Number.NEGATIVE_INFINITY'
    }
    if (Object.is(value, -0)) {
      return '-0'
    }
    return String(value)
  }
  if (valueType === 'bigint') {
    return `${String(value)}n`
  }
  if (valueType === 'symbol') {
    throw new Error('defineOptions 的参数中不支持 Symbol 值。')
  }
  if (valueType === 'function') {
    const source = Function.prototype.toString.call(value)
    if (source.includes('[native code]')) {
      throw new Error('defineOptions 的参数中不支持原生函数值。')
    }
    return `(${source})`
  }

  if (value instanceof Date) {
    return `new Date(${JSON.stringify(value.toISOString())})`
  }
  if (value instanceof RegExp) {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => serializeStaticValueToExpression(item, seen)).join(', ')}]`
  }

  if (value && typeof value === 'object') {
    if (seen.has(value as object)) {
      throw new Error('defineOptions 的参数中不支持循环引用。')
    }
    seen.add(value as object)

    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('defineOptions 的参数仅支持普通对象。')
    }

    const objectValue = value as Record<string, unknown>
    const props = Object.keys(objectValue).map((key) => {
      const encodedKey = isIdentifierLikeKey(key) ? key : JSON.stringify(key)
      return `${encodedKey}: ${serializeStaticValueToExpression(objectValue[key], seen)}`
    })
    return `{ ${props.join(', ')} }`
  }

  throw new Error(`defineOptions 的参数中包含不支持的值类型：${valueType}`)
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

async function evaluateDefineOptionsValues(params: {
  content: string
  filename: string
  lang?: string
  statements: DefineOptionsStatement[]
}): Promise<{ values: unknown[], dependencies: string[] }> {
  const { content, filename, lang, statements } = params
  const ms = new MagicString(content)
  const dir = path.dirname(filename)
  const tempDir = resolveWevuConfigTempDir(dir)
  const programPath = statements[0]?.statementPath.parentPath
  if (!programPath) {
    return {
      values: [],
      dependencies: [],
    }
  }
  const bodyPaths = programPath?.get('body') ?? []
  const macroStatementPaths = statements.map(item => item.statementPath)

  const { keptStatementPaths } = collectKeptStatementPaths(programPath, macroStatementPaths)

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
const __weapp_defineOptions = (value) => (__weapp_define_options_values.push(value), value)
`.trimStart()
  const footer = '\nexport default __weapp_define_options_values\n'
  const evalSource = header + ms.toString() + footer

  return await withTempDirLock(tempDir, async () => {
    await fs.ensureDir(tempDir)
    const basename = path.basename(filename, path.extname(filename))
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const tempFile = path.join(tempDir, `${basename}.define-options.${unique}.${extension}`)
    await fs.writeFile(tempFile, evalSource, 'utf8')
    try {
      const { mod, dependencies } = await bundleRequire<{ default?: unknown[] }>({
        filepath: tempFile,
        cwd: dir,
      })
      const exported = mod?.default ?? mod
      const values = Array.isArray(exported) ? exported : [exported]
      return {
        values,
        dependencies,
      }
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

  const { values, dependencies } = await evaluateDefineOptionsValues({
    content,
    filename,
    lang,
    statements,
  })

  const ms = new MagicString(content)
  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index]
    const argNode = statement.argPath?.node
    if (!argNode || typeof argNode.start !== 'number' || typeof argNode.end !== 'number') {
      continue
    }
    const value = await resolveDefineOptionsValue(values[index])
    const literal = serializeStaticValueToExpression(value)
    ms.overwrite(argNode.start, argNode.end, literal)
  }

  return {
    code: ms.toString(),
    dependencies: dependencies.filter(Boolean),
  }
}
