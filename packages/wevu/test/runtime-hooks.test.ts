/* eslint-disable ts/no-this-alias, test/no-identical-title */
import type { InternalRuntimeState } from '@/runtime/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  callHookList,
  callHookReturn,
  getCurrentInstance,
  onAddToFavorites,
  onAppError,
  onAppHide,
  onAppShow,
  onHide,
  onPageScroll,
  onReady,
  onRouteDone,
  onSaveExitState,
  onShareAppMessage,
  onShareTimeline,
  onShow,
  onTabItemTap,
  onUnload,
  setCurrentInstance,
} from '@/runtime/hooks'

describe('hooks - getCurrentInstance and setCurrentInstance', () => {
  afterEach(() => {
    setCurrentInstance(undefined)
  })

  it('should return undefined when no instance set', () => {
    expect(getCurrentInstance()).toBeUndefined()
  })

  it('should set and get current instance', () => {
    const instance = { __wevu: {} } as InternalRuntimeState

    setCurrentInstance(instance)

    expect(getCurrentInstance()).toBe(instance)
  })

  it('should allow clearing current instance', () => {
    const instance = { __wevu: {} } as InternalRuntimeState

    setCurrentInstance(instance)
    expect(getCurrentInstance()).toBe(instance)

    setCurrentInstance(undefined)
    expect(getCurrentInstance()).toBeUndefined()
  })

  it('should handle multiple instance switches', () => {
    const instance1 = { __wevu: { id: 1 } } as any
    const instance2 = { __wevu: { id: 2 } } as any

    setCurrentInstance(instance1)
    expect(getCurrentInstance().__wevu.id).toBe(1)

    setCurrentInstance(instance2)
    expect(getCurrentInstance().__wevu.id).toBe(2)

    setCurrentInstance(instance1)
    expect(getCurrentInstance().__wevu.id).toBe(1)
  })
})

