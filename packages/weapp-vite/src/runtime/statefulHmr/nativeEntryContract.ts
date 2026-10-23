import type { StatefulHmrOutputFile } from './outputWriter'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD } from '@weapp-core/constants'
import { readMappedHmrCode, wrapHmrCode } from './mappedCode'

const client = `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]`
const prefix = `(() => {\n"use strict";\nif (${client} && !${client}[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD)}](true)) return;\n`

/** 在最终 CJS 入口的所有依赖之前检查存量客户端，首次启动仍沿原有入口完成初始化。 */
export function protectStatefulHmrNativeEntries(output: StatefulHmrOutputFile[]): void {
  for (const item of output) {
    if (item.type !== 'chunk' || item.isEntry !== true || !item.fileName.endsWith('.js') || item.code.startsWith(prefix)) {
      continue
    }
    item.code = wrapHmrCode(readMappedHmrCode(item.code, item.fileName), prefix, '\n})();\n')
  }
}
