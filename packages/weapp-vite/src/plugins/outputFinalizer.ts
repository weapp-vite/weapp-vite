import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { SubPackageMetaValue } from '../types'
import type { RewriteWevuInternalRuntimeImportsOptions } from './core/helpers'
import type { OutputAssetEntry } from './outputFinalizer/templates'
import { analyzeGlassEaselBundle } from '../analyze/glassEasel'
import { parseGraphOutputModuleId, resolveGraphOutputOwner } from '../moduleGraph/outputMetadata'
import { parseSidecarModuleId } from '../moduleGraph/protocol'
import { changeFileExtension } from '../utils'
import { observeWxmlTransformDependencies } from '../wxml/transform/dependencies'
import { hasManagedCompilerOutputMarker, isManagedCompilerEntry } from './compilerPluginRegistry'
import { rewriteWevuInternalRuntimeImports, stabilizeWevuRuntimeChunkAccess } from './core/helpers'
import { consumePendingOwnerStyleSources } from './css'
import { createOutputAssetTransaction } from './outputFinalizer/assets'
import { restoreNativePageLayoutOutputs } from './outputFinalizer/pageLayout'
import { normalizeClassScopedAssets } from './outputFinalizer/scopedStyles'
import { normalizeTemplateAssetEntries } from './outputFinalizer/templates'

export { createOutputPublicationPlugin, pruneUnchangedDevHmrOutputs, pruneUneventedDevHmrChunks } from './outputFinalizer/publication'

export { mayNeedTemplateNormalization } from './outputFinalizer/templates'

const PREPROCESSOR_STYLE_ASSET_RE = /\.(?:less|sass|scss|styl|stylus|pcss|postcss|sss)$/i
const TEMPLATE_ASSET_RE = /\.(?:wxml|axml|swan|ttml|jxml|qml|ksml|xhsml)$/i
type EmitAsset = (asset: EmittedAsset) => void

export function normalizeGraphOnlyAssets(
  ctx: CompilerContext,
  bundle: OutputBundle,
  emitAsset: EmitAsset,
) {
  for (const [bundleFileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'asset') {
      continue
    }
    const fileName = output.fileName || bundleFileName
    const moduleId = parseGraphOutputModuleId(fileName)
    const sidecar = moduleId ? parseSidecarModuleId(moduleId) : undefined
    if (
      sidecar?.kind === 'style'
      && isManagedCompilerEntry(ctx, sidecar.sourceId)
      && !hasManagedCompilerOutputMarker(output.source.toString())
    ) {
      delete bundle[bundleFileName]
      continue
    }
    const ownerId = resolveGraphOutputOwner(fileName)
    if (!ownerId) {
      continue
    }
    delete bundle[bundleFileName]
    const outputFileName = ctx.configService.relativeOutputPath(
      changeFileExtension(ownerId, ctx.configService.outputExtensions.wxss),
    )
    if (!outputFileName) {
      continue
    }
    const existingOutput = bundle[outputFileName]
    if (existingOutput?.type === 'asset') {
      existingOutput.source = output.source
      existingOutput.fileName = outputFileName
      continue
    }
    if (!existingOutput) {
      emitAsset({
        type: 'asset',
        fileName: outputFileName,
        source: output.source,
      })
    }
  }
}

function collectOutputFinalizerAssetEntries(bundle: OutputBundle) {
  const preprocessorStyleAssets: OutputAssetEntry[] = []
  const templateAssets: OutputAssetEntry[] = []

  for (const [bundleFileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'asset') {
      continue
    }
    const fileName = output.fileName || bundleFileName
    if (PREPROCESSOR_STYLE_ASSET_RE.test(fileName)) {
      preprocessorStyleAssets.push({ bundleFileName, output })
    }
    if (TEMPLATE_ASSET_RE.test(fileName)) {
      templateAssets.push({ bundleFileName, output })
    }
  }

  return {
    preprocessorStyleAssets,
    templateAssets,
  }
}

function mergePendingOwnerStyleSources(ctx: CompilerContext, bundle: OutputBundle) {
  const pending = consumePendingOwnerStyleSources(ctx)
  if (!pending) {
    return
  }

  for (const [fileName, fragments] of pending) {
    const output = bundle[fileName]
      ?? Object.values(bundle).find(candidate => candidate.type === 'asset' && candidate.fileName === fileName)
    if (output?.type !== 'asset') {
      continue
    }
    const source = output.source.toString()
    const missing = fragments.filter(fragment => !source.includes(fragment))
    if (!missing.length) {
      continue
    }
    output.source = `${source.trimEnd()}\n${missing.join('\n')}\n`
  }
}

