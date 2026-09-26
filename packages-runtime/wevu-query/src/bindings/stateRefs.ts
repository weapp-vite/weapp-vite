import type { QueryBindingState } from './observer'
import type { QueryStateRefs } from './types'
import { computed } from 'wevu'

/** 将内部状态快照投影为模板可消费的只读计算引用。 */
export function createQueryStateRefs<TSource, TData>(
  source: QueryBindingState<TSource>,
  select: (data: TSource) => TData,
): QueryStateRefs<TData> {
  const { state, data: sourceData, hasData: sourceHasData } = source
  const projection = computed(() => {
    if (!sourceHasData.value) {
      return { data: undefined, error: null, failed: false } as const
    }
    try {
      return {
        data: select(sourceData.value as TSource),
        error: null,
        failed: false,
      } as const
    }
    catch (error) {
      return { data: undefined, error, failed: true } as const
    }
  })
  const data = computed(() => projection.value.data)
  const hasData = computed(() => sourceHasData.value && !projection.value.failed)
  const error = computed(() => projection.value.failed ? projection.value.error : state.value.error)
  const status = computed(() => projection.value.failed ? 'error' : state.value.status)
  const fetchStatus = computed(() => state.value.fetchStatus)
  const fetchType = computed(() => state.value.fetchType)
  const updatedAt = computed(() => state.value.updatedAt)
  const invalidated = computed(() => state.value.invalidated)
  const isPending = computed(() => status.value === 'pending')
  const isFetching = computed(() => state.value.fetchStatus === 'fetching')
  const isRefreshing = computed(() => hasData.value && state.value.fetchStatus === 'fetching')
  const isPaused = computed(() => state.value.fetchStatus === 'paused')

  return {
    data,
    hasData,
    error,
    status,
    fetchStatus,
    fetchType,
    updatedAt,
    invalidated,
    isPending,
    isFetching,
    isRefreshing,
    isPaused,
  }
}
