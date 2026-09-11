import type { QueryHost } from './plugin'
import { mountComposable } from '@wevu/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'wevu'
import { createQueryClient } from '../client'
import { createQueryPlugin, useQueryClient } from './plugin'
import { useInfiniteQuery } from './useInfiniteQuery'
import { useMutation } from './useMutation'
import { useQuery } from './useQuery'

describe('@wevu/query bindings', () => {
  it('synchronizes reactive options with real page lifecycle hooks', async () => {
    const client = createQueryClient({ staleTime: Infinity })
    const id = ref(1)
    const enabled = ref(false)
    const queriedIds: number[] = []
    const stopOnline = vi.fn()
    const stopForeground = vi.fn()
    const host: QueryHost = {
      subscribeOnline: vi.fn(() => stopOnline),
      subscribeForeground: vi.fn(() => stopForeground),
    }
    const dispose = vi.spyOn(client, 'dispose')
    const wrapper = mountComposable(() => useQuery({
      key: () => ['item', id.value] as const,
      enabled,
      query: async ({ key }) => {
        queriedIds.push(key[1])
        return { id: key[1], label: `item-${key[1]}` }
      },
      select: item => item.label,
    }), {
      global: {
        plugins: [createQueryPlugin(client, { host })],
      },
    })

    expect(queriedIds).toEqual([])
    enabled.value = true
    await vi.waitFor(() => expect(wrapper.vm.data.value).toBe('item-1'))
    expect(wrapper.vm.hasData.value).toBe(true)
    expect(wrapper.vm.status.value).toBe('success')
    expect(wrapper.vm.isPending.value).toBe(false)

    await wrapper.triggerHook('onHide')
    id.value = 2
    await wrapper.nextTick()
    expect(queriedIds).toEqual([1])

    await wrapper.triggerHook('onShow')
    await vi.waitFor(() => expect(wrapper.vm.data.value).toBe('item-2'))
    expect(queriedIds).toEqual([1, 2])

    await wrapper.triggerHook('onUnload')
    id.value = 3
    await wrapper.triggerHook('onShow')
    expect(queriedIds).toEqual([1, 2])

    wrapper.unmount()
    expect(stopOnline).toHaveBeenCalledOnce()
    expect(stopForeground).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('contains selector failures locally, memoizes the projection, and recovers', async () => {
    const client = createQueryClient({ staleTime: Infinity })
    const key = ['selected-item'] as const
    const failure = new Error('projection failed')
    const suffix = ref('')
    let response = { label: 'broken' }
    const query = vi.fn(async () => response)
    const select = vi.fn((item: { label: string }) => {
      if (item.label === 'broken') {
        throw failure
      }
      return `${item.label}${suffix.value}`
    })
    const selected = mountComposable(() => useQuery({
      key,
      enabled: false,
      query,
      select,
    }, client))
    const peer = mountComposable(() => useQuery({
      key,
      enabled: false,
      query,
    }, client))
    const selectedRefs = {
      data: selected.vm.data,
      error: selected.vm.error,
      hasData: selected.vm.hasData,
      status: selected.vm.status,
    }

    await selected.vm.refetch()
    expect(selected.vm.data.value).toBeUndefined()
    expect(selected.vm.hasData.value).toBe(false)
    expect(selected.vm.status.value).toBe('error')
    expect(selected.vm.error.value).toBe(failure)
    expect(select).toHaveBeenCalledOnce()
    expect(peer.vm.data.value).toEqual({ label: 'broken' })
    expect(peer.vm.hasData.value).toBe(true)
    expect(peer.vm.status.value).toBe('success')
    expect(peer.vm.error.value).toBeNull()
    expect(client.getQueryState<{ label: string }>(key)).toMatchObject({
      data: { label: 'broken' },
      error: null,
      hasData: true,
      status: 'success',
    })

    response = { label: 'recovered' }
    await selected.vm.refetch()
    expect(selected.vm.data.value).toBe('recovered')
    expect(selected.vm.hasData.value).toBe(true)
    expect(selected.vm.status.value).toBe('success')
    expect(selected.vm.error.value).toBeNull()
    expect(select).toHaveBeenCalledTimes(2)
    expect(selected.vm.data).toBe(selectedRefs.data)
    expect(selected.vm.error).toBe(selectedRefs.error)
    expect(selected.vm.hasData).toBe(selectedRefs.hasData)
    expect(selected.vm.status).toBe(selectedRefs.status)
    expect(peer.vm.data.value).toEqual({ label: 'recovered' })
    suffix.value = '!'
    expect(selected.vm.data.value).toBe('recovered!')
    expect(select).toHaveBeenCalledTimes(3)
    expect(query).toHaveBeenCalledTimes(2)

    selected.unmount()
    peer.unmount()
    client.dispose()
  })

  it('keeps providers isolated and supports an explicit client', async () => {
    expect(() => mountComposable(() => {
      useQueryClient()
      return {}
    })).toThrow('未找到 QueryClient provider')

    const client = createQueryClient()
    const dispose = vi.spyOn(client, 'dispose')
    const wrapper = mountComposable(() => useQuery({
      key: ['explicit'] as const,
      query: () => 'ready',
    }, client))

    expect(await wrapper.vm.refetch()).toBe('ready')
    expect(wrapper.vm.data.value).toBe('ready')
    wrapper.unmount()
    expect(dispose).not.toHaveBeenCalled()
    client.dispose()
  })

  it('projects mutation variables and latest state through computed refs', async () => {
    const client = createQueryClient()
    const wrapper = mountComposable(() => useMutation({
      mutation: async (variables: { id: number }) => ({ ...variables, saved: true }),
    }, client))

    const result = await wrapper.vm.mutateAsync({ id: 7 })
    expect(result).toEqual({ id: 7, saved: true })
    expect(wrapper.vm.status.value).toBe('success')
    expect(wrapper.vm.variables.value).toEqual({ id: 7 })
    expect(wrapper.vm.data.value).toEqual(result)

    wrapper.unmount()
    client.dispose()
  })

  it('exposes infinite cursor state without leaking its observer', async () => {
    const client = createQueryClient()
    const wrapper = mountComposable(() => useInfiniteQuery({
      key: ['pages'] as const,
      initialPageParam: 0,
      query: async ({ pageParam }) => ({
        value: pageParam,
        next: pageParam < 1 ? pageParam + 1 : undefined,
      }),
      getNextPageParam: page => page.next,
    }, client))

    await wrapper.vm.refetch()
    expect(wrapper.vm.data.value).toEqual({
      pages: [{ value: 0, next: 1 }],
      pageParams: [0],
    })
    expect(wrapper.vm.hasNextPage.value).toBe(true)

    await wrapper.vm.fetchNextPage()
    expect(wrapper.vm.data.value?.pages).toEqual([
      { value: 0, next: 1 },
      { value: 1, next: undefined },
    ])
    expect(wrapper.vm.data.value?.pageParams).toEqual([0, 1])
    expect(wrapper.vm.hasNextPage.value).toBe(false)

    wrapper.unmount()
    client.dispose()
  })
})
