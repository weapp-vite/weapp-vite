export const SCRIPTLESS_COMPONENT_STUB = 'Component({})'
export const SLOT_HOST_SCRIPTLESS_COMPONENT_STUB = 'Component({properties:{vueSlots:{type:null,value:null},__wvSlotOwnerId:{type:String,value:""},__wvSlotScope:{type:null,value:null}}})'

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
  source = SCRIPTLESS_COMPONENT_STUB,
) {
  pluginCtx.emitFile({
    type: 'asset',
    fileName,
    source,
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
  source = SCRIPTLESS_COMPONENT_STUB,
) {
  const fileName = resolveScriptlessComponentFileName(relativeBase, scriptExtension)
  const existing = bundle[fileName]
  if (existing) {
    if (existing.type === 'asset') {
      const current = existing.source?.toString?.() ?? ''
      if (current !== source) {
        existing.source = source
      }
    }
    return fileName
  }

  emitScriptlessComponentAsset(pluginCtx, fileName, source)
  return fileName
}
