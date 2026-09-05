import type { InternalRuntimeState } from '@/runtime/types'
import { describe, expect, it, vi } from 'vitest'
import { onBeforeUnmount, onMounted, onScopeDispose, onUnmounted, ref, watchSyncEffect } from '@/index'
import { createApp } from '@/runtime/app'
import { callHookList } from '@/runtime/hooks'
import { mountRuntimeInstance, teardownRuntimeInstance } from '@/runtime/register'

describe('runtime: before-unmount lifecycle', () => {
  it('releases mounted peers before their exposed methods and effect scopes are disposed', () => {
    const events: string[] = []
    const peers = new Set<InternalRuntimeState>()
    const close = vi.fn()
    const app = createApp({})
    const target: InternalRuntimeState = { setData: vi.fn() }

    mountRuntimeInstance(target, app, undefined, (_props: unknown, { expose }: {
      expose: (exposed: Record<string, unknown>) => void
    }) => {
      expose({ close })
      onMounted(() => {
        peers.add(target)
        events.push('mounted')
      })
      onUnmounted(() => events.push('unmounted'))
      onScopeDispose(() => events.push('disposed'))
      onBeforeUnmount(() => {
        events.push('beforeUnmount')
        const exposed = target.exposed
        if (!exposed || typeof exposed.close !== 'function') {
          throw new Error('Expected exposed methods to remain available before unmount')
        }
        exposed.close()
        peers.delete(target)
      })
      return {}
    })

    expect(events).toEqual([])
    callHookList(target, 'onReady')
    expect(peers.has(target)).toBe(true)
    expect(events).toEqual(['mounted'])

    teardownRuntimeInstance(target)
    expect(events).toEqual(['mounted', 'beforeUnmount', 'unmounted', 'disposed'])
    expect(peers.has(target)).toBe(false)
    expect(close).toHaveBeenCalledTimes(1)

    teardownRuntimeInstance(target)
    expect(events).toEqual(['mounted', 'beforeUnmount', 'unmounted', 'disposed'])
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('owns reactive work and disposals registered by before-unmount hooks', () => {
    const source = ref(0)
    const seen: number[] = []
    const disposed = vi.fn()
    const target: InternalRuntimeState = { setData: vi.fn() }

    mountRuntimeInstance(target, createApp({}), undefined, () => {
      onBeforeUnmount(() => {
        watchSyncEffect(() => seen.push(source.value))
        onScopeDispose(disposed)
      })
      return {}
    })

    expect(seen).toEqual([])
    teardownRuntimeInstance(target)
    expect(seen).toEqual([0])
    expect(disposed).toHaveBeenCalledTimes(1)
    source.value++
    expect(seen).toEqual([0])
  })

  it('rolls back a failed setup without firing unmount lifecycle hooks', () => {
    const target: InternalRuntimeState = { setData: vi.fn() }
    const beforeUnmount = vi.fn()
    const unmounted = vi.fn()
    const disposed = vi.fn()
    const failure = new Error('setup failed')

    expect(() => mountRuntimeInstance(target, createApp({}), undefined, () => {
      onBeforeUnmount(beforeUnmount)
      onUnmounted(unmounted)
      onScopeDispose(disposed)
      throw failure
    })).toThrow(failure)

    expect(beforeUnmount).not.toHaveBeenCalled()
    expect(unmounted).not.toHaveBeenCalled()
    expect(disposed).toHaveBeenCalledTimes(1)
  })
})
