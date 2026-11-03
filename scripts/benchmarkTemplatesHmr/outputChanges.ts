import type { FSWatcher } from 'node:fs'
import { watch } from 'node:fs'

export interface BenchmarkOutputChanges {
  readonly revision: number
  wait: (after: number, timeoutMs: number, signal?: AbortSignal) => Promise<void>
  close: () => void
}

/** 目录事件只唤醒完整产物校验；丢失事件、目录不可观察或依赖在目录外时仍由轮询兜底。 */
export function createBenchmarkOutputChanges(directory: string): BenchmarkOutputChanges {
  let revision = 0
  let watcher: FSWatcher | undefined
  const pending = new Set<() => void>()
  const changed = () => {
    revision += 1
    for (const wake of [...pending]) {
      wake()
    }
  }
  try {
    // 观察父目录，兼容 bundler 用 rename 替换产物 inode。
    watcher = watch(directory, { persistent: false }, changed)
    watcher.on('error', () => {
      watcher?.close()
      watcher = undefined
      changed()
    })
  }
  catch {
    // 事件不是正确性前提；保留相同期限内的轮询路径。
  }

  return {
    get revision() { return revision },
    wait(after, timeoutMs, signal) {
      signal?.throwIfAborted()
      if (revision !== after) {
        return Promise.resolve()
      }
      return new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>
        const handlers = {
          finish() {
            clearTimeout(timer)
            pending.delete(handlers.wake)
            signal?.removeEventListener('abort', handlers.abort)
          },
          wake() {
            handlers.finish()
            resolve()
          },
          abort() {
            handlers.finish()
            reject(signal?.reason)
          },
        }
        timer = setTimeout(handlers.wake, timeoutMs)
        pending.add(handlers.wake)
        signal?.addEventListener('abort', handlers.abort, { once: true })
      })
    },
    close() {
      watcher?.close()
      watcher = undefined
      changed()
    },
  }
}
