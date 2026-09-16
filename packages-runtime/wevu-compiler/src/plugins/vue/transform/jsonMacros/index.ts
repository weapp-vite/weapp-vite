import type { EncodedSourceMapLike } from '../../../../utils/sourcemap'
import { createHash } from 'node:crypto'
import { collectKeptStatementPaths } from './analyze'
import { evaluateScriptSetupJsonMacro } from './execute'
import { assertSingleMacro, collectMacroCallPaths, findProgramPath, mayContainJsonMacro, parseScriptSetupAst } from './parse'
import { stripJsonMacroCallsFromCode, stripScriptSetupMacroStatements } from './rewrite'
import { resolveStaticJsonMacroConfig } from './static'

interface JsonMacroExtractionOptions {
  merge?: (target: Record<string, any>, source: Record<string, any>) => Record<string, any> | void
  preambleContent?: string
}

interface JsonMacroExtractionResult {
  stripped: string
  config?: Record<string, any>
  macroHash?: string
  dependencies?: string[]
}

interface ScriptSetupSourceMapOptions {
  source: string
  sourceFile: string
  offset: number
}

type JsonMacroExtractionResultWithMap = JsonMacroExtractionResult & {
  map?: EncodedSourceMapLike
}

function withSourceMap(
  result: JsonMacroExtractionResult,
  map: EncodedSourceMapLike | undefined,
): JsonMacroExtractionResultWithMap {
  return map ? { ...result, map } : result
}

async function evaluateJsonMacroConfig(
  content: string,
  filename: string,
  lang?: string,
  options?: JsonMacroExtractionOptions,
): Promise<{ config?: Record<string, any>, dependencies: string[] } | undefined> {
  const contentForEval = options?.preambleContent
    ? `${options.preambleContent}\n${content}`
    : content
  const ast = parseScriptSetupAst(contentForEval, filename)
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
    preambleContent: options?.preambleContent,
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

async function extractJsonMacroFromScriptSetupInternal(
  content: string,
  filename: string,
  lang?: string,
  options?: JsonMacroExtractionOptions,
  sourceMap?: ScriptSetupSourceMapOptions,
): Promise<JsonMacroExtractionResultWithMap> {
  if (!mayContainJsonMacro(content)) {
    return { stripped: content }
  }

  const ast = parseScriptSetupAst(content, filename)
  const { macroNames, macroStatements } = collectMacroCallPaths(ast, filename)
  assertSingleMacro(macroNames, filename)

  const { stripped, macroStatementSources, map } = stripScriptSetupMacroStatements(
    content,
    ast,
    filename,
    sourceMap,
  )
  if (macroNames.size === 0) {
    return withSourceMap({ stripped }, map)
  }

  const macroHash = createHash('sha256')
    .update(macroStatementSources.join('\n'))
    .digest('hex')
    .slice(0, 12)

  const staticConfig = resolveStaticJsonMacroConfig(macroStatements, options)
  if (staticConfig) {
    return withSourceMap({ stripped, config: staticConfig, macroHash, dependencies: [] }, map)
  }

  const result = await evaluateJsonMacroConfig(content, filename, lang, options)
  return withSourceMap(
    result
      ? { stripped, config: result.config, macroHash, dependencies: result.dependencies }
      : { stripped, macroHash },
    map,
  )
}

/**
 * 从 `<script setup>` 中提取 JSON 宏配置并返回剥离后的代码。
 */
export async function extractJsonMacroFromScriptSetup(
  content: string,
  filename: string,
  lang?: string,
  options?: JsonMacroExtractionOptions,
): Promise<JsonMacroExtractionResult> {
  return await extractJsonMacroFromScriptSetupInternal(content, filename, lang, options)
}

/** @internal */
export async function extractJsonMacroFromScriptSetupWithSourceMap(
  content: string,
  filename: string,
  lang: string | undefined,
  options: JsonMacroExtractionOptions | undefined,
  sourceMap: ScriptSetupSourceMapOptions | undefined,
) {
  return await extractJsonMacroFromScriptSetupInternal(content, filename, lang, options, sourceMap)
}

export { stripJsonMacroCallsFromCode }
export { mayContainJsonMacro }
