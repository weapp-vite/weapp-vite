import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { CompileVueFileOptions, VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { EncodedSourceMapLike } from '../../../../../utils/sourcemap'
import type { ResolvedAppShell } from '../../appShell'
import { WEVU_SLOT_OWNER_ID_ATTR, WEVU_SLOT_OWNER_ID_PROP } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { resolveAstEngine } from '../../../../../ast'
import logger from '../../../../../logger'
import { resolveVueSfcHmrSignatures } from '../../../../../utils/file/vueSfcSignature'
import { normalizeFsResolvedId } from '../../../../../utils/resolvedId'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from '../../../../../utils/sourcemap'
import { collectOnPageScrollPerformanceWarnings } from '../../../../performance/onPageScrollDiagnostics'
import { hasAppShellTemplate, resolveAppShellLayout } from '../../appShell'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectScopedSlotHostPropertiesInJs, injectScopedSlotOwnerSetDataPickInJs, injectSetDataPickInJs, isAutoSetDataPickEnabled, mayNeedInjectSetDataPickInJs, mayNeedScopedSlotHostPropertiesForSetupSlotsInJs, pruneScopedSlotOwnerAutoSetDataPickKeys, shouldUseScopedSlotOwnerOnlySetDataPick } from '../../injectSetDataPick'
import { registerVueTemplateToken, resolveVueOutputBase } from '../../shared'
import { buildWeappVueStyleRequests } from '../../styleRequest'
import { isWevuMinifyEnabled } from '../../wevuPreset'
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
  sourceMap?: boolean
}) {
  const { result, filename, pluginCtx, configService, isPage, isApp, forcePageFeatureInjection = false, sourceMap = true } = options

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
        minify: isWevuMinifyEnabled(configService.weappViteConfig, configService.isDev),
        sourceMap,
      })
      if (injected.transformed) {
        result.script = injected.code
        result.scriptMap = composeSourceMaps(injected.map as EncodedSourceMapLike | null | undefined, result.scriptMap)
      }
    }
  }

  const shouldAutoSetDataPick = !isApp
    && result.script
    && result.template
    && isAutoSetDataPickEnabled(configService.weappViteConfig)
    && mayNeedTransformSetDataPick(result.template, {
      platform: configService.platform,
    })
    && mayNeedInjectSetDataPickInJs(result.script)
  const shouldInjectScopedSlotOwnerPick = !isApp
    && result.script
    && result.template?.includes(WEVU_SLOT_OWNER_ID_ATTR)
    && mayNeedInjectSetDataPickInJs(result.script)

  if (shouldAutoSetDataPick) {
    const keys = collectSetDataPickKeysFromTemplate(result.template!, {
      astEngine: resolveAstEngine(configService.weappViteConfig),
    })
    const scopedSlotPickKeys = shouldUseScopedSlotOwnerOnlySetDataPick(keys)
      ? pruneScopedSlotOwnerAutoSetDataPickKeys(keys)
      : keys
    const injectedPick = shouldInjectScopedSlotOwnerPick
      ? injectScopedSlotOwnerSetDataPickInJs(result.script!, scopedSlotPickKeys, { sourceMap })
      : injectSetDataPickInJs(result.script!, keys, { sourceMap })
    if (injectedPick.transformed) {
      result.script = injectedPick.code
      result.scriptMap = composeSourceMaps(injectedPick.map as EncodedSourceMapLike | null | undefined, result.scriptMap)
    }
  }
  else if (shouldInjectScopedSlotOwnerPick) {
    const keys = collectSetDataPickKeysFromTemplate(result.template!, {
      astEngine: resolveAstEngine(configService.weappViteConfig),
    })
    const injectedPick = injectScopedSlotOwnerSetDataPickInJs(
      result.script!,
      pruneScopedSlotOwnerAutoSetDataPickKeys(keys),
      { sourceMap },
    )
    if (injectedPick.transformed) {
      result.script = injectedPick.code
      result.scriptMap = composeSourceMaps(injectedPick.map as EncodedSourceMapLike | null | undefined, result.scriptMap)
    }
  }

  const hasScopedSlotHostGenerics = Boolean(result.componentGenerics && Object.keys(result.componentGenerics).length > 0)
  const needsSetupSlotHostProperties = result.script && mayNeedScopedSlotHostPropertiesForSetupSlotsInJs(result.script)
  if (!isPage && !isApp && result.script && (hasScopedSlotHostGenerics || result.template?.includes(WEVU_SLOT_OWNER_ID_PROP) || result.template?.includes('<slot') || result.template?.includes('vueSlots') || needsSetupSlotHostProperties)) {
    const injectedProps = injectScopedSlotHostPropertiesInJs(result.script, { sourceMap })
    if (injectedProps.transformed) {
      result.script = injectedProps.code
      result.scriptMap = composeSourceMaps(injectedProps.map as EncodedSourceMapLike | null | undefined, result.scriptMap)
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
  sourceMap?: boolean
  hmrStyleToken?: number | string
}) {
  const { result, filename, styleBlocks, isPage, isApp, isDev, sourceMap = true, hmrStyleToken } = options
  const script = result.script ?? ''
  const returned = new MagicString(script)
  let hasMutation = false

  if (styleBlocks?.length) {
    const styleImports = buildWeappVueStyleRequests(filename, styleBlocks, { hmrToken: hmrStyleToken })
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

  const generatedMap = hasMutation && sourceMap
    ? returned.generateMap({
      hires: true,
      includeContent: true,
      source: filename,
      file: filename,
    }) as unknown as EncodedSourceMapLike
    : null

  return {
    code: returned.toString(),
    map: sourceMap
      ? composeSourceMaps(generatedMap as EncodedSourceMapLike | null, result.scriptMap)
      : null,
  }
}

export async function compileTransformEntryResult(options: {
  transformedSource: string
  filename: string
  compileOptions: CompileVueFileOptions
  compileVueFile: (source: string, filename: string, options: CompileVueFileOptions) => Promise<VueTransformResult>
  compileJsxFile: (source: string, filename: string, options: CompileVueFileOptions) => Promise<VueTransformResult>
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
  autoRoutesSignature?: string
  result: VueTransformResult
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean, autoRoutesSignature?: string, refreshToken?: number, styleIndependentSignature?: string }>
  styleIndependentSignature?: string
  setAppShell?: (shell: ResolvedAppShell | undefined) => void
  configService: NonNullable<CompilerContext['configService']>
  isPage: boolean
  isApp: boolean
  sourceMap?: boolean
  scopedSlotModules: Map<string, string>
  emittedScopedSlotChunks: Set<string>
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
    autoRoutesSignature,
    result,
    compilationCache,
    styleIndependentSignature,
    setAppShell,
    configService,
    isPage,
    isApp,
    sourceMap,
    scopedSlotModules,
    emittedScopedSlotChunks,
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

  if (isApp) {
    setAppShell?.(
      hasAppShellTemplate(result)
        ? resolveAppShellLayout(configService)
        : undefined,
    )
  }

  if (!isApp) {
    registerVueTemplateToken(ctx, filename, result.template)
  }

  if (Array.isArray(result.meta?.sfcSrcDeps)) {
    ctx.moduleGraphService.replaceEntryDependencies(filename, 'style', result.meta.sfcSrcDeps)
  }

  await finalizeTransformEntryScript({
    result: transformResult,
    filename,
    pluginCtx,
    configService,
    isPage,
    isApp,
    sourceMap,
  })

  compilationCache.set(filename, {
    result,
    source,
    isPage,
    autoRoutesSignature,
    refreshToken: 0,
    styleIndependentSignature,
  })
  if (configService.isDev && filename.endsWith('.vue')) {
    const normalizedFilename = normalizeFsResolvedId(filename)
    const hmr = ctx.runtimeState?.build?.hmr
    const signatures = resolveVueSfcHmrSignatures(source, filename)
    if (signatures.nonJsonSignature && hmr?.vueEntryNonJsonSignatures) {
      hmr.vueEntryNonJsonSignatures.set(normalizedFilename, signatures.nonJsonSignature)
    }
    if (signatures.scriptSignature && hmr?.vueEntryScriptSignatures) {
      hmr.vueEntryScriptSignatures.set(normalizedFilename, signatures.scriptSignature)
    }
    if (signatures.tailwindContentSignature && hmr?.vueEntryTailwindContentSignatures) {
      hmr.vueEntryTailwindContentSignatures.set(normalizedFilename, signatures.tailwindContentSignature)
    }
    if (signatures.tailwindTemplateContentSignature && hmr?.vueEntryTailwindTemplateContentSignatures) {
      hmr.vueEntryTailwindTemplateContentSignatures.set(normalizedFilename, signatures.tailwindTemplateContentSignature)
    }
    if (signatures.tailwindScriptContentSignature && hmr?.vueEntryTailwindScriptContentSignatures) {
      hmr.vueEntryTailwindScriptContentSignatures.set(normalizedFilename, signatures.tailwindScriptContentSignature)
    }
    const nextStyleIndependentSignature = styleIndependentSignature
      ?? signatures.styleIndependentSignature
    if (nextStyleIndependentSignature && hmr?.vueEntryStyleIndependentSignatures) {
      hmr.vueEntryStyleIndependentSignatures.set(normalizedFilename, nextStyleIndependentSignature)
    }
    if (signatures.hasTemplate !== undefined && hmr?.vueEntryHasTemplate) {
      hmr.vueEntryHasTemplate.set(normalizedFilename, signatures.hasTemplate)
    }
  }

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
