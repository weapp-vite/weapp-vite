import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import { resolveAstEngine } from '../../../../../ast'
import logger from '../../../../../logger'
import { collectOnPageScrollPerformanceWarnings } from '../../../../performance/onPageScrollDiagnostics'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../../injectSetDataPick'
import { registerVueTemplateToken, resolveVueOutputBase } from '../../shared'
import { buildWeappVueStyleRequest } from '../../styleRequest'
import { handleTransformEntryPageLayoutFlow } from './layout'
import {
  mayNeedTransformPageFeatureInjection,
  mayNeedTransformPageScrollDiagnostics,
  mayNeedTransformSetDataPick,
  resolveScriptlessVueEntryStub,
} from './state'

export async function finalizeTransformEntryScript(options: {
  result: VueTransformResult
  filename: string
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  isPage: boolean
  isApp: boolean
}) {
  const { result, filename, pluginCtx, configService, isPage, isApp } = options

  if (isPage && result.script) {
    if (mayNeedTransformPageScrollDiagnostics(result.script)) {
      for (const warning of collectOnPageScrollPerformanceWarnings(result.script, filename, {
        engine: resolveAstEngine(configService.weappViteConfig),
      })) {
        logger.warn(warning)
      }
    }

    if (mayNeedTransformPageFeatureInjection(result.script)) {
      const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, filename, {
        checkMtime: configService.isDev,
      })
      if (injected.transformed) {
        result.script = injected.code
      }
    }
  }

  if (
    !isApp
    && result.script
    && result.template
    && isAutoSetDataPickEnabled(configService.weappViteConfig)
    && mayNeedTransformSetDataPick(result.template)
  ) {
    const keys = collectSetDataPickKeysFromTemplate(result.template, {
      astEngine: resolveAstEngine(configService.weappViteConfig),
    })
    const injectedPick = injectSetDataPickInJs(result.script, keys)
    if (injectedPick.transformed) {
      result.script = injectedPick.code
    }
  }

  return result
}

export function finalizeTransformEntryCode(options: {
  result: VueTransformResult
  filename: string
  styleBlocks?: SFCStyleBlock[]
  isPage: boolean
  isApp: boolean
  isDev: boolean
}) {
  const { result, filename, styleBlocks, isPage, isApp, isDev } = options
  let returnedCode = result.script ?? ''

  if (styleBlocks?.length) {
    const styleImports = styleBlocks
      .map((styleBlock, index) => {
        const request = buildWeappVueStyleRequest(filename, styleBlock, index)
        return `import ${JSON.stringify(request)};\n`
      })
      .join('')
    returnedCode = styleImports + returnedCode
  }

  if (!isApp && !result.script?.trim()) {
    returnedCode += resolveScriptlessVueEntryStub(isPage)
  }

  const macroHash = result.meta?.jsonMacroHash
  if (macroHash && isDev) {
    returnedCode += `\n;Object.defineProperty({}, '__weappViteJsonMacroHash', { value: ${JSON.stringify(macroHash)} })\n`
  }

  const defineOptionsHash = result.meta?.defineOptionsHash
  if (defineOptionsHash && isDev) {
    returnedCode += `\n;Object.defineProperty({}, '__weappViteDefineOptionsHash', { value: ${JSON.stringify(defineOptionsHash)} })\n`
  }

  return returnedCode
}

export async function compileTransformEntryResult(options: {
  transformedSource: string
  filename: string
  compileOptions: Record<string, unknown>
  compileVueFile: (source: string, filename: string, options: Record<string, unknown>) => Promise<VueTransformResult>
  compileJsxFile: (source: string, filename: string, options: Record<string, unknown>) => Promise<VueTransformResult>
}) {
  const { transformedSource, filename, compileOptions, compileVueFile, compileJsxFile } = options
  return filename.endsWith('.vue')
    ? await compileVueFile(transformedSource, filename, compileOptions)
    : await compileJsxFile(transformedSource, filename, compileOptions)
}

export async function finalizeTransformCompiledResult(options: {
  ctx: CompilerContext
  pluginCtx: any
  filename: string
  source: string
  result: VueTransformResult
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>
  configService: NonNullable<CompilerContext['configService']>
  isPage: boolean
  isApp: boolean
  scopedSlotModules: Map<string, string>
  emittedScopedSlotChunks: Set<string>
  addWatchFile: (pluginCtx: any, file: string) => void
  emitScopedSlotChunks: (
    pluginCtx: any,
    relativeBase: string,
    result: VueTransformResult,
    scopedSlotModules: Map<string, string>,
    emittedScopedSlotChunks: Set<string>,
    outputExtensions: NonNullable<CompilerContext['configService']>['outputExtensions'],
  ) => void
}) {
  const {
    ctx,
    pluginCtx,
    filename,
    source,
    result,
    compilationCache,
    configService,
    isPage,
    isApp,
    scopedSlotModules,
    emittedScopedSlotChunks,
    addWatchFile,
    emitScopedSlotChunks,
  } = options

  if (isPage && result.template) {
    await handleTransformEntryPageLayoutFlow({
      pluginCtx,
      ctx,
      filename,
      source,
      result,
    })
  }

  registerVueTemplateToken(ctx, filename, result.template)

  if (Array.isArray(result.meta?.sfcSrcDeps) && typeof pluginCtx.addWatchFile === 'function') {
    for (const dep of result.meta.sfcSrcDeps) {
      addWatchFile(pluginCtx, dep)
    }
  }

  await finalizeTransformEntryScript({
    result,
    filename,
    pluginCtx,
    configService,
    isPage,
    isApp,
  })

  compilationCache.set(filename, { result, source, isPage })

  const relativeBase = resolveVueOutputBase(configService, filename)
  if (relativeBase) {
    emitScopedSlotChunks(pluginCtx, relativeBase, result, scopedSlotModules, emittedScopedSlotChunks, configService.outputExtensions)
  }

  return result
}

export function logTransformFileError(filename: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(`[Vue 编译] 编译 ${filename} 失败：${message}`)
}
