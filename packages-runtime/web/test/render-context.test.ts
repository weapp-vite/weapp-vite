import { afterEach, describe, expect, it, vi } from 'vitest'
import { setRuntimeExecutionMode } from '../src/runtime/execution'
import { createRenderContext, createScope } from '../src/runtime/renderContext'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

describe('renderContext renderTemplate', () => {
  afterEach(() => {
    setRuntimeExecutionMode('compat')
    setRuntimeWarningOptions()
    vi.restoreAllMocks()
  })

  it('coerces non-string template names', () => {
    const ctx = createRenderContext({} as any, {})
    const templates = {
      1: () => 'ok',
    }

    expect(ctx.renderTemplate(templates, 1, {}, ctx)).toBe('ok')
  })

  it('warns when template is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = createRenderContext({} as any, {})

    expect(ctx.renderTemplate({}, 'missing', {}, ctx)).toBe('')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('未找到模板')

    warn.mockRestore()
  })

  it('returns empty module when wxs runtime fails in safe mode', () => {
    setRuntimeExecutionMode('safe')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = createRenderContext({} as any, {})
    const moduleExports = ctx.createWxsModule('module.exports = ;', '/safe-error.wxs')
    expect(moduleExports).toEqual({})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('safe 模式下忽略 WXS 执行错误')
    setRuntimeExecutionMode('compat')
  })

  it('throws when wxs runtime fails in strict mode', () => {
    setRuntimeExecutionMode('strict')
    const ctx = createRenderContext({} as any, {})
    expect(() => ctx.createWxsModule('module.exports = ;', '/strict-error.wxs')).toThrow(/WXS 执行失败/)
    setRuntimeExecutionMode('compat')
  })

  it('evaluates expressions, scopes, lists and key strategies', () => {
    const ctx = createRenderContext({} as any, {})
    const parent = ctx.createScope({ inherited: 1 }, { local: 2 })

    expect(ctx.eval('', parent)).toBeUndefined()
    expect(ctx.eval('   ', parent)).toBeUndefined()
    expect(ctx.eval('1', undefined as any)).toBe(1)
    expect(createScope({ direct: 1 }).direct).toBe(1)
    expect(ctx.createScope(parent).inherited).toBe(1)
    expect(ctx.eval('inherited + local', parent)).toBe(3)
    expect(ctx.eval('value + helper', { value: 2 }, { helper: 3 })).toBe(5)
    expect(ctx.mergeScope(parent, null)).toBe(parent)
    expect(ctx.mergeScope(undefined as any, null)).toEqual({})
    expect(ctx.mergeScope(parent, { merged: 4 }).merged).toBe(4)
    expect(ctx.normalizeList([1, 2])).toEqual([1, 2])
    expect(ctx.normalizeList(null)).toEqual([])
    expect(ctx.normalizeList(3.8)).toEqual([0, 1, 2])
    expect(ctx.normalizeList(-1)).toEqual([])
    expect(ctx.normalizeList({ a: 1, b: 2 })).toEqual([1, 2])
    expect(ctx.normalizeList('invalid')).toEqual([])

    expect(ctx.key('', 'primitive', 2, {})).toBe('primitive')
    expect(ctx.key('', {}, 2, {})).toBe(2)
    expect(ctx.key('*this', { id: 1 }, 0, {})).toEqual({ id: 1 })
    expect(ctx.key('{{ item.id }}', {}, 0, { item: { id: 7 } })).toBe(7)
    expect(ctx.key('id', { id: 8 }, 0, {})).toBe(8)
    expect(ctx.key('item.id', {}, 0, { item: { id: 9 } })).toBe(9)
    expect(ctx.key('helper', {}, 0, {}, { helper: 10 })).toBe(10)
    expect(ctx.key('', null, 11, undefined as any)).toBe(11)
  })

  it('handles expression parse and runtime failures by execution mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = createRenderContext({} as any, {})

    setRuntimeExecutionMode('safe')
    expect(ctx.eval('safe ) parse', {})).toBeUndefined()
    expect(ctx.eval('safeMissing.value', {})).toBeUndefined()

    setRuntimeExecutionMode('compat')
    expect(ctx.eval('compatMissing.value', {})).toBeUndefined()
    expect(() => ctx.eval('compat ) parse', {})).toThrow(SyntaxError)

    setRuntimeExecutionMode('strict')
    expect(() => ctx.eval('strictMissing.value', {})).toThrow(/strict 模式下表达式执行失败/)
    expect(() => ctx.eval('strict ) parse', {})).toThrow(/无法解析表达式/)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('safe 模式下忽略表达式'))

    const stringErrorScope = new Proxy({}, {
      has: () => true,
      get: () => {
        // eslint-disable-next-line no-throw-literal -- 覆盖代理宿主抛出字符串的兼容路径。
        throw 'string failure'
      },
    })
    setRuntimeExecutionMode('safe')
    expect(ctx.eval('safeStringFailure', stringErrorScope)).toBeUndefined()
    setRuntimeExecutionMode('strict')
    expect(() => ctx.eval('strictStringFailure', stringErrorScope)).toThrow('string failure')

    const OriginalFunction = globalThis.Function
    function ThrowingFunction() {
      // eslint-disable-next-line no-throw-literal -- 覆盖动态解析宿主抛出字符串的兼容路径。
      throw 'parse string failure'
    }
    vi.stubGlobal('Function', ThrowingFunction)
    setRuntimeExecutionMode('safe')
    expect(ctx.eval('forcedParseFailure', {})).toBeUndefined()
    vi.stubGlobal('Function', OriginalFunction)
  })

  it('dispatches function and named event handlers with mini-program event data', () => {
    const instance = { named: vi.fn() } as any
    const method = vi.fn()
    const direct = vi.fn()
    const ctx = createRenderContext(instance, { method })
    const stopPropagation = vi.fn()
    const event = {
      currentTarget: { dataset: { role: 'current' } },
      data: 'typed',
      detail: undefined,
      stopPropagation,
      target: { dataset: { role: 'target' } },
      timeStamp: 12,
    } as any

    ctx.event('tap', 'method', {}, undefined, { catch: true })(event)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(method).toHaveBeenCalledWith(expect.objectContaining({
      type: 'tap',
      detail: 'typed',
      target: { dataset: { role: 'target' } },
      currentTarget: { dataset: { role: 'current' } },
    }))

    ctx.event('change', 'named', {})(event)
    expect(instance.named).toHaveBeenCalledTimes(1)
    ctx.event('tap', direct, {})(event)
    expect(direct).toHaveBeenCalledTimes(1)
    expect(() => ctx.event('tap', 'missing', {})(event)).not.toThrow()

    const fallbackDatasetEvent = {
      currentTarget: { dataset: { source: 'current' } },
      detail: { value: 1 },
      stopPropagation: vi.fn(),
      target: null,
      timeStamp: 13,
    } as any
    ctx.event('change', direct, {})(fallbackDatasetEvent)
    expect(direct).toHaveBeenLastCalledWith(expect.objectContaining({
      detail: { value: 1 },
      target: { dataset: { source: 'current' } },
    }))

    const emptyEvent = {
      currentTarget: null,
      data: undefined,
      detail: undefined,
      stopPropagation: vi.fn(),
      target: null,
      timeStamp: 14,
    } as any
    ctx.event('empty', null, {})(emptyEvent)
    ctx.event('empty', direct, {})(emptyEvent)
    expect(direct).toHaveBeenLastCalledWith(expect.objectContaining({
      currentTarget: { dataset: {} },
      detail: undefined,
      target: { dataset: {} },
    }))
  })

  it('runs WXS modules with require and helper globals', () => {
    const ctx = createRenderContext({} as any, {})
    const result = ctx.createWxsModule(`
      exports.dep = require('./dep').value
      exports.match = getRegExp('^a', 'i').test('ABC')
      exports.year = getDate('2020-01-01T00:00:00.000Z').getUTCFullYear()
      exports.nowIsDate = getDate() instanceof Date
    `, '/helpers.wxs', {
      './dep': { value: 42 },
    })

    expect(result).toEqual({
      dep: 42,
      match: true,
      nowIsDate: true,
      year: 2020,
    })

    setRuntimeExecutionMode('safe')
    expect(ctx.createWxsModule('throw "safe failure"', '/safe-string.wxs')).toEqual({})
    setRuntimeExecutionMode('strict')
    expect(() => ctx.createWxsModule('throw "strict failure"', '/strict-string.wxs')).toThrow('strict failure')
  })
})
