import type { ActionSubscriber, Pinia } from './types'
import { setActivePinia } from './manager'

/** Action 的结果回调属于已开始的调用，不随后续退订取消。 */
export function wrapAction(
  store: Record<string, any>,
  name: string,
  action: (...args: any[]) => any,
  subscriptions: Set<ActionSubscriber>,
  pinia: Pinia,
) {
  return function wrapped(this: any, ...args: any[]) {
    setActivePinia(pinia)
    const afterCallbacks = new Set<(result: any) => any>()
    const errorCallbacks = new Set<(error: any) => any>()
    subscriptions.forEach(callback => callback({
      name,
      store,
      args,
      after: callback => afterCallbacks.add(callback),
      onError: callback => errorCallbacks.add(callback),
    }))
    let result: any
    try {
      result = action.apply(this && this.$id === store.$id ? this : store, args)
    }
    catch (error) {
      errorCallbacks.forEach(callback => callback(error))
      throw error
    }
    if (result instanceof Promise) {
      return result.then((value: any) => {
        afterCallbacks.forEach(callback => callback(value))
        return value
      }).catch((error: any) => {
        errorCallbacks.forEach(callback => callback(error))
        return Promise.reject(error)
      })
    }
    afterCallbacks.forEach(callback => callback(result))
    return result
  }
}
