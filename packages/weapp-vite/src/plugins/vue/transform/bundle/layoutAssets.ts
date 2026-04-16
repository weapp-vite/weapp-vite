import type { CompilerContext } from '../../../../context'
import type { OutputExtensions } from '../../../../platforms/types'
import { fs } from '@weapp-core/shared/fs'
import {
  emitNativeLayoutScriptChunkIfNeeded as emitSharedNativeLayoutScriptChunkIfNeeded,
  resolveNativeLayoutOutputOptions,
  resolveNativeLayoutStaticAssetEntries,
} from '../../../utils/nativeLayout'
import { ensureScriptlessComponentAsset, resolveScriptlessComponentFileName } from '../../../utils/scriptlessComponent'
import { emitSfcJsonAsset, emitSfcStyleIfMissing, emitSfcTemplateIfMissing } from '../emitAssets'
import { collectNativeLayoutAssets } from '../pageLayout'
import { compileVueLikeFile, getEntryBaseName } from './shared'

export interface ResolvedBundleLayout {
  kind: 'native' | 'vue'
  file: string
}

export function resolveVueLayoutAssetOptions(options: {
  configService: NonNullable<CompilerContext['configService']>
  layoutBasePath: string
  outputExtensions: OutputExtensions | undefined
}) {
  return resolveNativeLayoutOutputOptions(options)
}

export async function emitResolvedBundleLayouts(options: {
  layouts: ResolvedBundleLayout[]
  emitNativeLayout: (layoutFile: string) => Promise<void>
  emitVueLayout: (layoutFile: string) => Promise<void>
}) {
  for (const layout of options.layouts) {
    if (layout.kind === 'native') {
      await options.emitNativeLayout(layout.file)
      continue
    }

    await options.emitVueLayout(layout.file)
  }
}

export async function resolveNativeLayoutScriptChunkState(options: {
  layoutBasePath: string
  configService: NonNullable<CompilerContext['configService']>
  outputExtensions: OutputExtensions | undefined
}) {
  const resolvedOptions = resolveVueLayoutAssetOptions({
    configService: options.configService,
    layoutBasePath: options.layoutBasePath,
    outputExtensions: options.outputExtensions,
  })
  if (!resolvedOptions) {
    return undefined
  }

  const assets = await collectNativeLayoutAssets(options.layoutBasePath)
  if (!assets.script) {
    return undefined
  }

  return {
    fileName: resolveScriptlessComponentFileName(
      resolvedOptions.relativeBase,
      resolvedOptions.scriptExtension,
    ),
    scriptId: assets.script,
  }
}

export async function emitNativeLayoutScriptChunkIfNeeded(options: {
  pluginCtx: any
  layoutBasePath: string
  configService: NonNullable<CompilerContext['configService']>
  outputExtensions: OutputExtensions | undefined
}) {
  const nativeScriptChunkState = await resolveNativeLayoutScriptChunkState(options)
  if (!nativeScriptChunkState) {
    return
  }

  emitSharedNativeLayoutScriptChunkIfNeeded({
    pluginCtx: options.pluginCtx,
    scriptId: nativeScriptChunkState.scriptId,
    fileName: nativeScriptChunkState.fileName,
  })
}

export async function resolveNativeLayoutAssetState(options: {
  layoutBasePath: string
  configService: NonNullable<CompilerContext['configService']>
  outputExtensions: OutputExtensions | undefined
}) {
  const resolvedOptions = resolveVueLayoutAssetOptions({
    configService: options.configService,
    layoutBasePath: options.layoutBasePath,
    outputExtensions: options.outputExtensions,
  })
  if (!resolvedOptions) {
    return undefined
  }

  const assets = await collectNativeLayoutAssets(options.layoutBasePath)

  return {
    resolvedOptions,
    assets,
  }
}

