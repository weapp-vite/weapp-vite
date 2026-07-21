import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { OutputExtensions } from '../../../../platforms/types'
import type { VueBundleCompileOptionsState } from './shared'
import { fs } from '@weapp-core/shared/fs'
import {
  resolveNativeLayoutOutputOptions,
  resolveNativeLayoutStaticAssetEntries,
} from '../../../utils/nativeLayout'
import { ensureScriptlessComponentAsset, resolveScriptlessComponentFileName, SLOT_HOST_SCRIPTLESS_COMPONENT_STUB } from '../../../utils/scriptlessComponent'
import { emitSfcJsonAsset, emitSfcStyleIfMissing, emitSfcTemplateIfMissing } from '../emitAssets'
import { assertTemplateHasDefaultSlot, collectNativeLayoutAssets } from '../pageLayout'
import { compileVueLikeFile, getEntryBaseName } from './shared'
import { emitBundleVueEntryAssets, emitSharedVueEntryJsonAsset } from './shared/assets'

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
      assertTemplateHasDefaultSlot({
        filename: options.assets.template!,
        kind: 'page-layout',
        template: asset.source,
      })
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
  source?: string
}) {
  const { pluginCtx, bundle, relativeBase, scriptExtension, source } = options
  ensureScriptlessComponentAsset(pluginCtx, bundle, relativeBase, scriptExtension, source)
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
  compileOptionsState: VueBundleCompileOptionsState
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

  assertTemplateHasDefaultSlot({
    filename: layoutFilePath,
    kind: 'page-layout',
    template: result.template,
  })

  if (result.script?.trim()) {
    return
  }

  emitScriptlessComponentJsFallbackIfMissing({
    pluginCtx,
    bundle,
    relativeBase: resolvedOptions.relativeBase,
    scriptExtension: resolvedOptions.scriptExtension,
    source: SLOT_HOST_SCRIPTLESS_COMPONENT_STUB,
  })
}

export function createBundleLayoutEmitters(options: {
  pluginCtx: any
  bundle: Record<string, any>
  ctx: CompilerContext
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
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
  compileOptionsState: VueBundleCompileOptionsState
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

function resolveAppShellComponentConfig(config: string | undefined) {
  const shellConfig: Record<string, any> = {
    styleIsolation: 'apply-shared',
  }

  if (!config) {
    return JSON.stringify(shellConfig, null, 2)
  }

  try {
    const parsed = JSON.parse(config)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return JSON.stringify(shellConfig, null, 2)
    }

    for (const key of ['usingComponents', 'componentGenerics']) {
      const value = parsed[key]
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        shellConfig[key] = value
      }
    }

    return Object.keys(shellConfig).length
      ? JSON.stringify(shellConfig, null, 2)
      : undefined
  }
  catch {
    return undefined
  }
}

export function emitAppShellAssetsIfNeeded(options: {
  bundle: Record<string, any>
  pluginCtx: any
  ctx: CompilerContext
  filename: string
  relativeBase: string | undefined
  result: Pick<VueTransformResult, 'template' | 'style' | 'config' | 'classStyleWxs' | 'scopedSlotComponents'>
  configService: NonNullable<CompilerContext['configService']>
  templateExtension: string
  jsonExtension: string
  scriptExtension: string
  scriptModuleExtension?: string
  outputExtensions: NonNullable<CompilerContext['configService']>['outputExtensions']
  platformAssetOptions: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  }
}) {
  const { relativeBase, result } = options
  if (!relativeBase || !result.template?.trim()) {
    return
  }

  assertTemplateHasDefaultSlot({
    filename: options.filename,
    kind: 'app-shell',
    template: result.template,
  })

  emitBundleVueEntryAssets({
    bundle: options.bundle,
    pluginCtx: options.pluginCtx,
    ctx: options.ctx,
    filename: relativeBase,
    relativeBase,
    result: result as VueTransformResult,
    configService: options.configService,
    templateExtension: options.templateExtension,
    scriptModuleExtension: options.scriptModuleExtension,
    outputExtensions: options.outputExtensions,
    platformAssetOptions: options.platformAssetOptions,
  })

  emitSharedVueEntryJsonAsset({
    bundle: options.bundle,
    pluginCtx: options.pluginCtx,
    relativeBase,
    config: resolveAppShellComponentConfig(result.config),
    outputExtensions: options.outputExtensions,
    platformAssetOptions: options.platformAssetOptions,
    jsonOptions: {
      defaultConfig: { component: true },
      kind: 'component',
      extension: options.jsonExtension,
    },
  })

  emitScriptlessComponentJsFallbackIfMissing({
    pluginCtx: options.pluginCtx,
    bundle: options.bundle,
    relativeBase,
    scriptExtension: options.scriptExtension,
    source: SLOT_HOST_SCRIPTLESS_COMPONENT_STUB,
  })
}