describe('hooks - lifecycle registration', () => {
  let instance: InternalRuntimeState

  beforeEach(() => {
    instance = { __wevu: {}, __wevuHooks: {} } as any
    setCurrentInstance(instance)
  })

  afterEach(() => {
    setCurrentInstance(undefined)
  })

  describe('onShow', () => {
    it('should register onShow hook', () => {
      const handler = vi.fn()
      onShow(handler)

      expect(instance.__wevuHooks?.onShow).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onShow(vi.fn())).toThrow('onShow() must be called synchronously inside setup()')
    })

    it('should allow multiple onShow handlers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onShow(handler1)
      onShow(handler2)

      expect(instance.__wevuHooks?.onShow).toEqual([handler1, handler2])
    })
  })

  describe('onHide', () => {
    it('should register onHide hook', () => {
      const handler = vi.fn()
      onHide(handler)

      expect(instance.__wevuHooks?.onHide).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onHide(vi.fn())).toThrow('onHide() must be called synchronously inside setup()')
    })
  })

  describe('onReady', () => {
    it('should register onReady hook', () => {
      const handler = vi.fn()
      onReady(handler)

      expect(instance.__wevuHooks?.onReady).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onReady(vi.fn())).toThrow('onReady() must be called synchronously inside setup()')
    })
  })

  describe('onUnload', () => {
    it('should register onUnload hook', () => {
      const handler = vi.fn()
      onUnload(handler)

      expect(instance.__wevuHooks?.onUnload).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onUnload(vi.fn())).toThrow('onUnload() must be called synchronously inside setup()')
    })
  })

  describe('onPageScroll', () => {
    it('should register onPageScroll hook', () => {
      const handler = vi.fn()
      onPageScroll(handler)

      expect(instance.__wevuHooks?.onPageScroll).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onPageScroll(vi.fn())).toThrow('onPageScroll() must be called synchronously inside setup()')
    })
  })

  describe('onRouteDone', () => {
    it('should register onRouteDone hook', () => {
      const handler = vi.fn()
      onRouteDone(handler)

      expect(instance.__wevuHooks?.onRouteDone).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onRouteDone(vi.fn())).toThrow('onRouteDone() must be called synchronously inside setup()')
    })
  })

  describe('onTabItemTap', () => {
    it('should register onTabItemTap hook', () => {
      const handler = vi.fn()
      onTabItemTap(handler)

      expect(instance.__wevuHooks?.onTabItemTap).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onTabItemTap(vi.fn())).toThrow('onTabItemTap() must be called synchronously inside setup()')
    })
  })

  describe('App-level hooks', () => {
    it('should register onAppShow hook', () => {
      const handler = vi.fn()
      onAppShow(handler)

      expect(instance.__wevuHooks?.onAppShow).toContain(handler)
    })

    it('should register onAppHide hook', () => {
      const handler = vi.fn()
      onAppHide(handler)

      expect(instance.__wevuHooks?.onAppHide).toContain(handler)
    })

    it('should register onAppError hook', () => {
      const handler = vi.fn()
      onAppError(handler)

      expect(instance.__wevuHooks?.onAppError).toContain(handler)
    })

    it('should throw when onAppShow called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onAppShow(vi.fn())).toThrow('onAppShow() must be called synchronously inside setup()')
    })

    it('should throw when onAppHide called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onAppHide(vi.fn())).toThrow('onAppHide() must be called synchronously inside setup()')
    })

    it('should throw when onAppError called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onAppError(vi.fn())).toThrow('onAppError() must be called synchronously inside setup()')
    })
  })

  describe('Single-handler hooks', () => {
    it('should register onSaveExitState as single handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onSaveExitState(handler1)
      onSaveExitState(handler2)

      // Should replace, not append
      expect(instance.__wevuHooks?.onSaveExitState).toBe(handler2)
    })

    it('should register onShareAppMessage as single handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onShareAppMessage(handler1)
      onShareAppMessage(handler2)

      expect(instance.__wevuHooks?.onShareAppMessage).toBe(handler2)
    })

    it('should register onShareTimeline as single handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onShareTimeline(handler1)
      onShareTimeline(handler2)

      expect(instance.__wevuHooks?.onShareTimeline).toBe(handler2)
    })

    it('should register onAddToFavorites as single handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onAddToFavorites(handler1)
      onAddToFavorites(handler2)

      expect(instance.__wevuHooks?.onAddToFavorites).toBe(handler2)
    })

    it('should throw when single-handler hooks called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onSaveExitState(vi.fn())).toThrow('onSaveExitState() must be called synchronously inside setup()')
      expect(() => onShareAppMessage(vi.fn())).toThrow('onShareAppMessage() must be called synchronously inside setup()')
      expect(() => onShareTimeline(vi.fn())).toThrow('onShareTimeline() must be called synchronously inside setup()')
      expect(() => onAddToFavorites(vi.fn())).toThrow('onAddToFavorites() must be called synchronously inside setup()')
    })
  })
})

