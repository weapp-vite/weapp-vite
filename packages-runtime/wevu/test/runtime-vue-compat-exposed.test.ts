import type { InternalRuntimeState } from '@/runtime/types'
import { WEVU_EXPOSED_KEY } from '@weapp-core/constants'
import { expect, it, vi } from 'vitest'
import { getCurrentInstance, onMounted, onScopeDispose } from '@/index'
import { createApp } from '@/runtime/app'
import { callHookList } from '@/runtime/hooks'
import { mountRuntimeInstance, teardownRuntimeInstance } from '@/runtime/register'

it('retains the Vue compatibility exposed view for a queued callback after teardown', async () => {
  const target: InternalRuntimeState = { setData: vi.fn() }
  const released = Promise.withResolvers<void>()
  const disposed = vi.fn()
  const exposed = { stickyState: { height: 42 } }
  let pending: Promise<unknown> | undefined
  mountRuntimeInstance(target, createApp({}), undefined, (_props: unknown, { expose }: {
    expose: (value: Record<string, unknown>) => void
  }) => {
    const instance = getCurrentInstance()!
    expose(exposed)
    onScopeDispose(disposed)
    onMounted(() => {
      pending = released.promise.then(() => instance.exposed.stickyState.height)
    })
    return {}
  })
  callHookList(target, 'onReady')
  teardownRuntimeInstance(target)
  expect(disposed).toHaveBeenCalledTimes(1)
  expect(target[WEVU_EXPOSED_KEY]).toBeUndefined()
  released.resolve()
  await expect(pending).resolves.toBe(42)
  expect(target.exposed).toBe(exposed)
})

it('starts a new compatibility exposed view when a host instance is mounted again', () => {
  const target: InternalRuntimeState = { setData: vi.fn() }
  mountRuntimeInstance(target, createApp({}), undefined, (_props: unknown, { expose }: {
    expose: (value: Record<string, unknown>) => void
  }) => {
    expose({ old: true })
    return {}
  })
  teardownRuntimeInstance(target)
  mountRuntimeInstance(target, createApp({}), undefined, () => ({}))
  expect(target.exposed).toBeUndefined()
  teardownRuntimeInstance(target)
})
