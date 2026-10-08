import type { Serializable } from 'node:child_process'
import process from 'node:process'

interface WorkerHost {
  connected?: boolean
  send?: (message: Serializable, callback: (error: Error | null) => void) => boolean
  disconnect?: () => void
  exit: (code: number) => void
  on: (event: 'disconnect', listener: () => void) => unknown
  off: (event: 'disconnect', listener: () => void) => unknown
}

/** IPC 断开后等待当前启动或编译释放资源，再卸载 loader 并退出所属 worker。 */
export function createWorkerLifecycle(host: WorkerHost = process, reportError: (error: unknown) => void = console.error) {
  let active = 0
  let stopping = false
  let finalizing = false
  let exitCode = 0
  let closeResponse: Serializable | undefined
  let dispose: (() => void | Promise<void>) | undefined
  let finish: () => Promise<void>

  function close(response?: Serializable, code = 0) {
    stopping = true
    exitCode = Math.max(exitCode, code)
    closeResponse ??= response
    void finish()
  }

  function disconnected() {
    close()
  }

  function send(message: Serializable): Promise<boolean> {
    if (!host.connected || !host.send) {
      close()
      return Promise.resolve(false)
    }
    return new Promise((resolve) => {
      const failed = (error: Error) => {
        reportError(error)
        close(undefined, 1)
        resolve(false)
      }
      try {
        host.send!(message, (error) => {
          if (error) {
            failed(error)
          }
          else {
            resolve(true)
          }
        })
      }
      catch (error) {
        failed(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  finish = async () => {
    if (!stopping || active || finalizing) {
      return
    }
    finalizing = true
    host.off('disconnect', disconnected)
    try {
      await dispose?.()
    }
    catch (error) {
      exitCode = 1
      closeResponse = undefined
      reportError(error)
    }
    finally {
      dispose = undefined
    }
    if (closeResponse !== undefined) {
      await send(closeResponse)
    }
    if (host.connected) {
      try {
        host.disconnect?.()
      }
      catch (error) {
        exitCode = 1
        reportError(error)
      }
    }
    host.exit(exitCode)
  }

  host.on('disconnect', disconnected)
  if (!host.connected) {
    close()
  }
  return {
    send,
    close,
    setDispose(cleanup: () => void | Promise<void>) {
      if (finalizing || dispose) {
        throw new Error('Worker cleanup must be registered once during its owned startup')
      }
      dispose = cleanup
    },
    async run<T>(work: () => T | Promise<T>): Promise<T | undefined> {
      if (stopping) {
        return undefined
      }
      active++
      try {
        return await work()
      }
      finally {
        active--
        await finish()
      }
    },
  }
}
