import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { MpPlatform, SubPackageMetaValue } from '../types'
import type { WxmlSyntax } from '../wxml/remove/lexical'
import type { RewriteWevuInternalRuntimeImportsOptions } from './core/helpers'
import { Buffer } from 'node:buffer'
import { getSupportedMiniProgramDirectivePrefixes } from '@weapp-core/shared'
import { analyzeGlassEaselBundle } from '../analyze/glassEasel'
import { parseGraphOutputModuleId, resolveGraphOutputOwner } from '../moduleGraph/outputMetadata'
import { parseSidecarModuleId } from '../moduleGraph/protocol'
import { getWxmlPlatformTransformOptions } from '../platform'
import { changeFileExtension } from '../utils'
import { resolveScriptModuleTagName } from '../utils/wxmlScriptModule'
import { handleWxml, scanWxml } from '../wxml'
import { resolveWxmlRemoveOptions } from '../wxml/options'
import { createWxmlRemover } from '../wxml/remove'
import { hasManagedCompilerOutputMarker, isManagedCompilerEntry } from './compilerPluginRegistry'
import { rewriteWevuInternalRuntimeImports, stabilizeWevuRuntimeChunkAccess } from './core/helpers'
import { consumePendingOwnerStyleSources } from './css'
import { transformI18nOutputTemplate } from './i18n'
import { createOutputAssetTransaction } from './outputFinalizer/assets'
import { restoreNativePageLayoutOutputs } from './outputFinalizer/pageLayout'
import { normalizeClassScopedAssets } from './outputFinalizer/scopedStyles'
import { collectXmlTemplates } from './outputFinalizer/wxmlSyntax'

export { createOutputPublicationPlugin, pruneUnchangedDevHmrOutputs, pruneUneventedDevHmrChunks } from './outputFinalizer/publication'

const PREPROCESSOR_STYLE_ASSET_RE = /\.(?:less|sass|scss|styl|stylus|pcss|postcss|sss)$/i
const TEMPLATE_ASSET_RE = /\.(?:wxml|axml|swan|ttml|jxml|qml|ksml|xhsml)$/i
const TEMPLATE_STATIC_REWRITE_MARKERS = [
  '@',
  '#ifdef',
  '#endif',
  '<wxs',
  '</wxs',
  '<sjs',
  '</sjs',
  '.html',
  '.wxs',
  '.sjs',
  '.wxml',
  '.axml',
  '.swan',
  '.ttml',
  '.jxml',
  '.qml',
  '.ksml',
  '.xhsml',
  'import.meta.',
  'wx-if',
  'wx-for',
] as const
const TEMPLATE_DIRECTIVE_PREFIXES = getSupportedMiniProgramDirectivePrefixes()
type EmitAsset = (asset: EmittedAsset) => void
interface OutputAssetEntry {
  bundleFileName: string
  output: Extract<OutputBundle[string], { type: 'asset' }>
}

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