describe('hooks - callHookList', () => {
  let instance: InternalRuntimeState

  beforeEach(() => {
    instance = {
      __wevu: {
        proxy: { proxyContext: true },
      },
      __wevuHooks: {},
    } as any
  })

  it('should call all hooks in array', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const handler3 = vi.fn()

    instance.__wevuHooks!.onShow = [handler1, handler2, handler3]

    callHookList(instance, 'onShow')

    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
    expect(handler3).toHaveBeenCalledOnce()
  })

  it('should call hook with arguments', () => {
    const handler = vi.fn()
    instance.__wevuHooks!.onPageScroll = [handler]

    callHookList(instance, 'onPageScroll', [{ scrollTop: 100 }])

    expect(handler).toHaveBeenCalledWith({ scrollTop: 100 })
  })

  it('should use proxy as context when available', () => {
    let capturedThis: any
    const handler = function (this: any) {
      capturedThis = this
    }

    instance.__wevuHooks!.onShow = [handler]

    callHookList(instance, 'onShow')

    expect(capturedThis).toEqual({ proxyContext: true })
  })

  it('should use instance as context when no proxy', () => {
    instance.__wevu = undefined
    let capturedThis: any
    const handler = function (this: any) {
      capturedThis = this
    }

    instance.__wevuHooks!.onShow = [handler]

    callHookList(instance, 'onShow')

    expect(capturedThis).toBe(instance)
  })

  it('should handle hook errors gracefully', () => {
    const handler1 = vi.fn(() => {
      throw new Error('Hook error')
    })
    const handler2 = vi.fn()

    instance.__wevuHooks!.onShow = [handler1, handler2]

    // Should not throw
    expect(() => callHookList(instance, 'onShow')).not.toThrow()

    // Second handler should still be called
    expect(handler2).toHaveBeenCalled()
  })

  it('should do nothing when hooks not defined', () => {
    delete instance.__wevuHooks

    expect(() => callHookList(instance, 'onShow')).not.toThrow()
  })

  it('should do nothing when hook name not found', () => {
    instance.__wevuHooks = {}

    expect(() => callHookList(instance, 'onShow')).not.toThrow()
  })

  it('should call single function hook', () => {
    const handler = vi.fn()
    instance.__wevuHooks!.onSaveExitState = handler

    callHookList(instance, 'onSaveExitState')

    expect(handler).toHaveBeenCalledOnce()
  })

  it('should ignore errors in single function hook', () => {
    const handler = vi.fn(() => {
      throw new Error('Hook error')
    })
    instance.__wevuHooks!.onSaveExitState = handler

    expect(() => callHookList(instance, 'onSaveExitState')).not.toThrow()
  })

  it('should handle empty hook array', () => {
    instance.__wevuHooks!.onShow = []

    expect(() => callHookList(instance, 'onShow')).not.toThrow()
  })
})

