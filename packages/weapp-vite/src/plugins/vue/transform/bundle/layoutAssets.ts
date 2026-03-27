import type { CompilerContext } from '../../../../context'
import type { OutputExtensions } from '../../../../platforms/types'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取布局资产
import fs from 'fs-extra'
import { emitSfcJsonAsset, emitSfcStyleIfMissing, emitSfcTemplateIfMissing } from '../emitAssets'
import { collectNativeLayoutAssets } from '../pageLayout'
import { resolveBundleOutputExtensions } from './outputExtensions'
import { compileVueLikeFile, getEntryBaseName, SCRIPTLESS_COMPONENT_STUB } from './shared'

export async function emitNativeLayoutScriptChunkIfNeeded(options: {
  pluginCtx: any
  layoutBasePath: string
  configService: NonNullable<CompilerContext['configService']>
  outputExtensions: OutputExtensions | undefined
}) {
  const { pluginCtx, layoutBasePath, configService, outputExtensions } = options
  const relativeBase = configService.relativeOutputPath(layoutBasePath)
  if (!relativeBase) {
    return
  }

  const assets = await collectNativeLayoutAssets(layoutBasePath)
  if (!assets.script) {
    return
  }

  const { scriptExtension } = resolveBundleOutputExtensions(outputExtensions)
  const fileName = `${relativeBase}.${scriptExtension}`
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
  const relativeBase = configService.relativeOutputPath(layoutBasePath)
  if (!relativeBase) {
    return
  }

  const assets = await collectNativeLayoutAssets(layoutBasePath)
  const { jsonExtension, templateExtension, styleExtension } = resolveBundleOutputExtensions(outputExtensions)

  if (assets.json) {
    const source = await fs.readFile(assets.json, 'utf8')
    emitSfcJsonAsset(pluginCtx, bundle, relativeBase, { config: source }, {
      emitIfMissingOnly: true,
      extension: jsonExtension,
      kind: 'component',
    })
  }

  if (assets.template) {
    const source = await fs.readFile(assets.template, 'utf8')
    emitSfcTemplateIfMissing(pluginCtx, bundle, relativeBase, source, templateExtension)
  }

  if (assets.style) {
    const source = await fs.readFile(assets.style, 'utf8')
    emitSfcStyleIfMissing(pluginCtx, bundle, relativeBase, source, styleExtension)
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

  const relativeBase = configService.relativeOutputPath(getEntryBaseName(layoutFilePath))
  if (!relativeBase) {
    return
  }

  const { scriptExtension } = resolveBundleOutputExtensions(outputExtensions)
  const scriptFileName = `${relativeBase}.${scriptExtension}`
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
    relativeBase,
    scriptExtension,
  })
}