function normalizePreprocessorStyleAssetEntries(
  bundle: OutputBundle,
  entries: OutputAssetEntry[],
  styleExtension: string | undefined,
  emitAsset: EmitAsset,
) {
  if (!styleExtension) {
    return
  }

  for (const { bundleFileName, output } of entries) {
    const fileName = output.fileName || bundleFileName
    const outputFileName = changeFileExtension(fileName, styleExtension)
    if (!outputFileName || outputFileName === fileName) {
      continue
    }

    const existingOutput = bundle[outputFileName]
    delete bundle[bundleFileName]
    if (existingOutput?.type === 'asset') {
      existingOutput.source = output.source
      existingOutput.fileName = outputFileName
      continue
    }
    if (existingOutput) {
      continue
    }

    output.fileName = outputFileName
    const [name] = output.names ?? []
    const [originalFileName] = output.originalFileNames ?? []
    emitAsset({
      type: 'asset',
      fileName: outputFileName,
      ...(name ? { name } : {}),
      ...(originalFileName ? { originalFileName } : {}),
      source: output.source,
    })
  }
}

export function normalizePreprocessorStyleAssets(
  bundle: OutputBundle,
  styleExtension: string | undefined,
  emitAsset: EmitAsset,
) {
  if (!styleExtension) {
    return
  }

  normalizePreprocessorStyleAssetEntries(
    bundle,
    collectOutputFinalizerAssetEntries(bundle).preprocessorStyleAssets,
    styleExtension,
    emitAsset,
  )
}

export async function normalizeTemplateAssets(
  ctx: CompilerContext,
  bundle: OutputBundle,
) {
  await normalizeTemplateAssetEntries(ctx, collectOutputFinalizerAssetEntries(bundle).templateAssets)
}

export function createOutputFinalizerPlugin(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin {
  let preserveCompleteBundle = false
  let unobserve: (() => void) | undefined
  const wevuRuntimeRewriteOptions: RewriteWevuInternalRuntimeImportsOptions = {
    get runtimeFileName() {
      return ctx.runtimeState?.build?.output?.wevuInternalRuntimeFileName
    },
    get runtimeFileNames() {
      return ctx.runtimeState?.build?.output?.wevuInternalRuntimeFileNames
    },
    isRuntimeFileNameAvailable(fileName) {
      return ctx.runtimeState?.build?.output?.emittedSource.has(fileName) === true
    },
    onRuntimeFileName(fileName) {
      const outputState = ctx.runtimeState?.build?.output
      if (outputState) {
        outputState.wevuInternalRuntimeFileName = fileName
      }
    },
    onRuntimeModuleFileName(moduleId, fileName) {
      const outputState = ctx.runtimeState?.build?.output
      if (outputState) {
        outputState.wevuInternalRuntimeFileNames ??= new Map<string, string>()
        outputState.wevuInternalRuntimeFileNames.set(moduleId, fileName)
      }
    },
  }

  return {
    name: 'weapp-vite:output-finalizer',
    enforce: 'post',
    configureServer(server) {
      unobserve = observeWxmlTransformDependencies(ctx, files => server.watcher.add(files))
      server.httpServer?.once('close', () => unobserve?.())
    },
    closeWatcher() { unobserve?.() },
    configResolved(config) {
      // 原生引擎发布完整模块注册图；classic 按源事件裁剪会破坏其重载输出。
      preserveCompleteBundle = config.experimental?.bundledDev === true
    },
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        const assets = createOutputAssetTransaction(bundle as unknown as OutputBundle)
        const outputBundle = assets.bundle
        mergePendingOwnerStyleSources(ctx, outputBundle)
        rewriteWevuInternalRuntimeImports(outputBundle, wevuRuntimeRewriteOptions)
        stabilizeWevuRuntimeChunkAccess(outputBundle)
        restoreNativePageLayoutOutputs(ctx, outputBundle)
        normalizeGraphOnlyAssets(ctx, outputBundle, assets.stage)
        const assetEntries = collectOutputFinalizerAssetEntries(outputBundle)
        const partial = !preserveCompleteBundle
          && ctx.runtimeState?.build?.hmr?.didEmitAllEntries !== true
          && ctx.runtimeState?.build?.hmr?.profile?.event !== undefined
        if (ctx.configService.platform === 'weapp') {
          // 在 HMR 裁剪前消费本轮事实；full 也只替换当前构建实例的精确 scope。
          analyzeGlassEaselBundle(ctx, outputBundle, {
            mode: partial ? 'partial' : 'full',
            outputScope: subPackageMeta
              ? `independent:${subPackageMeta.subPackage.root}`
              : 'main',
          })
        }
        normalizePreprocessorStyleAssetEntries(
          outputBundle,
          assetEntries.preprocessorStyleAssets,
          ctx.configService.outputExtensions?.wxss,
          assets.stage,
        )
        await normalizeTemplateAssetEntries(ctx, assetEntries.templateAssets, subPackageMeta, {
          addWatchFile: file => this.addWatchFile?.(file),
          warn: message => this.warn(message),
          partial,
        })
        if (ctx.configService.platform === 'alipay' || ctx.configService.platform === 'tt') {
          normalizeClassScopedAssets(outputBundle, ctx.configService.outputExtensions)
        }
        assets.publish(asset => this.emitFile(asset))
      },
    },
  }
}