describe('hooks - callHookReturn', () => {
  let instance: InternalRuntimeState

  beforeEach(() => {
    instance = {
      __wevu: {
        proxy: { proxyContext: true },
      },
      __wevuHooks: {},
    } as any
  })

  it('should return value from single function hook', () => {
    const handler = vi.fn(() => ({ title: 'Shared' }))
    instance.__wevuHooks!.onShareAppMessage = handler

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toEqual({ title: 'Shared' })
    expect(handler).toHaveBeenCalled()
  })

  it('should return value from last hook in array', () => {
    const handler1 = vi.fn(() => 'first')
    const handler2 = vi.fn(() => 'second')
    const handler3 = vi.fn(() => 'third')

    instance.__wevuHooks!.onSaveExitState = [handler1, handler2, handler3]

    const result = callHookReturn(instance, 'onSaveExitState')

    expect(result).toBe('third')
    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
    expect(handler3).toHaveBeenCalled()
  })

  it('should pass arguments to hook', () => {
    const handler = vi.fn((arg: any) => arg.data)
    instance.__wevuHooks!.onShareAppMessage = handler

    const result = callHookReturn(instance, 'onShareAppMessage', [{ data: 'test' }])

    expect(result).toBe('test')
    expect(handler).toHaveBeenCalledWith({ data: 'test' })
  })

  it('should use proxy as context', () => {
    let capturedThis: any
    const handler = function (this: any) {
      capturedThis = this
      return 'result'
    }

    instance.__wevuHooks!.onShareAppMessage = handler

    callHookReturn(instance, 'onShareAppMessage')

    expect(capturedThis).toEqual({ proxyContext: true })
  })

  it('should use instance as context when no proxy', () => {
    instance.__wevu = undefined
    let capturedThis: any
    const handler = function (this: any) {
      capturedThis = this
      return 'result'
    }

    instance.__wevuHooks!.onShareAppMessage = handler

    callHookReturn(instance, 'onShareAppMessage')

    expect(capturedThis).toBe(instance)
  })

  it('should return undefined on hook error', () => {
    const handler = vi.fn(() => {
      throw new Error('Hook error')
    })
    instance.__wevuHooks!.onShareAppMessage = handler

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toBeUndefined()
  })

  it('should return undefined when hooks not defined', () => {
    delete instance.__wevuHooks

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toBeUndefined()
  })

  it('should return undefined when hook name not found', () => {
    instance.__wevuHooks = {}

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toBeUndefined()
  })

  it('should continue on error in array hooks', () => {
    const handler1 = vi.fn(() => {
      throw new Error('Error 1')
    })
    const handler2 = vi.fn(() => {
      throw new Error('Error 2')
    })
    const handler3 = vi.fn(() => 'success')

    instance.__wevuHooks!.onSaveExitState = [handler1, handler2, handler3]

    const result = callHookReturn(instance, 'onSaveExitState')

    expect(result).toBe('success')
  })

  it('should handle null/undefined return values', () => {
    const handler1 = vi.fn(() => null)
    instance.__wevuHooks!.onShareAppMessage = handler1

    expect(callHookReturn(instance, 'onShareAppMessage')).toBeNull()

    const handler2 = vi.fn(() => undefined)
    instance.__wevuHooks!.onShareAppMessage = handler2

    expect(callHookReturn(instance, 'onShareAppMessage')).toBeUndefined()
  })

  it('should handle 0 and false return values', () => {
    const handler1 = vi.fn(() => 0)
    instance.__wevuHooks!.onShareAppMessage = handler1

    expect(callHookReturn(instance, 'onShareAppMessage')).toBe(0)

    const handler2 = vi.fn(() => false)
    instance.__wevuHooks!.onShareAppMessage = handler2

    expect(callHookReturn(instance, 'onShareAppMessage')).toBe(false)
  })

  it('should handle empty string return value', () => {
    const handler = vi.fn(() => '')
    instance.__wevuHooks!.onShareAppMessage = handler

    expect(callHookReturn(instance, 'onShareAppMessage')).toBe('')
  })

  it('should return undefined for non-function/array hooks', () => {
    instance.__wevuHooks!.onShareAppMessage = 'invalid' as any

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toBeUndefined()
  })
})

describe('hooks - getCurrentInstance and setCurrentInstance', () => {
  afterEach(() => {
    setCurrentInstance(undefined)
  })

  it('should return undefined when no instance set', () => {
    expect(getCurrentInstance()).toBeUndefined()
  })

  it('should set and get current instance', () => {
    const instance = { __wevu: {} } as InternalRuntimeState

    setCurrentInstance(instance)

    expect(getCurrentInstance()).toBe(instance)
  })

  it('should allow clearing current instance', () => {
    const instance = { __wevu: {} } as InternalRuntimeState

    setCurrentInstance(instance)
    expect(getCurrentInstance()).toBe(instance)

    setCurrentInstance(undefined)
    expect(getCurrentInstance()).toBeUndefined()
  })

  it('should handle multiple instance switches', () => {
    const instance1 = { __wevu: { id: 1 } } as any
    const instance2 = { __wevu: { id: 2 } } as any

    setCurrentInstance(instance1)
    expect(getCurrentInstance().__wevu.id).toBe(1)

    setCurrentInstance(instance2)
    expect(getCurrentInstance().__wevu.id).toBe(2)

    setCurrentInstance(instance1)
    expect(getCurrentInstance().__wevu.id).toBe(1)
  })
})

