import type { StoreManager } from './types'

export function createStore(): StoreManager {
  const manager: StoreManager = {
    _stores: new Map(),
    _plugins: [],
    install(_app: any) {
      // noop in mini-program
    },
    use(plugin: (context: { store: any }) => void) {
      if (typeof plugin === 'function') {
        manager._plugins.push(plugin)
      }
      return manager
    },
  }
  ;(createStore as any)._instance = manager
  return manager
}
