import type { ViteDevServer } from 'vite'
import type { HmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import type { WeappVitePluginApi } from '../../types'
import { vi } from 'vitest'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'

/** 观察真实能力请求后等待命令级交接；不以短轮询替代宿主首构完成契约。 */
export async function observeClassicFallback(server: ViteDevServer, save: () => Promise<void>): Promise<HmrRuntimeSession> {
  const api = server.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
  if (!api) {
    throw new Error('Classic fallback fixture did not expose its initial compiler context')
  }
  const runtime = getHmrRuntimeSession(api.ctx)
  const requested = Promise.withResolvers<void>()
  const requestClassic = runtime.requestClassic
  const probe = vi.spyOn(runtime, 'requestClassic').mockImplementation((reason) => {
    requestClassic(reason)
    requested.resolve()
  })
  try {
    await save()
    // 尚未请求时 whenSettled 会立即完成；必须先观察原请求创建的交接任务。
    await requested.promise
    await runtime.whenSettled()
    return runtime
  }
  finally {
    probe.mockRestore()
  }
}