describe('hooks - lifecycle registration', () => {
  let instance: InternalRuntimeState

  beforeEach(() => {
    instance = { __wevu: {}, __wevuHooks: {} } as any
    setCurrentInstance(instance)
  })

  afterEach(() => {
    setCurrentInstance(undefined)
  })

  describe('onShow', () => {
    it('should register onShow hook', () => {
      const handler = vi.fn()
      onShow(handler)

      expect(instance.__wevuHooks?.onShow).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onShow(vi.fn())).toThrow('onShow() must be called synchronously inside setup()')
    })

    it('should allow multiple onShow handlers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onShow(handler1)
      onShow(handler2)

      expect(instance.__wevuHooks?.onShow).toEqual([handler1, handler2])
    })
  })

  describe('onHide', () => {
    it('should register onHide hook', () => {
      const handler = vi.fn()
      onHide(handler)

      expect(instance.__wevuHooks?.onHide).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onHide(vi.fn())).toThrow('onHide() must be called synchronously inside setup()')
    })
  })

  describe('onReady', () => {
    it('should register onReady hook', () => {
      const handler = vi.fn()
      onReady(handler)

      expect(instance.__wevuHooks?.onReady).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onReady(vi.fn())).toThrow('onReady() must be called synchronously inside setup()')
    })
  })

  describe('onUnload', () => {
    it('should register onUnload hook', () => {
      const handler = vi.fn()
      onUnload(handler)

      expect(instance.__wevuHooks?.onUnload).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onUnload(vi.fn())).toThrow('onUnload() must be called synchronously inside setup()')
    })
  })

  describe('onPageScroll', () => {
    it('should register onPageScroll hook', () => {
      const handler = vi.fn()
      onPageScroll(handler)

      expect(instance.__wevuHooks?.onPageScroll).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onPageScroll(vi.fn())).toThrow('onPageScroll() must be called synchronously inside setup()')
    })
  })

  describe('onRouteDone', () => {
    it('should register onRouteDone hook', () => {
      const handler = vi.fn()
      onRouteDone(handler)

      expect(instance.__wevuHooks?.onRouteDone).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onRouteDone(vi.fn())).toThrow('onRouteDone() must be called synchronously inside setup()')
    })
  })

  describe('onTabItemTap', () => {
    it('should register onTabItemTap hook', () => {
      const handler = vi.fn()
      onTabItemTap(handler)

      expect(instance.__wevuHooks?.onTabItemTap).toContain(handler)
    })

    it('should throw when called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onTabItemTap(vi.fn())).toThrow('onTabItemTap() must be called synchronously inside setup()')
    })
  })

  describe('App-level hooks', () => {
    it('should register onAppShow hook', () => {
      const handler = vi.fn()
      onAppShow(handler)

      expect(instance.__wevuHooks?.onAppShow).toContain(handler)
    })

    it('should register onAppHide hook', () => {
      const handler = vi.fn()
      onAppHide(handler)

      expect(instance.__wevuHooks?.onAppHide).toContain(handler)
    })

    it('should register onAppError hook', () => {
      const handler = vi.fn()
      onAppError(handler)

      expect(instance.__wevuHooks?.onAppError).toContain(handler)
    })

    it('should throw when onAppShow called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onAppShow(vi.fn())).toThrow('onAppShow() must be called synchronously inside setup()')
    })

    it('should throw when onAppHide called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onAppHide(vi.fn())).toThrow('onAppHide() must be called synchronously inside setup()')
    })

    it('should throw when onAppError called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onAppError(vi.fn())).toThrow('onAppError() must be called synchronously inside setup()')
    })
  })

  describe('Single-handler hooks', () => {
    it('should register onSaveExitState as single handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onSaveExitState(handler1)
      onSaveExitState(handler2)

      // Should replace, not append
      expect(instance.__wevuHooks?.onSaveExitState).toBe(handler2)
    })

    it('should register onShareAppMessage as single handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onShareAppMessage(handler1)
      onShareAppMessage(handler2)

      expect(instance.__wevuHooks?.onShareAppMessage).toBe(handler2)
    })

    it('should register onShareTimeline as single handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onShareTimeline(handler1)
      onShareTimeline(handler2)

      expect(instance.__wevuHooks?.onShareTimeline).toBe(handler2)
    })

    it('should register onAddToFavorites as single handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      onAddToFavorites(handler1)
      onAddToFavorites(handler2)

      expect(instance.__wevuHooks?.onAddToFavorites).toBe(handler2)
    })

    it('should throw when single-handler hooks called outside setup', () => {
      setCurrentInstance(undefined)

      expect(() => onSaveExitState(vi.fn())).toThrow('onSaveExitState() must be called synchronously inside setup()')
      expect(() => onShareAppMessage(vi.fn())).toThrow('onShareAppMessage() must be called synchronously inside setup()')
      expect(() => onShareTimeline(vi.fn())).toThrow('onShareTimeline() must be called synchronously inside setup()')
      expect(() => onAddToFavorites(vi.fn())).toThrow('onAddToFavorites() must be called synchronously inside setup()')
    })
  })
})

