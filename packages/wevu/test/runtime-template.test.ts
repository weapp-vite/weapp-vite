import { describe, expect, it } from 'vitest'
import { normalizeClass, normalizeStyle, ref } from '@/index'

describe('runtime template helpers', () => {
  it('normalizes class bindings with arrays and objects', () => {
    const result = normalizeClass([
      'foo',
      { bar: true, baz: false },
      ['nested', { qux: true }],
    ])

    expect(result).toBe('foo bar nested qux')
  })

  it('normalizes style bindings with arrays and objects', () => {
    const result = normalizeStyle([
      { color: 'red', fontSize: '12px' },
      { '--gap': 4, 'padding': ['4px', '8px'] },
    ])

    expect(result).toBe('color:red;font-size:12px;--gap:4;padding:4px;padding:8px')
  })

  it('normalizes class/style bindings with nested refs', () => {
    const classResult = normalizeClass([
      'base',
      ref({ active: true, disabled: false }),
      { ready: ref(true) },
    ])
    expect(classResult).toBe('base active ready')

    const styleResult = normalizeStyle([
      ref({ color: '#111', fontSize: ref('24rpx') }),
      { padding: [ref('4rpx'), '8rpx'] },
    ])
    expect(styleResult).toBe('color:#111;font-size:24rpx;padding:4rpx;padding:8rpx')
  })

  it('returns empty string for empty style values', () => {
    expect(normalizeStyle(null)).toBe('')
    expect(normalizeStyle(undefined)).toBe('')
  })
})
