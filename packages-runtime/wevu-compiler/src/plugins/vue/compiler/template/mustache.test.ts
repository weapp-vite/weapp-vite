import { describe, expect, it } from 'vitest'
import { renderMustache } from './mustache'

describe('renderMustache', () => {
  it('separates a trailing object brace from compact interpolation delimiters', () => {
    expect(renderMustache(`preview || { fallback: '—' }`, { mustacheInterpolation: 'compact' }))
      .toBe(`{{preview || { fallback: '—' } }}`)
  })

  it('preserves existing trailing whitespace in compact interpolation', () => {
    expect(renderMustache('preview || { fallback: 1 } ', { mustacheInterpolation: 'compact' }))
      .toBe('{{preview || { fallback: 1 } }}')
  })

  it('keeps ordinary compact and spaced interpolation output unchanged', () => {
    expect(renderMustache('preview.value', { mustacheInterpolation: 'compact' })).toBe('{{preview.value}}')
    expect(renderMustache('preview || { fallback: 1 }', { mustacheInterpolation: 'spaced' }))
      .toBe('{{ preview || { fallback: 1 } }}')
  })
})
