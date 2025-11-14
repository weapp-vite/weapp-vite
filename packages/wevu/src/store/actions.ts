import type { ActionSubscriber } from './types'

export function wrapAction<TStore extends Record<string, any>>(
  store: TStore,
  name: string,
  action: (...args: any[]) => any,
  actionSubs: Set<ActionSubscriber<TStore>>,
) {
  return function wrapped(this: any, ...args: any[]) {
    const afterCbs: Array<(r: any) => void> = []
    const errorCbs: Array<(e: any) => void> = []
    const after = (cb: (r: any) => void) => afterCbs.push(cb)
    const onError = (cb: (e: any) => void) => errorCbs.push(cb)
    actionSubs.forEach((sub) => {
      try {
        sub({ name, store, args, after, onError })
      }
      catch {
        // ignore subscriber error
      }
    })
    let res: any
    try {
      res = action.apply(store, args)
    }
    catch (e) {
      errorCbs.forEach(cb => cb(e))
      throw e
    }
    const finalize = (r: any) => {
      afterCbs.forEach(cb => cb(r))
      return r
    }
    if (res && typeof (res as Promise<any>).then === 'function') {
      return (res as Promise<any>).then(
        r => finalize(r),
        (e) => {
          errorCbs.forEach(cb => cb(e))
          return Promise.reject(e)
        },
      )
    }
    return finalize(res)
  }
}
