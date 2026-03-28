export const SCRIPTLESS_COMPONENT_STUB = 'Component({})'

/**
 * 统一生成无脚本组件的脚本产物文件名。
 */
export function resolveScriptlessComponentFileName(
  relativeBase: string,
  scriptExtension: string,
) {
  return `${relativeBase}.${scriptExtension}`
}

export function emitScriptlessComponentAsset(
  pluginCtx: {
    emitFile: (file: { type: 'asset', fileName: string, source: string }) => void
  },
  fileName: string,
) {
  pluginCtx.emitFile({
    type: 'asset',
    fileName,
    source: SCRIPTLESS_COMPONENT_STUB,
  })
}

/**
 * 在 bundle 中补齐或覆盖无脚本组件占位脚本。
 */
export function ensureScriptlessComponentAsset(
  pluginCtx: {
    emitFile: (file: { type: 'asset', fileName: string, source: string }) => void
  },
  bundle: Record<string, any>,
  relativeBase: string,
  scriptExtension: string,
) {
  const fileName = resolveScriptlessComponentFileName(relativeBase, scriptExtension)
  const existing = bundle[fileName]
  if (existing) {
    if (existing.type === 'asset') {
      const current = existing.source?.toString?.() ?? ''
      if (current !== SCRIPTLESS_COMPONENT_STUB) {
        existing.source = SCRIPTLESS_COMPONENT_STUB
      }
    }
    return fileName
  }

  emitScriptlessComponentAsset(pluginCtx, fileName)
  return fileName
}
