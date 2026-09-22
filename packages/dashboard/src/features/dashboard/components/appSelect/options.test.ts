import { describe, expect, it } from 'vitest'
import { resolveAppSelectActiveValue } from './options'

describe('AppSelect active option', () => {
  it('preserves the active value when options are reordered', () => {
    expect(resolveAppSelectActiveValue([
      { label: '全部', value: 'all' },
      { label: '必须处理', value: 'critical' },
      { label: '建议处理', value: 'warning' },
    ], 'warning', 'warning')).toBe('warning')
  })

  it('falls back to the selected value when the active option disappears', () => {
    expect(resolveAppSelectActiveValue([
      { label: '全部', value: 'all' },
      { label: '建议处理', value: 'warning' },
    ], 'critical', 'warning')).toBe('warning')
  })

  it('skips disabled options and reports an empty enabled set', () => {
    expect(resolveAppSelectActiveValue([
      { label: '全部', value: 'all', disabled: true },
      { label: '建议处理', value: 'warning' },
    ], null, 'all')).toBe('warning')
    expect(resolveAppSelectActiveValue([
      { label: '全部', value: 'all', disabled: true },
    ], null, 'all')).toBeNull()
  })
})
