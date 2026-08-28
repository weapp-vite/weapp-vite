import type { VueSfcHmrSignatures } from 'wevu/compiler'
import type { RuntimeState } from './runtimeState'

/**
 * 把编译器生成的 SFC 语义快照注册到 Vite HMR 运行状态。
 */
export function storeVueSfcHmrSignatures(
  hmr: RuntimeState['build']['hmr'],
  filename: string,
  signatures: VueSfcHmrSignatures,
) {
  if (signatures.blockSignatures) {
    hmr.vueEntrySfcSignatures.set(filename, signatures.blockSignatures)
  }
  if (signatures.tailwindContentSignature) {
    hmr.vueEntryTailwindContentSignatures.set(filename, signatures.tailwindContentSignature)
  }
  if (signatures.tailwindTemplateContentSignature) {
    hmr.vueEntryTailwindTemplateContentSignatures.set(filename, signatures.tailwindTemplateContentSignature)
  }
  if (signatures.tailwindScriptContentSignature) {
    hmr.vueEntryTailwindScriptContentSignatures.set(filename, signatures.tailwindScriptContentSignature)
  }
  if (signatures.hasTemplate !== undefined) {
    hmr.vueEntryHasTemplate.set(filename, signatures.hasTemplate)
  }
}
