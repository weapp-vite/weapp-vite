import type { VueTransformResult } from './types'
import { WE_VU_RUNTIME_APIS } from 'wevu/compiler'
import { RUNTIME_IMPORT_PATH } from '../constants'

export function finalizeResult(
  result: VueTransformResult,
  options: {
    scriptSetupMacroHash?: string
    defineOptionsHash?: string
  },
) {
  if (!result.script || result.script.trim() === '') {
    result.script = `import { ${WE_VU_RUNTIME_APIS.createWevuComponent} } from '${RUNTIME_IMPORT_PATH}';\n${WE_VU_RUNTIME_APIS.createWevuComponent}({});\n`
  }

  if (result.meta && options.scriptSetupMacroHash) {
    result.meta.jsonMacroHash = options.scriptSetupMacroHash
  }
  if (result.meta && options.defineOptionsHash) {
    result.meta.defineOptionsHash = options.defineOptionsHash
  }
}
