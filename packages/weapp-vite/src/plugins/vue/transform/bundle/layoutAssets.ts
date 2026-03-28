import type { CompilerContext } from '../../../../context'
import type { OutputExtensions } from '../../../../platforms/types'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取布局资产
import fs from 'fs-extra'
import { emitNativeLayoutScriptChunkIfNeeded as emitSharedNativeLayoutScriptChunkIfNeeded, resolveNativeLayoutOutputOptions } from '../../../utils/nativeLayout'
import { ensureScriptlessComponentAsset, resolveScriptlessComponentFileName } from '../../../utils/scriptlessComponent'
import { emitSfcJsonAsset, emitSfcStyleIfMissing, emitSfcTemplateIfMissing } from '../emitAssets'
import { collectNativeLayoutAssets } from '../pageLayout'
import { compileVueLikeFile, getEntryBaseName } from './shared'

export function resolveVueLayoutAssetOptions(options: {
  configService: NonNullable<CompilerContext['configService']>
  layoutBasePath: string
  outputExtensions: OutputExtensions | undefined
}) {
  return resolveNativeLayoutOutputOptions(options)
}

export async function emitNativeLayoutScriptChunkIfNeeded(options: {
  pluginCtx: any
  layoutBasePath: string
  configService: NonNullable<CompilerContext['configService']>
  outputExtensions: OutputExtensions | undefined
}) {
  const { pluginCtx, layoutBasePath, configService, outputExtensions } = options
  const resolvedOptions = resolveVueLayoutAssetOptions({
    configService,
    layoutBasePath,
    outputExtensions,
  })
  if (!resolvedOptions) {
    return
  }

  const assets = await collectNativeLayoutAssets(layoutBasePath)
  if (!assets.script) {
    return
  }

  const fileName = resolveScriptlessComponentFileName(
    resolvedOptions.relativeBase,
    resolvedOptions.scriptExtension,
  )
  emitSharedNativeLayoutScriptChunkIfNeeded({
    pluginCtx,
    scriptId: assets.script,
    fileName,
  })
}

export async function emitNativeLayoutAssetsIfNeeded(options: {
  pluginCtx: any
  bundle: Record<string, any>
  layoutBasePath: string
  configService: NonNullable<CompilerContext['configService']>
  outputExtensions: OutputExtensions | undefined
}) {
  const { pluginCtx, bundle, layoutBasePath, configService, outputExtensions } = options
  const resolvedOptions = resolveVueLayoutAssetOptions({
    configService,
    layoutBasePath,
    outputExtensions,
  })
  if (!resolvedOptions) {
    return
  }

  const assets = await collectNativeLayoutAssets(layoutBasePath)

  if (assets.json) {
    const source = await fs.readFile(assets.json, 'utf8')
    emitSfcJsonAsset(pluginCtx, bundle, resolvedOptions.relativeBase, { config: source }, {
      emitIfMissingOnly: true,
      extension: resolvedOptions.jsonExtension,
      kind: 'component',
    })
  }

  if (assets.template) {
    const source = await fs.readFile(assets.template, 'utf8')
    emitSfcTemplateIfMissing(pluginCtx, bundle, resolvedOptions.relativeBase, source, resolvedOptions.templateExtension)
  }

  if (assets.style) {
    const source = await fs.readFile(assets.style, 'utf8')
    emitSfcStyleIfMissing(pluginCtx, bundle, resolvedOptions.relativeBase, source, resolvedOptions.styleExtension)
  }
}

export function emitScriptlessComponentJsFallbackIfMissing(options: {
  pluginCtx: any
  bundle: Record<string, any>
  relativeBase: string
  scriptExtension: string
}) {
  const { pluginCtx, bundle, relativeBase, scriptExtension } = options
  ensureScriptlessComponentAsset(pluginCtx, bundle, relativeBase, scriptExtension)
}

export async function emitVueLayoutScriptFallbackIfNeeded(options: {
  pluginCtx: any
  bundle: Record<string, any>
  layoutFilePath: string
  ctx: CompilerContext
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
  outputExtensions: OutputExtensions | undefined
}) {
  const {
    pluginCtx,
    bundle,
    layoutFilePath,
    ctx,
    configService,
    compileOptionsState,
    outputExtensions,
  } = options

  const resolvedOptions = resolveVueLayoutAssetOptions({
    configService,
    layoutBasePath: getEntryBaseName(layoutFilePath),
    outputExtensions,
  })
  if (!resolvedOptions) {
    return
  }

  const scriptFileName = resolveScriptlessComponentFileName(
    resolvedOptions.relativeBase,
    resolvedOptions.scriptExtension,
  )
  if (bundle[scriptFileName]) {
    return
  }

  const source = await fs.readFile(layoutFilePath, 'utf-8')
  const result = await compileVueLikeFile({
    source,
    filename: layoutFilePath,
    ctx,
    pluginCtx,
    isPage: false,
    isApp: false,
    configService,
    compileOptionsState,
  })

  if (result.script?.trim()) {
    return
  }

  emitScriptlessComponentJsFallbackIfMissing({
    pluginCtx,
    bundle,
    relativeBase: resolvedOptions.relativeBase,
    scriptExtension: resolvedOptions.scriptExtension,
  })
}
