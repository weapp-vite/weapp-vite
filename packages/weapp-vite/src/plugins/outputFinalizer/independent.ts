import type { EmittedAsset, OutputAsset, OutputBundle, OutputChunk, RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import type { TemplateImageSources } from './templateImages'
import path from 'pathe'
import { isBundlerDiagnosticAsset } from '../../runtime/buildPlugin/outputBoundary'
import { normalizePath } from '../../utils/path'
import { withRealpathScope } from '../../utils/realpathScope'
import { readAssetPhysicalPath } from '../asset/sourceIdentity'

type EmitAsset = (asset: EmittedAsset) => void

function toEmittedAsset(output: OutputAsset | OutputChunk): EmittedAsset {
  if (output.type === 'chunk') {
    return {
      type: 'asset',
      fileName: output.fileName,
      name: output.name,
      source: output.code,
    }
  }

  const name = output.names[0] ?? output.name
  const originalFileName = output.originalFileNames[0] ?? output.originalFileName
  return {
    type: 'asset',
    fileName: output.fileName,
    source: output.source,
    ...(name ? { name } : {}),
    ...(originalFileName ? { originalFileName } : {}),
  }
}

function getBundleOutputs(output: RolldownOutput) {
  return Array.isArray(output.output) ? output.output : []
}

/** 在子构建结束前补全同内容图片的已重写来源，供主构建跳过静态复制。 */
export function includeIndependentTemplateImageSources(bundle: OutputBundle, root: string, images: TemplateImageSources) {
  for (const [target, sources] of images) {
    const output = bundle[target]
    if (output?.type !== 'asset') {
      continue
    }
    const originals = new Set(output.originalFileNames.map(source => path.resolve(root, source)))
    const added = [...sources].filter(source => !originals.has(source))
    if (added.length) {
      output.originalFileNames = [...output.originalFileNames, ...added]
    }
  }
}

function collectIndependentSources(ctx: CompilerContext, root: string) {
  const sources = new Set<string>()
  const outputNames = new Set<string>()
  for (const [packageRoot, result] of ctx.runtimeState?.build?.independent?.outputs ?? []) {
    if (!ctx.scanService?.independentSubPackageMap?.has(packageRoot)) {
      continue
    }
    const prefix = `${packageRoot}/`
    const sourceRoot = path.resolve(ctx.configService.absoluteSrcRoot, packageRoot)
    let physicalRoot: string | undefined
    for (const item of getBundleOutputs(result)) {
      if (isBundlerDiagnosticAsset(item) || !item.fileName.startsWith(prefix)) {
        continue
      }
      outputNames.add(item.fileName)
      if (item.type !== 'asset') {
        continue
      }
      for (const original of item.originalFileNames ?? []) {
        const source = normalizePath(path.resolve(root, original))
        if (source.startsWith(`${sourceRoot}/`)) {
          sources.add(source)
          continue
        }
        // 子构建可能保留软链接，按包的物理根还原主构建扫描到的路径。
        const physical = readAssetPhysicalPath(source)
        if (physical && physical !== source) {
          physicalRoot ??= readAssetPhysicalPath(sourceRoot) ?? sourceRoot
          if (physical.startsWith(`${physicalRoot}/`)) {
            sources.add(path.join(sourceRoot, path.relative(physicalRoot, physical)))
          }
        }
      }
    }
  }
  return { sources, outputNames }
}

/** 只交接独立包内由子构建发射的本地资源；公共源码仍由主构建独立决定。 */
export function collectIndependentLocalAssets(ctx: CompilerContext, root: string) {
  return withRealpathScope(() => collectIndependentSources(ctx, root))
}

export function collectIndependentOutputFileNames(ctx: CompilerContext) {
  const names = new Set<string>()
  for (const output of ctx.runtimeState?.build?.independent?.outputs.values() ?? []) {
    for (const item of getBundleOutputs(output)) {
      if (!isBundlerDiagnosticAsset(item)) {
        names.add(item.fileName)
      }
    }
  }
  return [...names]
}

function pruneRemovedIndependentOutputs(ctx: CompilerContext) {
  const independentState = ctx.runtimeState?.build?.independent
  if (!independentState) {
    return
  }
  for (const root of independentState.watchFiles?.keys() ?? []) {
    if (!ctx.scanService.independentSubPackageMap.has(root)) {
      independentState.watchFiles.delete(root)
      independentState.outputs.delete(root)
    }
  }
}

/** 在本轮首次异步等待前冻结有效子产物，后续事件失效只影响下一轮构建。 */
export function captureIndependentOutputFileNames(ctx: CompilerContext) {
  pruneRemovedIndependentOutputs(ctx)
  return collectIndependentOutputFileNames(ctx)
}

/** 冻结首个异步等待之前的独立分包内容，后续失效不改写本轮发布代次。 */
export function captureIndependentOutputAssets(ctx: CompilerContext) {
  return [...ctx.runtimeState?.build?.independent?.outputs.values() ?? []]
    .flatMap(output => getBundleOutputs(output).filter(item => !isBundlerDiagnosticAsset(item)).map(toEmittedAsset))
}

export async function flushIndependentOutputs(
  ctx: CompilerContext,
  subPackageMeta: SubPackageMetaValue | undefined,
  emitAsset: EmitAsset,
) {
  if (subPackageMeta) {
    return
  }

  const independentState = ctx.runtimeState?.build?.independent
  if (!independentState) {
    return
  }
  pruneRemovedIndependentOutputs(ctx)
  const pendingOutputs = independentState.pendingOutputs
  if (pendingOutputs.length === 0) {
    return
  }

  independentState.pendingOutputs = []
  const outputs = await Promise.all(pendingOutputs)
  for (const output of outputs) {
    for (const bundleOutput of getBundleOutputs(output)) {
      if (isBundlerDiagnosticAsset(bundleOutput)) {
        continue
      }
      emitAsset(toEmittedAsset(bundleOutput))
    }
  }
}
