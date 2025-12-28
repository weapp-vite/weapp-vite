import type { StoreManager } from './types'

export function createStore(): StoreManager {
  const manager: StoreManager = {
    _stores: new Map(),
    _plugins: [],
    install(_app: any) {
      // 小程序场景不需要注册全局插件入口，这里保留 API 但不执行任何操作
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
