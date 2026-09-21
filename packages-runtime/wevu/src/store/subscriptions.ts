import { getCurrentScope, onScopeDispose } from '../reactivity'

export function noop() {}

/** 订阅归注册时的作用域所有，detached 订阅由调用方显式清理。 */
export function addSubscription<T extends (...args: any[]) => any>(
  subscriptions: Set<T>,
  callback: T,
  detached = false,
  cleanup: () => void = noop,
) {
  subscriptions.add(callback)
  const remove = () => {
    if (subscriptions.delete(callback)) {
      cleanup()
    }
  }
  if (!detached && getCurrentScope()) {
    onScopeDispose(remove)
  }
  return remove
}
