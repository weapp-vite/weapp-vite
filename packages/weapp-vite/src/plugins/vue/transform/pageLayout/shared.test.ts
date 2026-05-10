import { describe, expect, it } from 'vitest'
import { getWxmlDirectivePrefix } from '../../../../platform'
import {
  getLayoutConditionalDirective,
  getLayoutElseDirective,
  getPlatformLayoutConditionalDirective,
  getPlatformLayoutElseDirective,
} from './shared'
import { assertTemplateHasDefaultSlot, hasDefaultSlotTemplate } from './slot'

const DEFAULT_WXML_DIRECTIVE_PREFIX = getWxmlDirectivePrefix()

describe('page layout shared helpers', () => {
  it('builds conditional directives for dynamic layout wrappers', () => {
    expect(getLayoutConditionalDirective(0)).toBe(`${DEFAULT_WXML_DIRECTIVE_PREFIX}:if`)
    expect(getLayoutConditionalDirective(1)).toBe(`${DEFAULT_WXML_DIRECTIVE_PREFIX}:elif`)
    expect(getLayoutConditionalDirective(3)).toBe(`${DEFAULT_WXML_DIRECTIVE_PREFIX}:elif`)
    expect(getLayoutConditionalDirective(0, 'a')).toBe('a:if')
    expect(getLayoutConditionalDirective(1, 'a')).toBe('a:elif')
    expect(getLayoutElseDirective()).toBe(`${DEFAULT_WXML_DIRECTIVE_PREFIX}:else`)
    expect(getLayoutElseDirective('a')).toBe('a:else')
  })

  it('resolves layout directives from platform transform options', () => {
    expect(getPlatformLayoutConditionalDirective(0, 'weapp')).toBe(`${DEFAULT_WXML_DIRECTIVE_PREFIX}:if`)
    expect(getPlatformLayoutConditionalDirective(1, 'alipay')).toBe('a:elif')
    expect(getPlatformLayoutElseDirective('alipay')).toBe('a:else')
  })

  it('detects default slots in layout templates', () => {
    expect(hasDefaultSlotTemplate('<view><slot /></view>')).toBe(true)
    expect(hasDefaultSlotTemplate('<view><slot name="header" /></view>')).toBe(false)
    expect(hasDefaultSlotTemplate('<view />')).toBe(false)
  })

  it('throws user-facing errors for layout templates without default slot', () => {
    expect(() => assertTemplateHasDefaultSlot({
      filename: '/project/src/app.vue',
      kind: 'app-shell',
      template: '<view />',
    })).toThrow('/project/src/app.vue 中 app.vue <template> 必须包含默认 <slot />')

    expect(() => assertTemplateHasDefaultSlot({
      filename: '/project/src/layouts/default.vue',
      kind: 'page-layout',
      template: '<view />',
    })).toThrow('/project/src/layouts/default.vue 对应的 layout template 必须包含默认 <slot />')
  })
})
