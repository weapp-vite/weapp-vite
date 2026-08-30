import type { Plugin } from 'vite'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { parseSidecarSourceRequest } from '../../moduleGraph/protocol'

export function createStatefulHmrSidecarModuleCode(id: string, source: string): string | undefined {
  const request = parseSidecarSourceRequest(id)
  if (!request || request.kind === 'style') {
    return
  }
  const digest = createHash('sha256').update(source).digest('hex')
  return `export default ${JSON.stringify(digest)};\n`
}

export function createStatefulHmrSidecarPlugin(): Plugin {
  return {
    name: 'weapp-vite:stateful-hmr-sidecar',
    enforce: 'pre',
    async load(id) {
      // 内部虚拟模块由其 owning plugin 负责加载，不能当作文件路径读取。
      if (id.includes('\0')) {
        return
      }
      const request = parseSidecarSourceRequest(id)
      if (!request) {
        return
      }
      this.addWatchFile(request.sourceId)
      const source = await readFile(request.sourceId, 'utf8')
      if (request.kind === 'style') {
        return source
      }
      const code = createStatefulHmrSidecarModuleCode(id, source)
      return code ? { code, moduleSideEffects: 'no-treeshake' } : undefined
    },
  }
}
