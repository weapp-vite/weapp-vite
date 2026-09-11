import type { QueryClient } from './client'
import type {
  MutationController,
  MutationOptions,
  MutationState,
  Unsubscribe,
} from './types'
import { QueryCancelledError } from './errors'
import { ListenerStore, reportCallbackError } from './listeners'

function createIdleState<TData, TVariables>(): MutationState<TData, TVariables> {
  return Object.freeze({
    status: 'idle',
    data: undefined,
    error: undefined,
    variables: undefined,
  })
}

/**
 * 创建不重试、不合并调用的 mutation 控制器。
 * 每次调用独立执行回调，只有最新调用可以更新展示状态。
 */
export function createMutation<TData, TVariables>(
  client: QueryClient,
  options: MutationOptions<TData, TVariables>,
): MutationController<TData, TVariables> {
  const listeners = new ListenerStore<MutationState<TData, TVariables>>()
  const { mutation, onError, onSettled, onSuccess } = options
  let state = createIdleState<TData, TVariables>()
  let latestInvocation = 0
  let presentationVersion = 0
  let destroyed = false

  const publish = (nextState: MutationState<TData, TVariables>) => {
    state = Object.freeze(nextState)
    listeners.emit(state)
  }

  const resetPresentation = () => {
    presentationVersion += 1
    publish(createIdleState<TData, TVariables>())
  }

  const unsubscribeScope = client.subscribeScope(() => {
    if (!destroyed) {
      resetPresentation()
    }
  })

  const mutateAsync = (variables: TVariables): Promise<TData> => {
    if (destroyed) {
      return Promise.reject(new Error('MutationController 已销毁'))
    }
    if (client.isDisposed()) {
      return Promise.reject(new QueryCancelledError())
    }

    const invocation = ++latestInvocation
    const invocationPresentationVersion = presentationVersion
    const scopeVersion = client.getScopeVersion()
    publish({
      status: 'pending',
      data: undefined,
      error: undefined,
      variables,
    })

    const canInvokeCallbacks = () => (
      !client.isDisposed() && client.getScopeVersion() === scopeVersion
    )
    const assertScope = () => {
      if (!canInvokeCallbacks()) {
        throw new QueryCancelledError()
      }
    }
    const canPresent = () => (
      !destroyed
      && invocation === latestInvocation
      && invocationPresentationVersion === presentationVersion
      && canInvokeCallbacks()
    )

    return (async () => {
      assertScope()
      let data: TData | undefined
      let error: unknown
      let failed = false

      try {
        data = await mutation(variables)
      }
      catch (mutationError) {
        failed = true
        error = mutationError
      }

      if (canInvokeCallbacks()) {
        try {
          if (failed) {
            await onError?.(error, variables)
          }
          else {
            await onSuccess?.(data as TData, variables)
          }
        }
        catch (callbackError) {
          failed = true
          error = callbackError
        }
      }

      if (canInvokeCallbacks()) {
        try {
          await onSettled?.(data, failed ? error : undefined, variables)
        }
        catch (callbackError) {
          failed = true
          error = callbackError
        }
      }

      assertScope()
      if (canPresent()) {
        publish({
          status: failed ? 'error' : 'success',
          data: failed ? undefined : data,
          error: failed ? error : undefined,
          variables,
        })
      }
      assertScope()
      if (failed) {
        throw error
      }
      return data as TData
    })()
  }

  return {
    getState: () => state,
    subscribe(listener): Unsubscribe {
      if (destroyed) {
        return () => {}
      }
      const unsubscribe = listeners.add(listener)
      try {
        listener(state)
      }
      catch (error) {
        reportCallbackError(error)
      }
      return unsubscribe
    },
    mutate(variables) {
      void mutateAsync(variables).catch(() => {})
    },
    mutateAsync,
    reset() {
      if (!destroyed) {
        resetPresentation()
      }
    },
    destroy() {
      if (destroyed) {
        return
      }
      destroyed = true
      presentationVersion += 1
      listeners.clear()
      unsubscribeScope()
    },
  }
}
