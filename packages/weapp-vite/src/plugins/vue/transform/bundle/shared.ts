import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import { compileJsxFile, compileVueFile, getClassStyleWxsSource } from 'wevu/compiler'
import { normalizeWatchPath } from '../../../../utils/path'
import { resolveClassStyleWxsLocationForBase } from '../classStyle'
import { createCompileVueFileOptions } from '../compileOptions'
import { applyPageLayoutPlan, collectNativeLayoutAssets, resolvePageLayoutPlan } from '../pageLayout'

const APP_VUE_LIKE_FILE_RE = /[\\/]app\.(?:vue|jsx|tsx)$/
export const SCRIPTLESS_COMPONENT_STUB = 'Component({})'

export interface CompilationCacheEntry {
  result: VueTransformResult
  source?: string
  isPage: boolean
}

export interface VueBundleState {
  ctx: CompilerContext
  pluginCtx: any
  compilationCache: Map<string, CompilationCacheEntry>
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
}

export interface ClassStyleWxsAsset {
  fileName: string
  source: string
}

export function resolveClassStyleWxsAsset(
  ctx: CompilerContext,
  relativeBase: string,
  wxsExtension: string | undefined,
  configService: NonNullable<CompilerContext['configService']>,
  result: Pick<VueTransformResult, 'classStyleWxs' | 'scopedSlotComponents'>,
): ClassStyleWxsAsset | undefined {
  const needsClassStyleWxs = Boolean(result.classStyleWxs)
    || Boolean(result.scopedSlotComponents?.some(slot => slot.classStyleWxs))
  if (!needsClassStyleWxs || typeof wxsExtension !== 'string' || wxsExtension.length === 0) {
    return undefined
  }

  const classStyleWxsLocation = resolveClassStyleWxsLocationForBase(ctx, relativeBase, wxsExtension, configService)
  return {
    fileName: classStyleWxsLocation.fileName,
    source: getClassStyleWxsSource({ extension: wxsExtension }),
  }
}

export function getEntryBaseName(filename: string) {
  const extIndex = filename.lastIndexOf('.')
  if (extIndex < 0) {
    return filename
  }
  return filename.slice(0, extIndex)
}

export function isAppVueLikeFile(filename: string) {
  return APP_VUE_LIKE_FILE_RE.test(filename)
}

export async function compileVueLikeFile(options: {
  source: string
  filename: string
  ctx: CompilerContext
  pluginCtx: any
  isPage: boolean
  isApp: boolean
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
}) {
  const {
    source,
    filename,
    ctx,
    pluginCtx,
    isPage,
    isApp,
    configService,
    compileOptionsState,
  } = options

  const compileOptions = createCompileVueFileOptions(ctx, pluginCtx, filename, isPage, isApp, configService, compileOptionsState)
  if (filename.endsWith('.vue')) {
    const result = await compileVueFile(source, filename, compileOptions)
    if (isPage && result.template) {
      const resolvedLayoutPlan = await resolvePageLayoutPlan(source, filename, configService)
      if (resolvedLayoutPlan) {
        applyPageLayoutPlan(result, filename, resolvedLayoutPlan)
        if (typeof pluginCtx.addWatchFile === 'function') {
          for (const layout of resolvedLayoutPlan.layouts) {
            pluginCtx.addWatchFile(normalizeWatchPath(layout.file))
            if (layout.kind === 'native') {
              const nativeAssets = await collectNativeLayoutAssets(layout.file)
              for (const asset of Object.values(nativeAssets)) {
                if (asset) {
                  pluginCtx.addWatchFile(normalizeWatchPath(asset))
                }
              }
            }
          }
        }
      }
    }
    return result
  }
  const result = await compileJsxFile(source, filename, compileOptions)
  if (isPage && result.template) {
    const resolvedLayoutPlan = await resolvePageLayoutPlan(source, filename, configService)
    if (resolvedLayoutPlan) {
      applyPageLayoutPlan(result, filename, resolvedLayoutPlan)
      if (typeof pluginCtx.addWatchFile === 'function') {
        for (const layout of resolvedLayoutPlan.layouts) {
          pluginCtx.addWatchFile(normalizeWatchPath(layout.file))
          if (layout.kind === 'native') {
            const nativeAssets = await collectNativeLayoutAssets(layout.file)
            for (const asset of Object.values(nativeAssets)) {
              if (asset) {
                pluginCtx.addWatchFile(normalizeWatchPath(asset))
              }
            }
          }
        }
      }
    }
  }
  return result
}

export function registerVueTemplateToken(
  ctx: CompilerContext,
  filename: string,
  template: string,
) {
  const wxmlService = (ctx as Partial<CompilerContext>).wxmlService
  if (!wxmlService) {
    return
  }

  try {
    const token = wxmlService.analyze(template)
    wxmlService.tokenMap.set(filename, token)
    wxmlService.setWxmlComponentsMap(filename, token.components)
  }
  catch {
    // 忽略模板扫描异常，保持模板发射流程可继续
  }
}
