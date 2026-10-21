import type { ViteDevServer } from 'vite'
import type { HmrRuntimeSession } from '../runtime/hmrRuntimeSession'

/** 停止失败的宿主时同时保留原始错误与清理错误。 */
export async function rethrowAfterHostCleanup(error: unknown, cleanup: () => Promise<void>): Promise<never> {
  try {
    await cleanup()
  }
  catch (cleanupError) {
    if (cleanupError === error) {
      throw error
    }
    throw new AggregateError([error, cleanupError], 'Host operation and cleanup failed', { cause: error })
  }
  throw error
}

/** 通过公共宿主重启交接到 classic，当前构建只发布请求，不等待关闭自己。 */
export function bindClassicFallback(server: ViteDevServer, runtime: HmrRuntimeSession): () => void {
  return runtime.bindRequest(async () => {
    try {
      await server.restart()
    }
    catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error))
      server.config.logger.error('[weapp-vite] classic 回退失败，开发会话已停止。', { error: failure })
      await rethrowAfterHostCleanup(failure, () => server.close())
    }
  })
}
