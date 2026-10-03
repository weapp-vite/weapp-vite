import type { EmittedAsset, OutputAsset, OutputChunk, RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import { isBundlerDiagnosticAsset } from '../../runtime/buildPlugin/outputBoundary'

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
  for (const root of independentState.watchFiles?.keys() ?? []) {
    if (!ctx.scanService.independentSubPackageMap.has(root)) {
      independentState.watchFiles.delete(root)
      independentState.outputs.delete(root)
    }
  }
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
