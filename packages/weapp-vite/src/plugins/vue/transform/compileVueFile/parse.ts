import type { File as BabelFile } from '@babel/types'
import type { JsonConfig } from '../../../../types'
import type { CompileVueFileOptions } from './types'
import { createHash } from 'node:crypto'
import * as t from '@babel/types'
import { parse } from 'vue/compiler-sfc'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'
import { extractJsonMacroFromScriptSetup } from '../jsonMacros'
import { createJsonMerger } from '../jsonMerge'

export interface ParsedVueFile {
  descriptor: ReturnType<typeof parse>['descriptor']
  descriptorForCompile: ReturnType<typeof parse>['descriptor']
  meta: {
    hasScriptSetup: boolean
    hasSetupOption: boolean
  }
  scriptSetupMacroConfig?: Record<string, any>
  scriptSetupMacroHash?: string
  defineOptionsHash?: string
  jsonKind: 'app' | 'page' | 'component'
  jsonDefaults?: NonNullable<JsonConfig['defaults']>[keyof NonNullable<JsonConfig['defaults']>]
  mergeJson: ReturnType<typeof createJsonMerger>
  isAppFile: boolean
}

function extractDefineOptionsHash(content: string) {
  let ast: BabelFile
  try {
    ast = babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS)
  }
  catch {
    return undefined
  }

  const macroSources: string[] = []
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
      const statement = path.parentPath?.node
      if (statement && typeof statement.start === 'number' && typeof statement.end === 'number') {
        macroSources.push(content.slice(statement.start, statement.end))
      }
    },
  })

  if (!macroSources.length) {
    return undefined
  }

  return createHash('sha256')
    .update(macroSources.join('\n'))
    .digest('hex')
    .slice(0, 12)
}

export async function parseVueFile(
  source: string,
  filename: string,
  options?: CompileVueFileOptions,
): Promise<ParsedVueFile> {
  const { descriptor, errors } = parse(source, { filename })

  if (errors.length > 0) {
    const error = errors[0]
    throw new Error(`解析 ${filename} 失败：${error.message}`)
  }

  let descriptorForCompile = descriptor

  const meta = {
    hasScriptSetup: !!descriptor.scriptSetup,
    hasSetupOption: !!descriptor.script && /\bsetup\s*\(/.test(descriptor.script.content),
  }

  let scriptSetupMacroConfig: Record<string, any> | undefined
  let scriptSetupMacroHash: string | undefined
  let defineOptionsHash: string | undefined
  const jsonKind = options?.json?.kind
    ?? (options?.isApp ? 'app' : options?.isPage ? 'page' : 'component')
  const jsonDefaults = options?.json?.defaults?.[jsonKind]
  const mergeJson = createJsonMerger(options?.json?.mergeStrategy, { filename, kind: jsonKind })

  const scriptSetup = descriptor.scriptSetup
  if (scriptSetup?.content) {
    const extracted = await extractJsonMacroFromScriptSetup(
      scriptSetup.content,
      filename,
      scriptSetup.lang,
      {
        merge: (target, source) => mergeJson(target, source, 'macro'),
      },
    )
    if (extracted.stripped !== scriptSetup.content) {
      const setupLoc = scriptSetup.loc
      const startOffset = setupLoc.start.offset
      const endOffset = setupLoc.end.offset
      const nextSource = source.slice(0, startOffset) + extracted.stripped + source.slice(endOffset)
      const { descriptor: nextDescriptor, errors: nextErrors } = parse(nextSource, {
        filename,
        ignoreEmpty: false,
      })

      if (nextErrors.length > 0) {
        const error = nextErrors[0]
        throw new Error(`解析 ${filename} 失败：${error.message}`)
      }

      descriptorForCompile = nextDescriptor
    }
    scriptSetupMacroConfig = extracted.config
    scriptSetupMacroHash = extracted.macroHash
    defineOptionsHash = extractDefineOptionsHash(scriptSetup.content)
  }

  const isAppFile = /[\\/]app\.vue$/.test(filename)

  return {
    descriptor,
    descriptorForCompile,
    meta,
    scriptSetupMacroConfig,
    scriptSetupMacroHash,
    defineOptionsHash,
    jsonKind,
    jsonDefaults,
    mergeJson,
    isAppFile,
  }
}
