import type { InfiniteData, QueryHost } from '@wevu/query'
import {
  createMutation,
  createQueryClient,
  createWechatQueryHost,
  defineQueryOptions,
  observeInfiniteQuery,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@wevu/query'
import { expectError, expectType } from 'tsd'
import { shallowRef } from 'wevu'
import 'miniprogram-api-typings'

interface Order {
  id: string
  status: 'pending' | 'cancelled'
}

interface DetailedOrder extends Order {
  detail: string
}

declare function fetchOrder(id: string, signal: AbortSignal): Promise<Order>
declare function fetchDetailedOrder(id: string, signal: AbortSignal): Promise<DetailedOrder>
declare function cancelOrder(variables: { id: string }): Promise<Order>

const client = createQueryClient()
expectType<boolean>(client.isDisposed())
expectType<QueryHost>(createWechatQueryHost(wx))
const detail = defineQueryOptions({
  key: ['orders', 'order-1'] as const,
  query: ({ key, signal }) => fetchOrder(key[1], signal),
})

expectType<Promise<Order>>(client.fetchQuery(detail))
expectType<Promise<void>>(client.prefetchQuery(detail))
expectType<Order | undefined>(client.getQueryData(detail.key))
expectError(client.setQueryData(detail.key, { unrelated: true }))
expectError(client.getQueryData<string>(detail.key))
expectError(client.setQueryData<string>(detail.key, 'wrong-type'))

expectError(defineQueryOptions({
  ...detail,
  query: async () => 'wrong-order',
}))
expectError(defineQueryOptions({
  ...detail,
  query: ({ key, signal }) => fetchDetailedOrder(key[1], signal),
}))
expectError(client.fetchQuery<DetailedOrder, typeof detail.key>({
  key: detail.key,
  query: ({ key, signal }) => fetchDetailedOrder(key[1], signal),
}))
expectType<Promise<Order>>(client.fetchQuery({
  ...detail,
  query: ({ key, signal }) => fetchDetailedOrder(key[1], signal),
}))
expectError(client.fetchQuery({
  ...detail,
  query: async () => 'wrong-order',
}))
expectError(client.fetchQuery<string, typeof detail.key>({
  ...detail,
  query: async () => 'wrong-order',
}))
expectError(client.fetchQuery(detail, {
  query: async () => 'wrong-order',
}))
expectError(client.prefetchQuery({
  ...detail,
  query: async () => 'wrong-order',
}))
expectError(client.observeQuery({
  ...detail,
  query: async () => 'wrong-order',
}))

const detailObserver = client.observeQuery(detail)
expectType<Order | undefined>(detailObserver.getState().data)

const flexibleObserver = client.observeQuery({
  key: ['manual-observer'] as readonly unknown[],
  query: async () => 'manual',
})
expectType<string | undefined>(flexibleObserver.getState().data)
expectError(flexibleObserver.setOptions({
  key: detail.key,
  query: async () => 'wrong-order',
}))

const untaggedKey = ['manual-order'] as const
expectType<Order | undefined>(client.getQueryData<Order>(untaggedKey))
expectType<Order>(client.setQueryData<Order>(untaggedKey, {
  id: 'manual-order',
  status: 'pending',
}))
expectType<Promise<Order>>(client.fetchQuery<Order, typeof untaggedKey>({
  key: untaggedKey,
  query: ({ signal }) => fetchOrder('manual-order', signal),
}))

const orderId = shallowRef('order-1')
const query = useQuery({
  key: () => ['orders', orderId.value] as const,
  query: ({ key, signal }) => fetchOrder(key[1], signal),
}, client)
expectType<Order | undefined>(query.data.value)
expectType<Promise<Order>>(query.refetch())
expectType<unknown>(query.error.value)
expectError(query.data.value = { id: 'other', status: 'pending' })

expectError(useQuery({
  ...detail,
  query: async () => 'wrong-order',
}, client))
expectError(useQuery({
  key: () => detail.key,
  query: async () => 'wrong-order',
}, client))

const selected = useQuery({
  ...detail,
  select: order => order.id,
}, client)
expectType<string | undefined>(selected.data.value)
expectType<Promise<Order>>(selected.refetch())

const mutation = useMutation({ mutation: cancelOrder }, client)
expectType<Promise<Order>>(mutation.mutateAsync({ id: 'order-1' }))
expectType<{ id: string } | undefined>(mutation.variables.value)
expectError(mutation.mutateAsync({ id: 1 }))
expectError(mutation.mutateAsync())

const imperativeMutation = createMutation(client, { mutation: cancelOrder })
expectType<Promise<Order>>(imperativeMutation.mutateAsync({ id: 'order-1' }))
expectError(imperativeMutation.mutateAsync({ missing: true }))

interface OrderPage {
  orders: Order[]
  next: number | undefined
}

declare function fetchOrderPage(cursor: number, signal: AbortSignal): Promise<OrderPage>

const infiniteOptions = {
  key: ['order-pages'] as const,
  initialPageParam: 0,
  query: ({ pageParam, signal }: { pageParam: number, signal: AbortSignal }) => fetchOrderPage(pageParam, signal),
  getNextPageParam: (page: OrderPage) => page.next,
}

const taggedInfiniteDefinition = defineQueryOptions({
  key: ['tagged-order-pages'] as const,
  query: async (): Promise<InfiniteData<OrderPage, number>> => ({
    pages: [],
    pageParams: [],
  }),
})
const taggedInfiniteOptions = {
  ...infiniteOptions,
  key: taggedInfiniteDefinition.key,
}
const taggedPages = useInfiniteQuery(taggedInfiniteOptions, client)
expectType<readonly OrderPage[] | undefined>(taggedPages.data.value?.pages)
const taggedObservedPages = observeInfiniteQuery(client, taggedInfiniteOptions)
expectType<readonly number[] | undefined>(taggedObservedPages.getState().data?.pageParams)

const pages = useInfiniteQuery({
  ...infiniteOptions,
  key: () => ['order-pages', orderId.value] as const,
  query: ({ key, pageParam, signal }) => {
    expectType<string>(key[1])
    return fetchOrderPage(pageParam, signal)
  },
}, client)
expectType<readonly OrderPage[] | undefined>(pages.data.value?.pages)
expectType<readonly number[] | undefined>(pages.data.value?.pageParams)
expectType<boolean>(pages.hasNextPage.value)
expectType<boolean>(pages.isFetchingNextPage.value)

const observedPages = observeInfiniteQuery(client, infiniteOptions)
expectType<readonly OrderPage[] | undefined>(observedPages.getState().data?.pages)
expectError(useInfiniteQuery({ ...infiniteOptions, initialPageParam: 'wrong-cursor' }, client))
observedPages.setOptions(infiniteOptions)

const finiteTaggedKeyInfiniteOptions = {
  key: detail.key,
  initialPageParam: 0,
  query: ({ signal }: { signal: AbortSignal }) => fetchOrder(detail.key[1], signal),
  getNextPageParam: () => undefined,
}
expectError(observeInfiniteQuery(client, finiteTaggedKeyInfiniteOptions))
expectError(useInfiniteQuery({
  ...finiteTaggedKeyInfiniteOptions,
  key: () => detail.key,
}, client))

const flexiblePages = observeInfiniteQuery(client, {
  ...infiniteOptions,
  key: ['manual-order-pages'] as readonly unknown[],
})
expectError(flexiblePages.setOptions({
  ...infiniteOptions,
  key: detail.key,
}))
