import { describe, expect, it } from 'vitest'
import { getLayoutConditionalDirective, getLayoutElseDirective } from './shared'

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
})
