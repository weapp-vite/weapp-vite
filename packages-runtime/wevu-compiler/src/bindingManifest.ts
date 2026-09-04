import type {
  WevuBindingManifestV1,
  WevuRuntimeBindingManifestMode,
  WevuRuntimeBindingManifestV1,
  WevuRuntimeBindingRecordV1,
} from './types/bindingManifest'

/**
 * 将编译期完整 IR 投影为运行时更新和诊断所需的最小元数据。
 */
export function createRuntimeBindingManifest(
  manifest: WevuBindingManifestV1,
  mode: WevuRuntimeBindingManifestMode = 'compact',
): WevuRuntimeBindingManifestV1 {
  const bindings = manifest.bindings.map((binding): WevuRuntimeBindingRecordV1 => ({
    id: binding.id,
    outputPath: binding.outputPath,
    ...(binding.updateMode === 'exact-path' ? {} : { updateMode: binding.updateMode }),
    ...(binding.updateMode === 'snapshot-fallback' && binding.sourceRoots.length
      ? { sourceRoots: binding.sourceRoots }
      : {}),
    ...(mode === 'diagnostic' && binding.sourceLocation
      ? { sourceLocation: binding.sourceLocation }
      : {}),
  }))
  const features = manifest.features.scopedSlots
    ? { scopedSlots: true as const }
    : undefined

  return {
    version: 1,
    sourceFile: manifest.sourceFile,
    bindings,
    ...(features ? { features } : {}),
  }
}
