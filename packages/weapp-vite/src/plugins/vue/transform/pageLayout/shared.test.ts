import { describe, expect, it } from 'vitest'
import {
  getLayoutConditionalDirective,
  getLayoutElseDirective,
  getPlatformLayoutConditionalDirective,
  getPlatformLayoutElseDirective,
} from './shared'

describe('page layout shared helpers', () => {
  it('builds conditional directives for dynamic layout wrappers', () => {
    expect(getLayoutConditionalDirective(0)).toBe('wx:if')
    expect(getLayoutConditionalDirective(1)).toBe('wx:elif')
    expect(getLayoutConditionalDirective(3)).toBe('wx:elif')
    expect(getLayoutConditionalDirective(0, 'a')).toBe('a:if')
    expect(getLayoutConditionalDirective(1, 'a')).toBe('a:elif')
    expect(getLayoutElseDirective()).toBe('wx:else')
    expect(getLayoutElseDirective('a')).toBe('a:else')
  })

  it('resolves layout directives from platform transform options', () => {
    expect(getPlatformLayoutConditionalDirective(0, 'weapp')).toBe('wx:if')
    expect(getPlatformLayoutConditionalDirective(1, 'alipay')).toBe('a:elif')
    expect(getPlatformLayoutElseDirective('alipay')).toBe('a:else')
  })
})