export async function emitResolvedNativeLayoutStaticAssets(options: {
  pluginCtx: any
  bundle: Record<string, any>
  assets: Awaited<ReturnType<typeof collectNativeLayoutAssets>>
  resolvedOptions: NonNullable<ReturnType<typeof resolveVueLayoutAssetOptions>>
}) {
  const staticAssetEntries = await resolveNativeLayoutStaticAssetEntries({
    assets: options.assets,
    resolvedOptions: options.resolvedOptions,
    readFile: fs.readFile,
  })
  for (const asset of staticAssetEntries) {
    if (asset.kind === 'template') {
      emitSfcTemplateIfMissing(
        options.pluginCtx,
        options.bundle,
        options.resolvedOptions.relativeBase,
        asset.source,
        options.resolvedOptions.templateExtension,
      )
      continue
    }
    emitSfcStyleIfMissing(
      options.pluginCtx,
      options.bundle,
      options.resolvedOptions.relativeBase,
      asset.source,
      options.resolvedOptions.styleExtension,
    )
  }
}

export async function emitNativeLayoutAssetsIfNeeded(options: {
  pluginCtx: any
  bundle: Record<string, any>
  layoutBasePath: string
  configService: NonNullable<CompilerContext['configService']>
  outputExtensions: OutputExtensions | undefined
}) {
  const { pluginCtx, bundle } = options
  const nativeLayoutState = await resolveNativeLayoutAssetState(options)
  if (!nativeLayoutState) {
    return
  }

  const { resolvedOptions, assets } = nativeLayoutState

  if (assets.json) {
    const source = await fs.readFile(assets.json, 'utf8')
    emitSfcJsonAsset(pluginCtx, bundle, resolvedOptions.relativeBase, { config: source }, {
      emitIfMissingOnly: true,
      extension: resolvedOptions.jsonExtension,
      kind: 'component',
    })
  }

  await emitResolvedNativeLayoutStaticAssets({
    pluginCtx,
    bundle,
    assets,
    resolvedOptions,
  })
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

export function resolveVueLayoutScriptFallbackState(options: {
  bundle: Record<string, any>
  layoutFilePath: string
  configService: NonNullable<CompilerContext['configService']>
  outputExtensions: OutputExtensions | undefined
}) {
  const resolvedOptions = resolveVueLayoutAssetOptions({
    configService: options.configService,
    layoutBasePath: getEntryBaseName(options.layoutFilePath),
    outputExtensions: options.outputExtensions,
  })
  if (!resolvedOptions) {
    return undefined
  }

  const scriptFileName = resolveScriptlessComponentFileName(
    resolvedOptions.relativeBase,
    resolvedOptions.scriptExtension,
  )
  if (options.bundle[scriptFileName]) {
    return undefined
  }

  return {
    resolvedOptions,
    scriptFileName,
  }
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

  const fallbackState = resolveVueLayoutScriptFallbackState({
    bundle,
    layoutFilePath,
    configService,
    outputExtensions,
  })
  if (!fallbackState) {
    return
  }

  const { resolvedOptions } = fallbackState

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

export function createBundleLayoutEmitters(options: {
  pluginCtx: any
  bundle: Record<string, any>
  ctx: CompilerContext
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
  outputExtensions: OutputExtensions | undefined
}) {
  return {
    emitNativeLayout: async (layoutFilePath: string) => {
      await emitNativeLayoutAssetsIfNeeded({
        pluginCtx: options.pluginCtx,
        bundle: options.bundle,
        layoutBasePath: layoutFilePath,
        configService: options.configService,
        outputExtensions: options.outputExtensions,
      })
    },
    emitVueLayout: async (layoutFilePath: string) => {
      await emitVueLayoutScriptFallbackIfNeeded({
        pluginCtx: options.pluginCtx,
        bundle: options.bundle,
        layoutFilePath,
        ctx: options.ctx,
        configService: options.configService,
        compileOptionsState: options.compileOptionsState,
        outputExtensions: options.outputExtensions,
      })
    },
  }
}

export async function emitBundlePageLayoutsIfNeeded(options: {
  layouts: ResolvedBundleLayout[] | undefined
  pluginCtx: any
  bundle: Record<string, any>
  ctx: CompilerContext
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
  outputExtensions: OutputExtensions | undefined
}) {
  if (!options.layouts?.length) {
    return
  }

  const layoutEmitters = createBundleLayoutEmitters(options)
  await emitResolvedBundleLayouts({
    layouts: options.layouts,
    emitNativeLayout: layoutEmitters.emitNativeLayout,
    emitVueLayout: layoutEmitters.emitVueLayout,
  })
}
