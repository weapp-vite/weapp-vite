import type { EmittedAsset, OutputBundle } from 'rolldown'

/** 在同一内存视图完成资源规范化与去重，再交还 bundler 发布。 */
export function createOutputAssetTransaction(bundle: OutputBundle) {
  const normalized = { ...bundle }
  const staged = new Map<string, EmittedAsset>()
  const stage = (asset: EmittedAsset) => {
    if (!asset.fileName || asset.source === undefined) {
      throw new Error('Output normalization requires an explicit asset fileName and source')
    }
    staged.set(asset.fileName, asset)
    normalized[asset.fileName] = {
      type: 'asset',
      fileName: asset.fileName,
      source: asset.source,
      names: asset.name ? [asset.name] : [],
      originalFileNames: asset.originalFileName ? [asset.originalFileName] : [],
    } as OutputBundle[string]
  }
  const publish = (emit: (asset: EmittedAsset) => void) => {
    for (const fileName of Object.keys(bundle)) {
      if (!normalized[fileName]) {
        delete bundle[fileName]
      }
    }
    for (const [fileName, asset] of staged) {
      const output = normalized[fileName]
      if (output?.type === 'asset') {
        emit({ ...asset, source: output.source })
      }
    }
    // 已有输出共享 bundler 对象，原位变更已生效；新增资源必须经 emitFile 发布。
    for (const [fileName, output] of Object.entries(normalized)) {
      if (staged.has(fileName) || bundle[fileName]) {
        continue
      }
      if (output.type !== 'asset') {
        throw new Error(`Output normalization cannot create a chunk during generateBundle: ${fileName}`)
      }
      emit({
        type: 'asset',
        fileName,
        source: output.source,
        name: output.names[0],
        originalFileName: output.originalFileNames[0],
      })
    }
  }
  return { bundle: normalized, stage, publish }
}
