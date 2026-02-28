import type { File as BabelFile } from '@babel/types'
import * as t from '@babel/types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'

export const JSON_MACROS = new Set([
  'defineAppJson',
  'definePageJson',
  'defineComponentJson',
  'defineSitemapJson',
  'defineThemeJson',
])

export function parseScriptSetupAst(content: string, filename: string): BabelFile {
  try {
    return babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`解析 ${filename} 中的 <script setup> 失败：${message}`)
  }
}

export function collectMacroCallPaths(ast: BabelFile, filename: string) {
  const macroNames = new Set<string>()
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
        throw new Error(`${callee.name}() 必须在 <script setup> 顶层语句中使用（${filename}）。`)
      }
      macroNames.add(callee.name)
      macroStatements.push(path.parentPath)
    },
  })

  return { macroNames, macroStatements }
}

export function assertSingleMacro(macroNames: Set<string>, filename: string) {
  if (macroNames.size > 1) {
    throw new Error(`同一个 <script setup> 仅能使用 ${Array.from(JSON_MACROS).join(', ')} 中的一个（${filename}）。`)
  }
  return macroNames.values().next().value as string | undefined
}

export function findProgramPath(ast: BabelFile) {
  let programPath: any
  traverse(ast, {
    Program(path) {
      programPath = path
      path.stop()
    },
  })
  return programPath
}
