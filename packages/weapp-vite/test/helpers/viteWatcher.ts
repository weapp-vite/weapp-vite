import type { Mock } from 'vitest'
import { EventEmitter } from 'node:events'
import { vi } from 'vitest'

interface MockViteWatcher extends EventEmitter {
  add: Mock<() => void>
  close: Mock<() => Promise<void>>
}

/** 模拟 Vite watcher 的异步关闭契约，并释放本实例登记的监听器。 */
export function createMockViteWatcher(): MockViteWatcher {
  const watcher = new EventEmitter()
  return Object.assign(watcher, {
    add: vi.fn<() => void>(),
    close: vi.fn(async () => {
      watcher.removeAllListeners()
    }),
  })
}
