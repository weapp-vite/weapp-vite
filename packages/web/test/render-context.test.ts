import { describe, expect, it, vi } from 'vitest'
import { createRenderContext } from '../src/runtime/renderContext'

describe('renderContext renderTemplate', () => {
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
})
