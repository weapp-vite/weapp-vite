import type { TemplateRefBinding } from '@/runtime/templateRefs'
import type { InternalRuntimeState } from '@/runtime/types'
import { WEVU_READY_CALLED_KEY, WEVU_TEMPLATE_REFS_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '@/runtime/app'
import { mountRuntimeInstance, teardownRuntimeInstance } from '@/runtime/register/runtimeInstance'
import { clearTemplateRefs, scheduleTemplateRefUpdate, updateTemplateRefs } from '@/runtime/templateRefs'
import { nextTick } from '@/scheduler'

const targets: InternalRuntimeState[] = []
const elementBinding: TemplateRefBinding = { selector: '.child', inFor: false, name: 'child', kind: 'element' }

function mountRefRuntime(bindings: TemplateRefBinding[]) {
  const hostCallbacks: Array<() => void> = []
  const queryCallbacks: Array<(results: unknown[]) => void> = []
  const target: InternalRuntimeState = {
    data: { count: 0 },
    [WEVU_READY_CALLED_KEY]: true,
    [WEVU_TEMPLATE_REFS_KEY]: bindings,
    setData: (_payload: Record<string, unknown>, callback: () => void) => {
      hostCallbacks.push(callback)
    },
    selectComponent: () => ({ marker: 'child' }),
    createSelectorQuery: () => ({
      select: () => ({ boundingClientRect() {} }),
      exec: (callback: (results: unknown[]) => void) => {
        queryCallbacks.push(callback)
      },
    }),
  }
  const app = createApp({ data: () => ({ count: 0 }) })
  const runtime = mountRuntimeInstance(target, app, undefined, undefined)
  targets.push(target)
  return { app, target, runtime, hostCallbacks, queryCallbacks }
}

afterEach(() => {
  for (const target of targets.splice(0)) {
    teardownRuntimeInstance(target)
  }
})

describe('runtime: template ref completion ownership', () => {
  it('rejects an instance tick on function-ref failure and permits the next commit to recover', async () => {
    const cause = new Error('function ref assignment')
    let fail = true
    let assigned: unknown
    const assign = (value: unknown) => {
      if (value && fail) {
        throw cause
      }
      assigned = value
    }
    const { runtime, hostCallbacks } = mountRefRuntime([
      { selector: '.child', inFor: false, kind: 'component', get: () => assign },
    ])
    runtime.proxy.count = 1
    const afterFailure = vi.fn()
    const failedTick = expect(runtime.proxy.$nextTick(afterFailure)).rejects.toBe(cause)
    await nextTick()
    hostCallbacks.shift()!()
    await failedTick
    expect(afterFailure).not.toHaveBeenCalled()

    fail = false
    runtime.proxy.count = 2
    const recoveredTick = runtime.proxy.$nextTick(() => assigned)
    await nextTick()
    hostCallbacks.shift()!()
    await expect(recoveredTick).resolves.toMatchObject({ marker: 'child' })
  })

  it('rejects asynchronous assignment once without stranding later instance ticks', async () => {
    const cause = new Error('asynchronous ref assignment')
    let fail = true
    let assigned: unknown
    const assign = vi.fn((value: unknown) => {
      if (value && fail) {
        throw cause
      }
      assigned = value
    })
    const { runtime, hostCallbacks, queryCallbacks } = mountRefRuntime([
      { ...elementBinding, name: undefined, get: () => assign },
    ])
    runtime.proxy.count = 1
    const failedTick = expect(runtime.proxy.$nextTick()).rejects.toBe(cause)
    await nextTick()
    hostCallbacks.shift()!()
    await nextTick()
    queryCallbacks[0]!([{ width: 120 }])
    await failedTick
    queryCallbacks[0]!([{ width: 240 }])
    expect(assign).toHaveBeenCalledOnce()

    fail = false
    runtime.proxy.count = 2
    const recoveredTick = runtime.proxy.$nextTick(() => assigned)
    await nextTick()
    hostCallbacks.shift()!()
    await nextTick()
    queryCallbacks[1]!([null])
    await expect(recoveredTick).resolves.toBeNull()
  })

  it('reports query-construction failure through the fourth argument, never through success', () => {
    const cause = new Error('query construction')
    const { target } = mountRefRuntime([elementBinding])
    target.createSelectorQuery = () => {
      throw cause
    }
    const onResolved = vi.fn()
    const onRejected = vi.fn()
    updateTemplateRefs(target, onResolved, undefined, onRejected)
    expect(onRejected).toHaveBeenCalledExactlyOnceWith(cause)
    expect(onResolved).not.toHaveBeenCalled()
    expect(() => updateTemplateRefs(target)).toThrow(cause)
  })

  it('drains every failed batch completion even when a rejection callback throws', async () => {
    const cause = new Error('assignment')
    const callbackCause = new Error('rejection callback')
    const assign = (value: unknown) => {
      if (value) {
        throw cause
      }
    }
    const { target, queryCallbacks } = mountRefRuntime([
      { ...elementBinding, name: undefined, get: () => assign },
    ])
    const onResolved = vi.fn()
    const firstRejected = vi.fn(() => {
      throw callbackCause
    })
    const secondRejected = vi.fn()
    scheduleTemplateRefUpdate(target, onResolved, undefined, firstRejected)
    scheduleTemplateRefUpdate(target, onResolved, undefined, secondRejected)
    await nextTick()
    expect(() => queryCallbacks[0]!([{ width: 120 }])).toThrow(callbackCause)
    queryCallbacks[0]!([null])
    expect(firstRejected).toHaveBeenCalledExactlyOnceWith(cause)
    expect(secondRejected).toHaveBeenCalledExactlyOnceWith(cause)
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('drains successful completions while retaining thrown callback errors and the assigned ref', async () => {
    const cause = new Error('success callback')
    const { target, runtime, queryCallbacks } = mountRefRuntime([elementBinding])
    const firstResolved = vi.fn(() => {
      throw cause
    })
    const secondResolved = vi.fn(() => runtime.proxy.$refs.child)
    const onRejected = vi.fn()
    scheduleTemplateRefUpdate(target, firstResolved, undefined, onRejected)
    scheduleTemplateRefUpdate(target, secondResolved, undefined, onRejected)
    await nextTick()
    expect(() => queryCallbacks[0]!([{ width: 120 }])).toThrow(cause)
    queryCallbacks[0]!([null])
    expect(firstResolved).toHaveBeenCalledOnce()
    expect(secondResolved).toHaveBeenCalledOnce()
    expect(secondResolved).toHaveReturnedWith(expect.objectContaining({ selector: '.child' }))
    expect(runtime.proxy.$refs.child).toMatchObject({ selector: '.child' })
    expect(onRejected).not.toHaveBeenCalled()
  })

  it('keeps the newest null ref when native selector queries complete in reverse order', async () => {
    const { runtime, hostCallbacks, queryCallbacks } = mountRefRuntime([elementBinding])
    runtime.proxy.count = 1
    await nextTick()
    hostCallbacks.shift()!()
    await nextTick()
    runtime.proxy.count = 2
    const readRef = vi.fn(() => runtime.proxy.$refs.child)
    const tick = runtime.proxy.$nextTick(readRef)
    await nextTick()
    hostCallbacks.shift()!()
    await nextTick()

    queryCallbacks[1]!([null])
    await nextTick()
    expect(readRef).not.toHaveBeenCalled()
    queryCallbacks[0]!([{ width: 120 }])
    await expect(tick).resolves.toBeNull()
    expect(readRef).toHaveBeenCalledOnce()
  })

  it.each([
    ['direct', updateTemplateRefs],
    ['scheduled', scheduleTemplateRefUpdate],
  ] as const)('does not restore a removed binding after an empty %s update', (_mode, update) => {
    const { target, runtime, queryCallbacks } = mountRefRuntime([elementBinding])
    const oldResolved = vi.fn()
    const emptyResolved = vi.fn()
    updateTemplateRefs(target, oldResolved)
    target[WEVU_TEMPLATE_REFS_KEY] = []
    update(target, emptyResolved)
    expect(emptyResolved).toHaveBeenCalledOnce()
    queryCallbacks[0]!([{ width: 120 }])
    expect(oldResolved).toHaveBeenCalledOnce()
    expect(runtime.proxy.$refs?.child).toBeUndefined()
  })

  it('settles a cleared in-flight query without resurrecting its ref', () => {
    const { target, runtime, queryCallbacks } = mountRefRuntime([elementBinding])
    const onResolved = vi.fn()
    updateTemplateRefs(target, onResolved)
    clearTemplateRefs(target)
    queryCallbacks[0]!([{ width: 120 }])
    queryCallbacks[0]!([{ width: 240 }])
    expect(onResolved).toHaveBeenCalledOnce()
    expect(runtime.proxy.$refs.child).toBeNull()
  })

  it('invalidates a scheduled assignment before it starts querying', async () => {
    const { target, runtime, queryCallbacks } = mountRefRuntime([elementBinding])
    const onResolved = vi.fn()
    scheduleTemplateRefUpdate(target, onResolved)
    clearTemplateRefs(target)
    await nextTick()
    expect(onResolved).toHaveBeenCalledOnce()
    expect(queryCallbacks).toEqual([])
    expect(runtime.proxy.$refs.child).toBeNull()
  })

  it('does not let a pre-teardown query populate a remounted runtime', () => {
    const { app, target, queryCallbacks } = mountRefRuntime([elementBinding])
    const onResolved = vi.fn()
    updateTemplateRefs(target, onResolved)
    teardownRuntimeInstance(target)
    const remounted = mountRuntimeInstance(target, app, undefined, undefined)
    queryCallbacks[0]!([{ width: 120 }])
    expect(onResolved).toHaveBeenCalledOnce()
    expect(remounted.proxy.$refs?.child).toBeUndefined()
  })

  it('assigns scoped-slot refs to their owner and fences that owner after cleanup', () => {
    const slot = mountRefRuntime([elementBinding])
    const owner = mountRefRuntime([elementBinding])
    updateTemplateRefs(slot.target, undefined, owner.target)
    slot.queryCallbacks[0]!([{ width: 120 }])
    const assigned = owner.runtime.proxy.$refs.child
    expect(assigned).toMatchObject({ selector: '.child' })
    expect(slot.runtime.proxy.$refs?.child).toBeUndefined()

    const onResolved = vi.fn()
    updateTemplateRefs(slot.target, onResolved, owner.target)
    clearTemplateRefs(owner.target)
    slot.queryCallbacks[1]!([{ width: 240 }])
    expect(onResolved).toHaveBeenCalledOnce()
    expect(owner.runtime.proxy.$refs.child).toBeNull()

    updateTemplateRefs(slot.target, onResolved, owner.target)
    teardownRuntimeInstance(owner.target)
    const remountedOwner = mountRuntimeInstance(owner.target, owner.app, undefined, undefined)
    slot.queryCallbacks[2]!([{ width: 240 }])
    expect(onResolved).toHaveBeenCalledTimes(2)
    expect(remountedOwner.proxy.$refs?.child).toBeUndefined()
  })
})
