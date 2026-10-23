import type { OutputBundle } from 'rolldown'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { editOutputChunkCode } from '../../utils/outputChunk'

const prefix = `(() => {\n"use strict";\nif (globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]) return;\n`

/** 退役 realm 仍可能重放新入口；完整重载清空旧客户端和 CJS 缓存后才执行 classic 依赖。 */
export function protectClassicHandoffEntries(bundle: OutputBundle): void {
  for (const output of Object.values(bundle)) {
    if (output.type !== 'chunk' || !output.isEntry || !output.fileName.endsWith('.js') || output.code.startsWith(prefix)) {
      continue
    }
    editOutputChunkCode(output, code => code.prepend(prefix).append('\n})();\n'))
  }
}