export function mayNeedTemplateNormalization(code: string, platform?: MpPlatform) {
  let lowerCode: string | undefined
  const readLowerCode = () => {
    lowerCode ??= code.toLowerCase()
    return lowerCode
  }
  const hasUppercase = /[A-Z]/.test(code)
  const { directivePrefix, eventBindingStyle, normalizeComponentTagName } = getWxmlPlatformTransformOptions(platform)
  if (normalizeComponentTagName && hasUppercase) {
    return true
  }

  for (const prefix of TEMPLATE_DIRECTIVE_PREFIXES) {
    if (prefix !== directivePrefix) {
      const marker = prefix === 's' ? 's-' : `${prefix}:`
      if (code.includes(marker)) {
        return true
      }
    }
  }

  if (eventBindingStyle === 'alipay' && (
    readLowerCode().includes('bind')
    || readLowerCode().includes('catch')
    || readLowerCode().includes('capture-')
    || readLowerCode().includes('mut-bind')
  )) {
    return true
  }

  const normalizedCode = hasUppercase ? readLowerCode() : code
  return TEMPLATE_STATIC_REWRITE_MARKERS.some(marker => normalizedCode.includes(marker))
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

function normalizeTemplateAssetEntries(
  ctx: CompilerContext,
  entries: OutputAssetEntry[],
  bundle: OutputBundle,
  options: { inputs: Map<string, string>, partial: boolean, subPackageMeta?: SubPackageMetaValue },
) {
  const { configService } = ctx
  const { inputs, partial, subPackageMeta } = options
  if (!partial) {
    inputs.clear()
  }
  const removeOptions = resolveWxmlRemoveOptions(configService?.weappViteConfig?.wxml)
  const remove = createWxmlRemover(removeOptions)
  const active = Boolean(removeOptions.comment || removeOptions.attr?.length || removeOptions.tag?.length)
  const defaultSyntax: WxmlSyntax = (configService?.platform ?? 'weapp') === 'weapp' ? 'legacy' : 'xml'
  let needsSyntax = false
  // 先完成全部必需转换，再固定输入；可选节点删除不能改变其他模板的编译器归属。
  for (const { bundleFileName, output } of entries) {
    const fileName = output.fileName || bundleFileName
    const source = output.source
    const code = typeof source === 'string'
      ? source
      : source instanceof Uint8Array
        ? Buffer.from(source).toString('utf8')
        : undefined
    if (code === undefined) {
      continue
    }
    let normalized = code
    if (mayNeedTemplateNormalization(code, configService?.platform)) {
      const token = scanWxml(code, { platform: configService?.platform })
      normalized = handleWxml(token, {
        removeComment: false,
        scriptModuleExtension: configService?.outputExtensions?.wxs,
        scriptModuleTag: resolveScriptModuleTagName({
          platform: configService?.platform,
          scriptModuleExtension: configService?.outputExtensions?.wxs,
        }),
        templateExtension: configService?.outputExtensions?.wxml,
      }).code
    }
    const localized = transformI18nOutputTemplate(ctx, fileName, normalized, subPackageMeta)
    inputs.set(fileName, localized)
    if (localized !== code) {
      output.source = localized
    }
    needsSyntax ||= active && defaultSyntax === 'legacy' && localized.includes('\\')
  }
  if (defaultSyntax === 'legacy') {
    for (const [key, output] of Object.entries(bundle)) {
      const fileName = output.fileName || key
      if (output.type !== 'asset' || !fileName.endsWith('.json')) {
        continue
      }
      // 只记录组件/页面及 app/plugin 配置；复制的数据 JSON 不是编译器配置。
      if (!/(?:^|\/)(?:app|plugin)\.json$/.test(fileName)
        && !inputs.has(fileName)
        && !inputs.has(changeFileExtension(fileName, configService?.outputExtensions?.wxml ?? 'wxml'))
        && !bundle[changeFileExtension(fileName, 'js')]
        && !ctx.runtimeState?.json?.emittedSource.has(fileName)) {
        continue
      }
      inputs.set(fileName, typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString('utf8'))
    }
  }
  // 两种词法仅在反斜杠处不同；普通模板不读取配置依赖闭包。
  const xmlTemplates = needsSyntax ? collectXmlTemplates(ctx, inputs, subPackageMeta) : undefined
  for (const { bundleFileName, output } of entries) {
    const fileName = output.fileName || bundleFileName
    const code = inputs.get(fileName)
    if (code === undefined) {
      continue
    }
    const transformed = remove(code, fileName, xmlTemplates?.has(fileName) ? 'xml' : defaultSyntax)
    if (transformed !== code) {
      output.source = transformed
    }
  }
}

export function normalizeTemplateAssets(
  ctx: CompilerContext,
  bundle: OutputBundle,
) {
  normalizeTemplateAssetEntries(ctx, collectOutputFinalizerAssetEntries(bundle).templateAssets, bundle, { inputs: new Map(), partial: false })
}

export function createOutputFinalizerPlugin(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin {
  let preserveCompleteBundle = false
  // 每个构建实例保留 UTF-8 编译输入；输出比较指纹（尤其二进制 base64）不能用作源文本。
  const templateInputs = new Map<string, string>()
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
    configResolved(config) {
      // 原生引擎发布完整模块注册图；classic 按源事件裁剪会破坏其重载输出。
      preserveCompleteBundle = config.experimental?.bundledDev === true
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
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
        normalizeTemplateAssetEntries(ctx, assetEntries.templateAssets, outputBundle, { inputs: templateInputs, partial, subPackageMeta })
        if (ctx.configService.platform === 'alipay' || ctx.configService.platform === 'tt') {
          normalizeClassScopedAssets(outputBundle, ctx.configService.outputExtensions)
        }
        assets.publish(asset => this.emitFile(asset))
      },
    },
  }
}
