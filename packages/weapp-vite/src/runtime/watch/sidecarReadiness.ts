import type { FSWatcher } from 'chokidar'

const SIDECAR_WATCHER_READY_TIMEOUT_MS = 30_000

type SidecarReadiness = 'ready' | 'closed'

/** 初始扫描与本代关闭共同终结就绪观察；关闭不冒充扫描完成，也不覆盖原始错误。 */
export function createSidecarWatcherReadiness(watcher: Pick<FSWatcher, 'once' | 'off'>) {
  const candidate = watcher as { off?: unknown, once?: unknown }
  if (typeof candidate.once !== 'function' || typeof candidate.off !== 'function') {
    return { ready: Promise.resolve<SidecarReadiness>('ready'), close() {} }
  }

  const completion = Promise.withResolvers<SidecarReadiness>()
  let settled = false
  let timer: ReturnType<typeof setTimeout>
  let cleanup = () => {}
  const finish = (readiness: SidecarReadiness) => {
    if (!settled) {
      settled = true
      cleanup()
      completion.resolve(readiness)
    }
  }
  const onReady = () => finish('ready')
  const onError = (error: unknown) => {
    if (!settled) {
      settled = true
      cleanup()
      completion.reject(error)
    }
  }
  cleanup = () => {
    clearTimeout(timer)
    watcher.off('ready', onReady)
    watcher.off('error', onError)
  }
  timer = setTimeout(() => {
    onError(new Error('Sidecar watcher ready timed out'))
  }, SIDECAR_WATCHER_READY_TIMEOUT_MS)
  watcher.once('ready', onReady)
  watcher.once('error', onError)

  return {
    ready: completion.promise,
    close: () => finish('closed'),
  }
}
