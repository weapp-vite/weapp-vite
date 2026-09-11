import type { QueryClient } from '../core/client'
import type { UseMutationOptions, UseMutationResult } from './types'
import {
  computed,
  onScopeDispose,
  onUnload,
  shallowRef,
} from 'wevu'
import { createMutation } from '../core/mutation'
import { useQueryClient } from './plugin'

/** 在当前 Wevu 作用域中创建变更控制器。 */
export function useMutation<TData, TVariables = void>(
  options: UseMutationOptions<TData, TVariables>,
  client?: QueryClient,
): UseMutationResult<TData, TVariables> {
  const controller = createMutation(useQueryClient(client), options)
  const state = shallowRef(controller.getState())
  let destroyed = false
  const unsubscribe = controller.subscribe((nextState) => {
    if (!destroyed) {
      state.value = nextState
    }
  })
  const destroy = () => {
    if (destroyed) {
      return
    }
    destroyed = true
    unsubscribe()
    controller.destroy()
  }
  onUnload(destroy)
  onScopeDispose(destroy)

  const status = computed(() => state.value.status)
  return {
    status,
    data: computed(() => state.value.data),
    error: computed(() => state.value.error),
    variables: computed(() => state.value.variables),
    isPending: computed(() => state.value.status === 'pending'),
    mutate: variables => controller.mutate(variables),
    mutateAsync: variables => controller.mutateAsync(variables),
    reset: () => controller.reset(),
  }
}
