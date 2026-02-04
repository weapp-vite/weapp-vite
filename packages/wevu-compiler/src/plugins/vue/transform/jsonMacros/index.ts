import { createHash } from 'node:crypto'
import { collectKeptStatementPaths } from './analyze'
import { evaluateScriptSetupJsonMacro } from './execute'
import { assertSingleMacro, collectMacroCallPaths, findProgramPath, parseScriptSetupAst } from './parse'
import { stripJsonMacroCallsFromCode, stripScriptSetupMacroStatements } from './rewrite'

/**
 * 从 `<script setup>` 中提取 JSON 宏配置并返回剥离后的代码。
 */
export async function extractJsonMacroFromScriptSetup(
  content: string,
  filename: string,
  lang?: string,
  options?: {
    merge?: (target: Record<string, any>, source: Record<string, any>) => Record<string, any> | void
  },
): Promise<{ stripped: string, config?: Record<string, any>, macroHash?: string, dependencies?: string[] }> {
  const ast = parseScriptSetupAst(content, filename)
  const { macroNames } = collectMacroCallPaths(ast, filename)
  assertSingleMacro(macroNames, filename)

  const { stripped, macroStatementSources } = stripScriptSetupMacroStatements(content, ast, filename)
  if (macroNames.size === 0) {
    return { stripped }
  }

  const macroHash = createHash('sha256')
    .update(macroStatementSources.join('\n'))
    .digest('hex')
    .slice(0, 12)

  const result = await evaluateJsonMacroConfig(content, filename, lang, options)
  return result
    ? { stripped, config: result.config, macroHash, dependencies: result.dependencies }
    : { stripped, macroHash }
}

async function evaluateJsonMacroConfig(
  content: string,
  filename: string,
  lang?: string,
  options?: {
    merge?: (target: Record<string, any>, source: Record<string, any>) => Record<string, any> | void
  },
): Promise<{ config?: Record<string, any>, dependencies: string[] } | undefined> {
  const ast = parseScriptSetupAst(content, filename)
  const { macroNames, macroStatements } = collectMacroCallPaths(ast, filename)
  const macroName = assertSingleMacro(macroNames, filename)
  if (!macroName || !macroStatements.length) {
    return undefined
  }

  const programPath = findProgramPath(ast)
  if (!programPath) {
    return undefined
  }

  const { bodyPaths, keptStatementPaths } = collectKeptStatementPaths(programPath, macroStatements)

  return await evaluateScriptSetupJsonMacro({
    originalContent: content,
    filename,
    lang,
    macroName,
    macroStatements,
    bodyPaths,
    keptStatementPaths,
    options,
  })
}

export { stripJsonMacroCallsFromCode }
