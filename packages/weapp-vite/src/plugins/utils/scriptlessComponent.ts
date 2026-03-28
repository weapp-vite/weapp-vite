export const SCRIPTLESS_COMPONENT_STUB = 'Component({})'

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
