import type { File as BabelFile } from '@babel/types'
import * as t from '@babel/types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'

export const JSON_MACROS = new Set(['defineAppJson', 'definePageJson', 'defineComponentJson'])

export function parseScriptSetupAst(content: string, filename: string): BabelFile {
  try {
    return babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse <script setup> in ${filename}: ${message}`)
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
        throw new Error(`${callee.name}() must be used as a top-level statement in <script setup> (${filename})`)
      }
      macroNames.add(callee.name)
      macroStatements.push(path.parentPath)
    },
  })

  return { macroNames, macroStatements }
}

export function assertSingleMacro(macroNames: Set<string>, filename: string) {
  if (macroNames.size > 1) {
    throw new Error(`Only one of ${Array.from(JSON_MACROS).join(', ')} can be used in a single <script setup> (${filename})`)
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