describe('hooks - callHookList', () => {
  let instance: InternalRuntimeState

  beforeEach(() => {
    instance = {
      __wevu: {
        proxy: { proxyContext: true },
      },
      __wevuHooks: {},
    } as any
  })

  it('should call all hooks in array', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const handler3 = vi.fn()

    instance.__wevuHooks!.onShow = [handler1, handler2, handler3]

    callHookList(instance, 'onShow')

    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
    expect(handler3).toHaveBeenCalledOnce()
  })

  it('should call hook with arguments', () => {
    const handler = vi.fn()
    instance.__wevuHooks!.onPageScroll = [handler]

    callHookList(instance, 'onPageScroll', [{ scrollTop: 100 }])

    expect(handler).toHaveBeenCalledWith({ scrollTop: 100 })
  })

  it('should use proxy as context when available', () => {
    let capturedThis: any
    const handler = function (this: any) {
      capturedThis = this
    }

    instance.__wevuHooks!.onShow = [handler]

    callHookList(instance, 'onShow')

    expect(capturedThis).toEqual({ proxyContext: true })
  })

  it('should use instance as context when no proxy', () => {
    instance.__wevu = undefined
    let capturedThis: any
    const handler = function (this: any) {
      capturedThis = this
    }

    instance.__wevuHooks!.onShow = [handler]

    callHookList(instance, 'onShow')

    expect(capturedThis).toBe(instance)
  })

  it('should handle hook errors gracefully', () => {
    const handler1 = vi.fn(() => {
      throw new Error('Hook error')
    })
    const handler2 = vi.fn()

    instance.__wevuHooks!.onShow = [handler1, handler2]

    // Should not throw
    expect(() => callHookList(instance, 'onShow')).not.toThrow()

    // Second handler should still be called
    expect(handler2).toHaveBeenCalled()
  })

  it('should do nothing when hooks not defined', () => {
    delete instance.__wevuHooks

    expect(() => callHookList(instance, 'onShow')).not.toThrow()
  })

  it('should do nothing when hook name not found', () => {
    instance.__wevuHooks = {}

    expect(() => callHookList(instance, 'onShow')).not.toThrow()
  })

  it('should call single function hook', () => {
    const handler = vi.fn()
    instance.__wevuHooks!.onSaveExitState = handler

    callHookList(instance, 'onSaveExitState')

    expect(handler).toHaveBeenCalledOnce()
  })

  it('should ignore errors in single function hook', () => {
    const handler = vi.fn(() => {
      throw new Error('Hook error')
    })
    instance.__wevuHooks!.onSaveExitState = handler

    expect(() => callHookList(instance, 'onSaveExitState')).not.toThrow()
  })

  it('should handle empty hook array', () => {
    instance.__wevuHooks!.onShow = []

    expect(() => callHookList(instance, 'onShow')).not.toThrow()
  })
})

