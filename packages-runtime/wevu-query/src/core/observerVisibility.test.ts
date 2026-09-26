import type { RefetchOnShow } from './types'
import { expect, it } from 'vitest'
import { QueryClient } from './client'

it.each<{ policies: [RefetchOnShow, RefetchOnShow], staleTime: number }>([
  { policies: ['always', 'always'], staleTime: Infinity },
  { policies: ['stale', 'always'], staleTime: 0 },
  { policies: ['always', 'stale'], staleTime: 0 },
])('coalesces automatic show work for $policies without aborting a peer request', async ({ policies, staleTime }) => {
  const client = new QueryClient({ now: () => 100, createAbortController: () => new AbortController() })
  const request = Promise.withResolvers<number>()
  const signals: AbortSignal[] = []
  const options = {
    key: ['shared-show'] as const,
    staleTime,
    query: ({ signal }: { signal: AbortSignal }) => {
      signals.push(signal)
      return request.promise
    },
  }
  client.setQueryData(options.key, 1)
  client.setForeground(false)
  const first = client.observeQuery(options, { refetchOnShow: policies[0] })
  const second = client.observeQuery(options, { refetchOnShow: policies[1] })
  try {
    client.setForeground(true)
    expect(signals).toHaveLength(1)
    expect(signals[0]?.aborted).toBe(false)
    const result = first.refresh()
    request.resolve(2)
    await expect(result).resolves.toBe(2)
    expect(first.getState().data).toBe(2)
    expect(second.getState().data).toBe(2)
  }
  finally {
    first.destroy()
    second.destroy()
    client.dispose()
  }
})
