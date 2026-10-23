import type { NormalizedOutputOptions, OutputBundle } from 'rolldown'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { editOutputChunkCode } from '../../utils/outputChunk'

const prefix = `(() => {\n"use strict";\nif (globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]) return;\n`

/** 仅保护原生 CJS 入口的退役缓存边界，其他模块格式保留其声明与加载语义。 */
export function protectClassicHandoffEntries(bundle: OutputBundle, format: NormalizedOutputOptions['format']): void {
  if (format !== 'cjs') {
    return
  }
  for (const output of Object.values(bundle)) {
    if (output.type !== 'chunk' || !output.isEntry || !output.fileName.endsWith('.js') || output.code.startsWith(prefix)) {
      continue
    }
    editOutputChunkCode(output, code => code.prepend(prefix).append('\n})();\n'))
  }
}
