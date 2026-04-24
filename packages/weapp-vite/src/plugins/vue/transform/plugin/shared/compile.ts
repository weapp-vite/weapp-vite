import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { EncodedSourceMapLike } from '../../../../../utils/sourcemap'
import MagicString from 'magic-string'
import { resolveAstEngine } from '../../../../../ast'
import logger from '../../../../../logger'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from '../../../../../utils/sourcemap'
import { collectOnPageScrollPerformanceWarnings } from '../../../../performance/onPageScrollDiagnostics'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled, mayNeedInjectSetDataPickInJs } from '../../injectSetDataPick'
import { registerVueTemplateToken, resolveVueOutputBase } from '../../shared'
import { buildWeappVueStyleRequests } from '../../styleRequest'
import { handleTransformEntryPageLayoutFlow } from './layout'
import {
  mayNeedTransformPageFeatureInjection,
  mayNeedTransformPageScrollDiagnostics,
  mayNeedTransformSetDataPick,
  resolveScriptlessVueEntryStub,
} from './state'

export type VueTransformResultWithScriptMap = Omit<VueTransformResult, 'scriptMap'> & {
  scriptMap?: EncodedSourceMapLike | null
}

export function normalizeVueTransformResult(result: VueTransformResult): VueTransformResultWithScriptMap {
  return {
    ...result,
    scriptMap: normalizeEncodedSourceMapLike(result.scriptMap),
  }
}

export async function finalizeTransformEntryScript(options: {
  result: VueTransformResultWithScriptMap
  filename: string
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  isPage: boolean
  isApp: boolean
  forcePageFeatureInjection?: boolean
}) {
  const { result, filename, pluginCtx, configService, isPage, isApp, forcePageFeatureInjection = false } = options

  if (isPage && result.script) {
    if (mayNeedTransformPageScrollDiagnostics(result.script)) {
      for (const warning of collectOnPageScrollPerformanceWarnings(result.script, filename, {
        engine: resolveAstEngine(configService.weappViteConfig),
      })) {
        logger.warn(warning)
      }
    }

    if (forcePageFeatureInjection || mayNeedTransformPageFeatureInjection(result.script)) {
      const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, filename, {
        checkMtime: configService.isDev,
      })
      if (injected.transformed) {
        result.script = injected.code
        result.scriptMap = composeSourceMaps(injected.map as EncodedSourceMapLike | null | undefined, result.scriptMap)
      }
    }
  }

  if (
    !isApp
    && result.script
    && result.template
    && isAutoSetDataPickEnabled(configService.weappViteConfig)
    && mayNeedTransformSetDataPick(result.template, {
      platform: configService.platform,
    })
    && mayNeedInjectSetDataPickInJs(result.script)
  ) {
    const keys = collectSetDataPickKeysFromTemplate(result.template, {
      astEngine: resolveAstEngine(configService.weappViteConfig),
    })
    const injectedPick = injectSetDataPickInJs(result.script, keys)
    if (injectedPick.transformed) {
      result.script = injectedPick.code
      result.scriptMap = composeSourceMaps(injectedPick.map as EncodedSourceMapLike | null | undefined, result.scriptMap)
    }
  }

  return result
}

export function finalizeTransformEntryCode(options: {
  result: VueTransformResultWithScriptMap
  filename: string
  styleBlocks?: SFCStyleBlock[]
  isPage: boolean
  isApp: boolean
  isDev: boolean
}) {
  const { result, filename, styleBlocks, isPage, isApp, isDev } = options
  const script = result.script ?? ''
  const returned = new MagicString(script)
  let hasMutation = false

  if (styleBlocks?.length) {
    const styleImports = buildWeappVueStyleRequests(filename, styleBlocks)
      .map(request => `import ${JSON.stringify(request)};\n`)
      .join('')
    returned.prepend(styleImports)
    hasMutation = true
  }

  if (!isApp && !result.script?.trim()) {
    returned.append(resolveScriptlessVueEntryStub(isPage))
    hasMutation = true
  }

  const macroHash = result.meta?.jsonMacroHash
  if (macroHash && isDev) {
    returned.append(`\n;Object.defineProperty({}, '__weappViteJsonMacroHash', { value: ${JSON.stringify(macroHash)} })\n`)
    hasMutation = true
  }

  const defineOptionsHash = result.meta?.defineOptionsHash
  if (defineOptionsHash && isDev) {
    returned.append(`\n;Object.defineProperty({}, '__weappViteDefineOptionsHash', { value: ${JSON.stringify(defineOptionsHash)} })\n`)
    hasMutation = true
  }

  const generatedMap = hasMutation
    ? returned.generateMap({
      hires: true,
      includeContent: true,
      source: filename,
      file: filename,
    }) as unknown as EncodedSourceMapLike
    : null

  return {
    code: returned.toString(),
    map: composeSourceMaps(generatedMap as EncodedSourceMapLike | null, result.scriptMap),
  }
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
  const transformResult = result as VueTransformResultWithScriptMap

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
    result: transformResult,
    filename,
    pluginCtx,
    configService,
    isPage,
    isApp,
    forcePageFeatureInjection: isPage,
  })

  compilationCache.set(filename, { result, source, isPage })

  const relativeBase = resolveVueOutputBase(configService, filename)
  if (relativeBase) {
    emitScopedSlotChunks(pluginCtx, relativeBase, result, scopedSlotModules, emittedScopedSlotChunks, configService.outputExtensions)
  }

  return transformResult
}

export function logTransformFileError(filename: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(`[Vue 编译] 编译 ${filename} 失败：${message}`)
}