describe('hooks - callHookReturn', () => {
  let instance: InternalRuntimeState

  beforeEach(() => {
    instance = {
      __wevu: {
        proxy: { proxyContext: true },
      },
      __wevuHooks: {},
    } as any
  })

  it('should return value from single function hook', () => {
    const handler = vi.fn(() => ({ title: 'Shared' }))
    instance.__wevuHooks!.onShareAppMessage = handler

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toEqual({ title: 'Shared' })
    expect(handler).toHaveBeenCalled()
  })

  it('should return value from last hook in array', () => {
    const handler1 = vi.fn(() => 'first')
    const handler2 = vi.fn(() => 'second')
    const handler3 = vi.fn(() => 'third')

    instance.__wevuHooks!.onSaveExitState = [handler1, handler2, handler3]

    const result = callHookReturn(instance, 'onSaveExitState')

    expect(result).toBe('third')
    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
    expect(handler3).toHaveBeenCalled()
  })

  it('should pass arguments to hook', () => {
    const handler = vi.fn((arg: any) => arg.data)
    instance.__wevuHooks!.onShareAppMessage = handler

    const result = callHookReturn(instance, 'onShareAppMessage', [{ data: 'test' }])

    expect(result).toBe('test')
    expect(handler).toHaveBeenCalledWith({ data: 'test' })
  })

  it('should use proxy as context', () => {
    let capturedThis: any
    const handler = function (this: any) {
      capturedThis = this
      return 'result'
    }

    instance.__wevuHooks!.onShareAppMessage = handler

    callHookReturn(instance, 'onShareAppMessage')

    expect(capturedThis).toEqual({ proxyContext: true })
  })

  it('should use instance as context when no proxy', () => {
    instance.__wevu = undefined
    let capturedThis: any
    const handler = function (this: any) {
      capturedThis = this
      return 'result'
    }

    instance.__wevuHooks!.onShareAppMessage = handler

    callHookReturn(instance, 'onShareAppMessage')

    expect(capturedThis).toBe(instance)
  })

  it('should return undefined on hook error', () => {
    const handler = vi.fn(() => {
      throw new Error('Hook error')
    })
    instance.__wevuHooks!.onShareAppMessage = handler

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toBeUndefined()
  })

  it('should return undefined when hooks not defined', () => {
    delete instance.__wevuHooks

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toBeUndefined()
  })

  it('should return undefined when hook name not found', () => {
    instance.__wevuHooks = {}

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toBeUndefined()
  })

  it('should continue on error in array hooks', () => {
    const handler1 = vi.fn(() => {
      throw new Error('Error 1')
    })
    const handler2 = vi.fn(() => {
      throw new Error('Error 2')
    })
    const handler3 = vi.fn(() => 'success')

    instance.__wevuHooks!.onSaveExitState = [handler1, handler2, handler3]

    const result = callHookReturn(instance, 'onSaveExitState')

    expect(result).toBe('success')
  })

  it('should handle null/undefined return values', () => {
    const handler1 = vi.fn(() => null)
    instance.__wevuHooks!.onShareAppMessage = handler1

    expect(callHookReturn(instance, 'onShareAppMessage')).toBeNull()

    const handler2 = vi.fn(() => undefined)
    instance.__wevuHooks!.onShareAppMessage = handler2

    expect(callHookReturn(instance, 'onShareAppMessage')).toBeUndefined()
  })

  it('should handle 0 and false return values', () => {
    const handler1 = vi.fn(() => 0)
    instance.__wevuHooks!.onShareAppMessage = handler1

    expect(callHookReturn(instance, 'onShareAppMessage')).toBe(0)

    const handler2 = vi.fn(() => false)
    instance.__wevuHooks!.onShareAppMessage = handler2

    expect(callHookReturn(instance, 'onShareAppMessage')).toBe(false)
  })

  it('should handle empty string return value', () => {
    const handler = vi.fn(() => '')
    instance.__wevuHooks!.onShareAppMessage = handler

    expect(callHookReturn(instance, 'onShareAppMessage')).toBe('')
  })

  it('should return undefined for non-function/array hooks', () => {
    instance.__wevuHooks!.onShareAppMessage = 'invalid' as any

    const result = callHookReturn(instance, 'onShareAppMessage')

    expect(result).toBeUndefined()
  })
})
