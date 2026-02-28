import type { File as BabelFile } from '@babel/types'
import type { JsonConfig } from '../../../../types/json'
import type { CompileVueFileOptions } from './types'
import { createHash } from 'node:crypto'
import * as t from '@babel/types'
import { parse } from 'vue/compiler-sfc'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'
import { normalizeLineEndings } from '../../../../utils/text'
import { preprocessScriptSetupSrc, preprocessScriptSrc, resolveSfcBlockSrc, restoreScriptSetupSrc, restoreScriptSrc } from '../../../utils/vueSfc'
import { inlineScriptSetupDefineOptionsArgs } from '../defineOptions/inline'
import { extractJsonMacroFromScriptSetup } from '../jsonMacros'
import { createJsonMerger } from '../jsonMerge'

export interface ParsedVueFile {
  descriptor: ReturnType<typeof parse>['descriptor']
  descriptorForCompile: ReturnType<typeof parse>['descriptor']
  meta: {
    hasScriptSetup: boolean
    hasSetupOption: boolean
    sfcSrcDeps?: string[]
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
  const normalizedInputSource = normalizeLineEndings(source)
  const normalizedSource = preprocessScriptSrc(preprocessScriptSetupSrc(normalizedInputSource))
  let descriptorForCompileSource = normalizedSource
  const { descriptor, errors } = parse(normalizedSource, {
    filename,
    ignoreEmpty: normalizedSource === normalizedInputSource,
  })
  restoreScriptSetupSrc(descriptor)
  restoreScriptSrc(descriptor)

  if (errors.length > 0) {
    const error = errors[0]
    throw new Error(`解析 ${filename} 失败：${error.message}`)
  }

  let resolvedDescriptor = descriptor
  let sfcSrcDeps: string[] | undefined
  if (options?.sfcSrc) {
    const resolved = await resolveSfcBlockSrc(descriptor, filename, options.sfcSrc)
    resolvedDescriptor = resolved.descriptor
    if (resolved.deps.length) {
      sfcSrcDeps = resolved.deps
    }
  }

  let descriptorForCompile = resolvedDescriptor

  const meta = {
    hasScriptSetup: !!resolvedDescriptor.scriptSetup,
    hasSetupOption: !!resolvedDescriptor.script && /\bsetup\s*\(/.test(resolvedDescriptor.script.content),
    sfcSrcDeps,
  }

  let scriptSetupMacroConfig: Record<string, any> | undefined
  let scriptSetupMacroHash: string | undefined
  let defineOptionsHash: string | undefined
  const jsonKind = options?.json?.kind
    ?? (options?.isApp ? 'app' : options?.isPage ? 'page' : 'component')
  const jsonDefaults = options?.json?.defaults?.[jsonKind]
  const mergeJson = createJsonMerger(options?.json?.mergeStrategy, { filename, kind: jsonKind })

  const scriptSetup = resolvedDescriptor.scriptSetup
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
      if (scriptSetup.src) {
        descriptorForCompile = {
          ...descriptorForCompile,
          scriptSetup: {
            ...descriptorForCompile.scriptSetup!,
            content: extracted.stripped,
          },
        }
      }
      else {
        const setupLoc = scriptSetup.loc
        const startOffset = setupLoc.start.offset
        const endOffset = setupLoc.end.offset
        const nextSource = descriptorForCompileSource.slice(0, startOffset) + extracted.stripped + descriptorForCompileSource.slice(endOffset)
        const { descriptor: nextDescriptor, errors: nextErrors } = parse(nextSource, {
          filename,
          ignoreEmpty: false,
        })
        restoreScriptSetupSrc(nextDescriptor)
        restoreScriptSrc(nextDescriptor)

        if (nextErrors.length > 0) {
          const error = nextErrors[0]
          throw new Error(`解析 ${filename} 失败：${error.message}`)
        }

        if (options?.sfcSrc) {
          const resolvedNext = await resolveSfcBlockSrc(nextDescriptor, filename, options.sfcSrc)
          descriptorForCompile = resolvedNext.descriptor
          if (resolvedNext.deps.length) {
            const deps = new Set([...(sfcSrcDeps ?? []), ...resolvedNext.deps])
            sfcSrcDeps = Array.from(deps)
            meta.sfcSrcDeps = sfcSrcDeps
          }
        }
        else {
          descriptorForCompile = nextDescriptor
        }
        descriptorForCompileSource = nextSource
      }
    }
    scriptSetupMacroConfig = extracted.config
    scriptSetupMacroHash = extracted.macroHash
    defineOptionsHash = extractDefineOptionsHash(scriptSetup.content)
  }

  const compileScriptSetup = descriptorForCompile.scriptSetup
  if (compileScriptSetup?.content && /\bdefineOptions\s*\(/.test(compileScriptSetup.content)) {
    const inlined = await inlineScriptSetupDefineOptionsArgs(
      compileScriptSetup.content,
      filename,
      compileScriptSetup.lang,
    )
    if (inlined.code !== compileScriptSetup.content) {
      if (compileScriptSetup.src) {
        descriptorForCompile = {
          ...descriptorForCompile,
          scriptSetup: {
            ...compileScriptSetup,
            content: inlined.code,
          },
        }
      }
      else {
        const setupLoc = compileScriptSetup.loc
        const startOffset = setupLoc.start.offset
        const endOffset = setupLoc.end.offset
        const nextSource = descriptorForCompileSource.slice(0, startOffset) + inlined.code + descriptorForCompileSource.slice(endOffset)
        const { descriptor: nextDescriptor, errors: nextErrors } = parse(nextSource, {
          filename,
          ignoreEmpty: false,
        })
        restoreScriptSetupSrc(nextDescriptor)
        restoreScriptSrc(nextDescriptor)

        if (nextErrors.length > 0) {
          const error = nextErrors[0]
          throw new Error(`解析 ${filename} 失败：${error.message}`)
        }

        if (options?.sfcSrc) {
          const resolvedNext = await resolveSfcBlockSrc(nextDescriptor, filename, options.sfcSrc)
          descriptorForCompile = resolvedNext.descriptor
          if (resolvedNext.deps.length) {
            const deps = new Set([...(sfcSrcDeps ?? []), ...resolvedNext.deps])
            sfcSrcDeps = Array.from(deps)
            meta.sfcSrcDeps = sfcSrcDeps
          }
        }
        else {
          descriptorForCompile = nextDescriptor
        }
        descriptorForCompileSource = nextSource
      }
    }
  }

  const isAppFile = /[\\/]app\.vue$/.test(filename)

  return {
    descriptor: resolvedDescriptor,
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
