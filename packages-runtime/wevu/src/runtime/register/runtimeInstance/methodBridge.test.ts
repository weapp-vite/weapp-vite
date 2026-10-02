import type { InternalRuntimeState, RuntimeInstance } from '../../types'
import { WEVU_HOST_INSTALL_METHOD_KEY, WEVU_PUBLIC_RUNTIME_KEY } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { bridgeRuntimeMethodsToTarget } from './methodBridge'

describe('host method namespace', () => {
  it('delegates installation without reading or assigning a same-name property', () => {
    const propertyRead = vi.fn(() => false)
    const propertyWrite = vi.fn()
    let installed: Record<string, (...args: unknown[]) => unknown> = {}
    const install = (methods: typeof installed) => {
      installed = methods
    }
    const proxy = {}
    const back = vi.fn(function (this: unknown, value: string) {
      return [this, value]
    })
    const runtime = { methods: { back }, proxy, state: {} } as unknown as RuntimeInstance<any, any, any>
    const target = {
      [WEVU_HOST_INSTALL_METHOD_KEY]: install,
      [WEVU_PUBLIC_RUNTIME_KEY]: runtime,
    } as unknown as InternalRuntimeState
    Object.defineProperty(target, 'back', { get: propertyRead, set: propertyWrite })
    bridgeRuntimeMethodsToTarget(target, runtime)
    expect(propertyRead).not.toHaveBeenCalled()
    expect(propertyWrite).not.toHaveBeenCalled()
    const method = installed.back!
    expect(method.call(target, 'first')).toEqual([proxy, 'first'])
    const replacement = vi.fn(() => 'updated')
    runtime.methods.back = replacement
    expect(method.call(target, 'second')).toBe('updated')
    expect(replacement).toHaveBeenCalledWith('second')
  })

  it('retains ordinary native instance methods when no host installer exists', () => {
    const existing = vi.fn()
    const added = vi.fn()
    const runtime = { methods: { existing, added }, proxy: {}, state: {} } as unknown as RuntimeInstance<any, any, any>
    const target = { existing, [WEVU_PUBLIC_RUNTIME_KEY]: runtime } as unknown as InternalRuntimeState & { added: () => void }
    bridgeRuntimeMethodsToTarget(target, runtime)
    expect(target.existing).toBe(existing)
    target.added()
    expect(added).toHaveBeenCalledOnce()
  })
})
