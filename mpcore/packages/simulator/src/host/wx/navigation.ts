import type { HeadlessWxCallbackOption } from './core'

export function invokePreparedNavigationApi(
  prepare: () => () => unknown,
  option?: HeadlessWxCallbackOption,
) {
  try {
    const commit = prepare()
    const finalize = commit()
    try {
      option?.success?.()
    }
    finally {
      if (typeof finalize === 'function') {
        finalize()
      }
    }
    option?.complete?.()
  }
  catch (error) {
    option?.fail?.(error as Error)
    option?.complete?.()
  }
}
