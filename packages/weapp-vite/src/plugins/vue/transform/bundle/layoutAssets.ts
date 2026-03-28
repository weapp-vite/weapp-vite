import type { CompilerContext } from '../../../../context'
import type { OutputExtensions } from '../../../../platforms/types'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取布局资产
import fs from 'fs-extra'
import { emitSfcJsonAsset, emitSfcStyleIfMissing, emitSfcTemplateIfMissing } from '../emitAssets'
import { collectNativeLayoutAssets } from '../pageLayout'
import { resolveBundleOutputExtensions } from './outputExtensions'
import { compileVueLikeFile, getEntryBaseName, SCRIPTLESS_COMPONENT_STUB } from './shared'

export function resolveVueLayoutAssetOptions(options: {
  configService: NonNullable<CompilerContext['configService']>
  layoutBasePath: string
  outputExtensions: OutputExtensions | undefined
}) {
  const relativeBase = options.configService.relativeOutputPath(options.layoutBasePath)
  if (!relativeBase) {
    return undefined
  }

  return {
    relativeBase,
    ...resolveBundleOutputExtensions(options.outputExtensions),
  }
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

  const fileName = `${resolvedOptions.relativeBase}.${resolvedOptions.scriptExtension}`
  const emittedLayoutScripts: Set<string> = (pluginCtx as any).__weappViteNativeLayoutScripts ?? ((pluginCtx as any).__weappViteNativeLayoutScripts = new Set<string>())
  if (emittedLayoutScripts.has(fileName)) {
    return
  }

  emittedLayoutScripts.add(fileName)
  pluginCtx.emitFile({
    type: 'chunk',
    id: assets.script,
    fileName,
    // @ts-ignore Rolldown 的 PluginContext 类型不完整
    preserveSignature: 'exports-only',
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
  const scriptFileName = `${relativeBase}.${scriptExtension}`
  if (bundle[scriptFileName]) {
    return
  }

  pluginCtx.emitFile({
    type: 'asset',
    fileName: scriptFileName,
    source: SCRIPTLESS_COMPONENT_STUB,
  })
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

  const scriptFileName = `${resolvedOptions.relativeBase}.${resolvedOptions.scriptExtension}`
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
