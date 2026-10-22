import type { Readable, Writable } from 'node:stream'
import type { Plugin } from 'vite'
import process from 'node:process'
import { createInterface } from 'node:readline'

export const NATIVE_BATCH_SETTLEMENT_PREFIX = '[native-batch-settlement] '

/** 仅供夹具从构建事务外等待现有宿主发布边界；不创建产品端点或主动触发构建。 */
export function nativeBatchSettlementPlugin(options: { input?: Readable, output?: Writable } = {}): Plugin {
  return {
    name: 'e2e:native-batch-settlement',
    configureServer(server) {
      const owner = server.config.plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')
      // classic 的模块图宿主不拥有 stateful 队列；其发布由独立 native publication 观察。
      // 不挂载输入监听器，也不能用已完成 Promise 伪造旧会话的 settlement。
      if (!owner) {
        return
      }
      const api: unknown = owner.api
      if (!api || typeof api !== 'object' || !('whenSettled' in api) || typeof api.whenSettled !== 'function') {
        throw new Error('Native batch observation requires the stateful session settlement API')
      }
      const whenSettled = api.whenSettled.bind(api)
      const output = options.output ?? process.stdout
      const lines = createInterface({ input: options.input ?? process.stdin, terminal: false })
      let closed = false
      const respond = (response: Record<string, unknown>) => {
        output.write(`${NATIVE_BATCH_SETTLEMENT_PREFIX}${JSON.stringify(response)}\n`)
      }
      const settle = async (line: string) => {
        let id: string | undefined
        try {
          const request: unknown = JSON.parse(line.slice(NATIVE_BATCH_SETTLEMENT_PREFIX.length))
          if (!request || typeof request !== 'object' || !('id' in request) || typeof request.id !== 'string' || !request.id) {
            throw new Error('Invalid native batch settlement request')
          }
          id = request.id
          await whenSettled()
          if (closed) {
            throw new Error('Native batch settlement observer closed before acknowledgement')
          }
          respond({ id, status: 'complete' })
        }
        catch (error) {
          respond({ id, status: 'failed', error: error instanceof Error ? error.message : String(error) })
        }
      }
      const onLine = (line: string) => {
        if (line.startsWith(NATIVE_BATCH_SETTLEMENT_PREFIX)) {
          void settle(line)
        }
      }
      lines.on('line', onLine)
      const closeServer = server.close.bind(server)
      // 快照也复用插件实例；监听器只归实际宿主关闭所有，不挂在 closeBundle 上。
      server.close = async () => {
        closed = true
        lines.off('line', onLine)
        lines.close()
        await closeServer()
      }
    },
  }
}
