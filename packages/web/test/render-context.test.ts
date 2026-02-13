import { afterEach, describe, expect, it, vi } from 'vitest'
import { setRuntimeExecutionMode } from '../src/runtime/execution'
import { createRenderContext } from '../src/runtime/renderContext'
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
})
