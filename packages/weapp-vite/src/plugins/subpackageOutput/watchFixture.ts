import type { RolldownWatcher, RolldownWatcherEvent } from 'rolldown'

export function waitForAssetBuild(watcher: RolldownWatcher, verify: () => Promise<boolean>, change?: () => Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    let cleanup: () => void
    function finish(error?: unknown) {
      cleanup()
      if (error) {
        reject(error)
      }
      else {
        resolve()
      }
    }
    async function onEvent(event: RolldownWatcherEvent) {
      if (event.code === 'ERROR') {
        finish(event.error)
      }
      if (event.code === 'BUNDLE_END') {
        try {
          if (await verify()) {
            finish()
          }
        }
        catch (error) {
          finish(error)
        }
      }
    }
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for the requested watch generation')), 8_000)
    cleanup = () => {
      clearTimeout(timeout)
      watcher.off('event', onEvent)
    }
    watcher.on('event', onEvent)
    void change?.().catch((error: unknown) => finish(error))
  })
}
