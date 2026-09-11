import type { QueryClient } from '../core/client'
import type { InfiniteQueryOptions } from '../core/types'
import type { ResolvedBindingOptions } from './observer'
import type { UseInfiniteQueryOptions, UseInfiniteQueryResult } from './types'
import { computed, toValue } from 'wevu'
import { observeInfiniteQuery } from '../core/infinite'
import { snapshotQueryKey } from '../core/keys'
import { bindQueryObserver } from './observer'
import { useQueryClient } from './plugin'
import { createQueryStateRefs } from './stateRefs'

/** 在当前 Wevu 页面中观察分页查询。 */
export function useInfiniteQuery<
  TPage,
  TPageParam,
  TKey extends readonly unknown[] = readonly unknown[],
>(
  options: UseInfiniteQueryOptions<TPage, TPageParam, TKey>,
  client?: QueryClient,
): UseInfiniteQueryResult<TPage, TPageParam> {
  const queryClient = useQueryClient(client)
  const resolveOptions = (): ResolvedBindingOptions<InfiniteQueryOptions<TPage, TPageParam, TKey>> => ({
    options: {
      key: snapshotQueryKey(toValue(options.key)),
      query: options.query,
      initialPageParam: options.initialPageParam,
      getNextPageParam: options.getNextPageParam,
      staleTime: options.staleTime,
      gcTime: options.gcTime,
      maxPages: options.maxPages,
    },
    enabled: options.enabled == null ? true : toValue(options.enabled),
    refetchOnShow: options.refetchOnShow ?? 'stale',
  })
  const initial = resolveOptions()
  const observer = observeInfiniteQuery(queryClient, initial.options, {
    active: false,
    enabled: initial.enabled,
    refetchOnShow: initial.refetchOnShow,
  })
  const binding = bindQueryObserver(observer, resolveOptions)
  const stateRefs = createQueryStateRefs(binding, data => data)
  const hasNextPage = computed(() => {
    return binding.state.value.hasData && observer.hasNextPage()
  })
  const isFetchingNextPage = computed(() => {
    return binding.state.value.fetchStatus === 'fetching' && binding.state.value.fetchType === 'nextPage'
  })

  return {
    ...stateRefs,
    hasNextPage,
    isFetchingNextPage,
    refresh: () => observer.refresh(),
    refetch: () => observer.refetch(),
    fetchNextPage: () => observer.fetchNextPage(),
  }
}
