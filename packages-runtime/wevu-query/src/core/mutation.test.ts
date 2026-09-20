import type { QueryAbortController } from './types'
import { AbortControllerPolyfill } from '@wevu/web-apis/abort'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from './client'
import { QueryCancelledError } from './errors'
import { createMutation } from './mutation'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function captureReportedErrors(): Array<() => void> {
  const reports: Array<() => void> = []
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => {
    reports.push(callback)
    return 0 as never
  })
  return reports
}

const clients: QueryClient[] = []

function createClient(): QueryClient {
  const client = new QueryClient({
    createAbortController: () => new AbortControllerPolyfill() as unknown as QueryAbortController,
    gcTime: Infinity,
  })
  clients.push(client)
  return client
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.dispose()
  }
  vi.restoreAllMocks()
})

describe('createMutation', () => {
  it('runs callbacks for every invocation while only the latest invocation presents', async () => {
    const client = createClient()
    const first = createDeferred<string>()
    const second = createDeferred<string>()
    const successes: Array<[string, number]> = []
    const failures: Array<[unknown, number]> = []
    const settled: number[] = []
    const mutation = createMutation(client, {
      mutation: (variable: number) => variable === 1 ? first.promise : second.promise,
      onSuccess(data, variable) {
        successes.push([data, variable])
      },
      onError(error, variable) {
        failures.push([error, variable])
      },
      onSettled(_data, _error, variable) {
        settled.push(variable)
      },
    })

    const firstResult = mutation.mutateAsync(1)
    const secondResult = mutation.mutateAsync(2)
    expect(mutation.getState()).toMatchObject({ status: 'pending', variables: 2 })

    second.resolve('latest')
    await expect(secondResult).resolves.toBe('latest')
    expect(mutation.getState()).toMatchObject({
      status: 'success',
      data: 'latest',
      variables: 2,
    })

    const firstError = new Error('older call failed')
    first.reject(firstError)
    await expect(firstResult).rejects.toBe(firstError)
    expect(successes).toEqual([['latest', 2]])
    expect(failures).toEqual([[firstError, 1]])
    expect(settled).toEqual([2, 1])
    expect(mutation.getState()).toMatchObject({
      status: 'success',
      data: 'latest',
      variables: 2,
    })
  })

  it('keeps same-session callbacks after reset and destroy without restoring presentation', async () => {
    const client = createClient()
    const resetTask = createDeferred<string>()
    const destroyTask = createDeferred<string>()
    const onSuccess = vi.fn()
    let invocation = 0
    const mutation = createMutation(client, {
      mutation: () => (++invocation === 1 ? resetTask.promise : destroyTask.promise),
      onSuccess,
    })

    const resetResult = mutation.mutateAsync('reset')
    mutation.reset()
    expect(mutation.getState()).toEqual({
      status: 'idle',
      data: undefined,
      error: undefined,
      variables: undefined,
    })
    resetTask.resolve('reset-result')
    await expect(resetResult).resolves.toBe('reset-result')
    expect(onSuccess).toHaveBeenCalledWith('reset-result', 'reset')
    expect(mutation.getState().status).toBe('idle')

    const destroyResult = mutation.mutateAsync('destroy')
    mutation.destroy()
    destroyTask.resolve('destroy-result')
    await expect(destroyResult).resolves.toBe('destroy-result')
    expect(onSuccess).toHaveBeenCalledWith('destroy-result', 'destroy')
  })

  it('fences presentation and later callbacks when the client session changes', async () => {
    const client = createClient()
    const task = createDeferred<string>()
    const onSuccess = vi.fn()
    const onSettled = vi.fn()
    const mutation = createMutation(client, {
      mutation: () => task.promise,
      onSuccess,
      onSettled,
    })

    const result = mutation.mutateAsync('old-account')
    client.setScope('next-account')
    expect(mutation.getState().status).toBe('idle')

    task.resolve('server-write-completed')
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
    expect(mutation.getState().status).toBe('idle')
  })

  it('remains reusable after clear and scope changes', async () => {
    const client = createClient()
    const write = vi.fn(async (value: string) => `written:${value}`)
    const mutation = createMutation(client, { mutation: write })

    client.clear()
    await expect(mutation.mutateAsync('after-clear')).resolves.toBe('written:after-clear')

    client.setScope('next-account')
    await expect(mutation.mutateAsync('after-scope')).resolves.toBe('written:after-scope')
    expect(write).toHaveBeenNthCalledWith(1, 'after-clear')
    expect(write).toHaveBeenNthCalledWith(2, 'after-scope')
  })

  it('fences callbacks and rejects retained controllers after terminal disposal', async () => {
    const client = createClient()
    const task = createDeferred<string>()
    const write = vi.fn(() => task.promise)
    const onSuccess = vi.fn()
    const onSettled = vi.fn()
    const mutation = createMutation(client, {
      mutation: write,
      onSuccess,
      onSettled,
    })

    const result = mutation.mutateAsync('in-flight')
    client.dispose()
    task.resolve('server-write-completed')

    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    await expect(mutation.mutateAsync('late')).rejects.toBeInstanceOf(QueryCancelledError)
    mutation.mutate('late-fire-and-forget')
    await Promise.resolve()
    expect(write).toHaveBeenCalledOnce()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
    expect(mutation.getState().status).toBe('idle')
  })

  it('does not begin an old-session write after a pending listener clears the client', async () => {
    const client = createClient()
    const write = vi.fn(async (_value: number) => 'written')
    const mutation = createMutation(client, { mutation: write })
    mutation.subscribe((state) => {
      if (state.status === 'pending') {
        client.clear()
      }
    })

    await expect(mutation.mutateAsync(1)).rejects.toBeInstanceOf(QueryCancelledError)
    expect(write).not.toHaveBeenCalled()
    expect(mutation.getState().status).toBe('idle')
  })

  it('reports listener errors without blocking subscription or mutation settlement', async () => {
    const reports = captureReportedErrors()
    const client = createClient()
    const task = createDeferred<string>()
    const write = vi.fn(() => task.promise)
    const listenerError = new Error('consumer-listener-error')
    const mutation = createMutation(client, { mutation: write })
    const unsubscribe = mutation.subscribe(() => {
      throw listenerError
    })
    const observer = vi.fn()
    mutation.subscribe(observer)

    const result = mutation.mutateAsync('payload')
    expect(write).toHaveBeenCalledWith('payload')
    expect(observer).toHaveBeenNthCalledWith(1, {
      status: 'idle',
      data: undefined,
      error: undefined,
      variables: undefined,
    })
    expect(observer).toHaveBeenNthCalledWith(2, {
      status: 'pending',
      data: undefined,
      error: undefined,
      variables: 'payload',
    })

    task.resolve('written')
    await expect(result).resolves.toBe('written')
    expect(observer).toHaveBeenNthCalledWith(3, {
      status: 'success',
      data: 'written',
      error: undefined,
      variables: 'payload',
    })
    expect(reports).toHaveLength(3)
    for (const report of reports) {
      expect(() => report()).toThrow(listenerError)
    }

    unsubscribe()
    mutation.reset()
    expect(reports).toHaveLength(3)
    expect(observer).toHaveBeenNthCalledWith(4, {
      status: 'idle',
      data: undefined,
      error: undefined,
      variables: undefined,
    })
  })

  it('propagates callback failures and presents them on the latest invocation', async () => {
    const client = createClient()
    const callbackError = new Error('success callback failed')
    const onSettled = vi.fn()
    const mutation = createMutation(client, {
      mutation: async () => 'written',
      onSuccess() {
        throw callbackError
      },
      onSettled,
    })

    await expect(mutation.mutateAsync('payload')).rejects.toBe(callbackError)
    expect(onSettled).toHaveBeenCalledWith('written', callbackError, 'payload')
    expect(mutation.getState()).toMatchObject({
      status: 'error',
      error: callbackError,
      variables: 'payload',
    })
  })
})
