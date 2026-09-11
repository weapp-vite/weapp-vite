import type { QueryClient } from '../core/client'
import type { QueryOptions } from '../core/types'
import type { ResolvedBindingOptions } from './observer'
import type { UseQueryOptions, UseQueryResult } from './types'
import { toValue } from 'wevu'
import { snapshotQueryKey } from '../core/keys'
import { bindQueryObserver } from './observer'
import { useQueryClient } from './plugin'
import { createQueryStateRefs } from './stateRefs'

/** 在当前 Wevu 页面中观察普通查询。 */
export function useQuery<
  TQueryData,
  TData = TQueryData,
  TKey extends readonly unknown[] = readonly unknown[],
>(
  options: UseQueryOptions<TQueryData, TData, TKey>,
  client?: QueryClient,
): UseQueryResult<TQueryData, TData> {
  const queryClient = useQueryClient(client)
  const resolveOptions = (): ResolvedBindingOptions<QueryOptions<TQueryData, TKey>> => ({
    options: {
      key: snapshotQueryKey(toValue(options.key)),
      query: options.query,
      staleTime: options.staleTime,
      gcTime: options.gcTime,
    },
    enabled: options.enabled == null ? true : toValue(options.enabled),
    refetchOnShow: options.refetchOnShow ?? 'stale',
  })
  const initial = resolveOptions()
  const observer = queryClient.observeQuery(initial.options, {
    active: false,
    enabled: initial.enabled,
    refetchOnShow: initial.refetchOnShow,
  })
  const binding = bindQueryObserver(observer, resolveOptions)
  const select = options.select ?? ((data: TQueryData) => data as unknown as TData)

  return {
    ...createQueryStateRefs(binding, select),
    refresh: () => observer.refresh(),
    refetch: () => observer.refetch(),
  }
}
