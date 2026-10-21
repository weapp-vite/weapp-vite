import { AsyncLocalStorage } from 'node:async_hooks'
import { createBarrier } from './webRestoreScanGate'

interface Notification {
  kind: 'source' | 'native'
  file: string
  event: 'create' | 'update' | 'delete'
  done: ReturnType<typeof createBarrier>
}

/** 为真实通知保留独立完成边界，不把 sidecar 发布计作 Vite 原生 HMR。 */
export function createWebRestoreNotifications() {
  const current = new AsyncLocalStorage<Notification>()
  function notify(kind: Notification['kind'], file: string, event: 'add' | 'change' | 'unlink', publish: () => void) {
    const done = createBarrier()
    current.run({ kind, file, event: event === 'add' ? 'create' : event === 'unlink' ? 'delete' : 'update', done }, publish)
    return done.promise
  }
  return {
    source(file: string, event: 'add' | 'unlink', publish: () => void) {
      return notify('source', file, event, publish)
    },
    native(file: string, event: 'add' | 'change' | 'unlink', publish: () => void) {
      return notify('native', file, event, publish)
    },
    async watchChange<T>(file: string, change: { event: string }, publish: () => Promise<T>) {
      const notification = current.getStore()
      const result = await publish()
      if (notification?.kind === 'source' && notification.file === file && notification.event === change.event) {
        // 返回原 hook 后宿主同步提交 reload；观察者在该提交完成后继续。
        queueMicrotask(notification.done.release)
      }
      return result
    },
    async hotUpdateEnvironments(update: () => Promise<unknown>) {
      const notification = current.getStore()
      await update()
      if (notification?.kind === 'native') {
        notification.done.release()
      }
    },
    close() {
      current.disable()
    },
  }
}
