import {
  WEAPI_MY_METHODS,
  WEAPI_MY_NON_FUNCTION_MEMBERS,
  WEAPI_TT_METHODS,
  WEAPI_TT_NON_FUNCTION_MEMBERS,
  WEAPI_WX_METHODS,
  WEAPI_WX_NON_FUNCTION_MEMBERS,
} from '@/core/apiCatalog'
import { resolveMethodMapping } from '@/core/methodMapping'
import { createWeapi } from '@/index'

interface MockAdapterBundle {
  adapter: Record<string, any>
  methodSpies: Record<string, ReturnType<typeof vi.fn>>
}

function createMockAdapter(methods: readonly string[], nonFunctionMembers: readonly string[] = []): MockAdapterBundle {
  const adapter: Record<string, any> = {}
  const methodSpies: Record<string, ReturnType<typeof vi.fn>> = {}

  for (const methodName of methods) {
    const spy = vi.fn((...args: any[]) => {
      const lastArg = args.length > 0 ? args[args.length - 1] : undefined
      if (lastArg && typeof lastArg === 'object') {
        lastArg.success?.({ ok: true, method: methodName })
        lastArg.complete?.({ ok: true, method: methodName })
      }
      return `${methodName}:raw`
    })
    methodSpies[methodName] = spy
    adapter[methodName] = spy
  }

  for (const member of nonFunctionMembers) {
    adapter[member] = {
      member,
      marker: `${member}:value`,
    }
  }

  return { adapter, methodSpies }
}

describe('weapi full api compatibility', () => {
  const wxMethodSet = new Set<string>(WEAPI_WX_METHODS)
  const myOnlyMethods = WEAPI_MY_METHODS.filter(method => !wxMethodSet.has(method))
  const ttOnlyMethods = WEAPI_TT_METHODS.filter(method => !wxMethodSet.has(method))

  it('routes all wx methods to wx adapter directly', () => {
    const { adapter, methodSpies } = createMockAdapter(WEAPI_WX_METHODS, WEAPI_WX_NON_FUNCTION_MEMBERS)
    const api = createWeapi({
      adapter,
      platform: 'wx',
    }) as Record<string, any>

    for (const methodName of WEAPI_WX_METHODS) {
      const fail = vi.fn()
      const complete = vi.fn()
      const success = vi.fn()
      const method = api[methodName]
      expect(typeof method).toBe('function')
      const spy = methodSpies[methodName]
      const beforeCount = spy.mock.calls.length
      const result = method({ success, fail, complete })
      expect(result).toBe(`${methodName}:raw`)
      expect(spy.mock.calls.length).toBe(beforeCount + 1)
      expect(fail).not.toHaveBeenCalled()
    }

    for (const member of WEAPI_WX_NON_FUNCTION_MEMBERS) {
      expect(api[member]).toMatchObject({
        member,
        marker: `${member}:value`,
      })
    }
  })

  it('routes wx methods to alipay target methods and reports unsupported APIs', () => {
    const { adapter, methodSpies } = createMockAdapter(WEAPI_MY_METHODS, WEAPI_MY_NON_FUNCTION_MEMBERS)
    const api = createWeapi({
      adapter,
      platform: 'my',
    }) as Record<string, any>

    for (const wxMethodName of WEAPI_WX_METHODS) {
      const fail = vi.fn()
      const complete = vi.fn()
      const success = vi.fn()
      const targetMethod = resolveMethodMapping('my', wxMethodName)?.target ?? wxMethodName
      const spy = methodSpies[targetMethod]
      api[wxMethodName]({ success, fail, complete })

      if (spy) {
        expect(spy).toHaveBeenCalled()
        expect(fail).not.toHaveBeenCalled()
      }
      else {
        expect(success).not.toHaveBeenCalled()
        expect(fail).toHaveBeenCalledWith(expect.objectContaining({
          errMsg: `my.${wxMethodName}:fail method not supported`,
        }))
        expect(complete).toHaveBeenCalledWith(expect.objectContaining({
          errMsg: `my.${wxMethodName}:fail method not supported`,
        }))
      }
    }
  })

  it('routes wx methods to douyin target methods and reports unsupported APIs', () => {
    const { adapter, methodSpies } = createMockAdapter(WEAPI_TT_METHODS, WEAPI_TT_NON_FUNCTION_MEMBERS)
    const api = createWeapi({
      adapter,
      platform: 'tt',
    }) as Record<string, any>

    for (const wxMethodName of WEAPI_WX_METHODS) {
      const fail = vi.fn()
      const complete = vi.fn()
      const success = vi.fn()
      const targetMethod = resolveMethodMapping('tt', wxMethodName)?.target ?? wxMethodName
      const spy = methodSpies[targetMethod]
      api[wxMethodName]({ success, fail, complete })

      if (spy) {
        expect(spy).toHaveBeenCalled()
        expect(fail).not.toHaveBeenCalled()
      }
      else {
        expect(success).not.toHaveBeenCalled()
        expect(fail).toHaveBeenCalledWith(expect.objectContaining({
          errMsg: `tt.${wxMethodName}:fail method not supported`,
        }))
        expect(complete).toHaveBeenCalledWith(expect.objectContaining({
          errMsg: `tt.${wxMethodName}:fail method not supported`,
        }))
      }
    }
  })

  it('supports all alipay-only methods on alipay adapter', () => {
    const { adapter, methodSpies } = createMockAdapter(WEAPI_MY_METHODS, WEAPI_MY_NON_FUNCTION_MEMBERS)
    const api = createWeapi({
      adapter,
      platform: 'my',
    }) as Record<string, any>

    for (const methodName of myOnlyMethods) {
      const fail = vi.fn()
      const complete = vi.fn()
      const success = vi.fn()
      const spy = methodSpies[methodName]
      const beforeCount = spy.mock.calls.length
      const result = api[methodName]({ success, fail, complete })
      expect(result).toBe(`${methodName}:raw`)
      expect(spy.mock.calls.length).toBe(beforeCount + 1)
      expect(fail).not.toHaveBeenCalled()
    }
  })

  it('supports all douyin-only methods on douyin adapter', () => {
    const { adapter, methodSpies } = createMockAdapter(WEAPI_TT_METHODS, WEAPI_TT_NON_FUNCTION_MEMBERS)
    const api = createWeapi({
      adapter,
      platform: 'tt',
    }) as Record<string, any>

    for (const methodName of ttOnlyMethods) {
      const fail = vi.fn()
      const complete = vi.fn()
      const success = vi.fn()
      const spy = methodSpies[methodName]
      const beforeCount = spy.mock.calls.length
      const result = api[methodName]({ success, fail, complete })
      expect(result).toBe(`${methodName}:raw`)
      expect(spy.mock.calls.length).toBe(beforeCount + 1)
      expect(fail).not.toHaveBeenCalled()
    }
  })
})
