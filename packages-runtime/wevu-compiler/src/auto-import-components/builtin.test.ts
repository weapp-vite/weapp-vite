import { describe, expect, it } from 'vitest'
import { collectVueTemplateTags } from '../utils/vueTemplateTags'
import { builtinComponentsSet, isBuiltinComponent } from './builtin'
import { components } from './builtin.auto'

describe('generated builtin component consumers', () => {
  it('retains native components across categories and fixed syntax tags', () => {
    for (const tag of ['wxs', 'template', 'block', 'import', 'include', 'view', 'text', 'scroll-view', 'button', 'input', 'image', 'video', 'canvas', 'ad', 'web-view', 'page-meta']) {
      expect(isBuiltinComponent(tag), tag).toBe(true)
    }
    expect(builtinComponentsSet.size).toBe(components.length)
    expect(isBuiltinComponent('t-button')).toBe(false)
    expect(isBuiltinComponent('CustomCard')).toBe(false)
  })

  it('excludes every generated builtin from auto imports while collecting custom components', () => {
    const template = `${components.map(tag => `<${tag} />`).join('')}<t-button /><CustomCard />`
    expect([...collectVueTemplateTags(template, { shouldCollect: () => true })]).toEqual(['t-button', 'CustomCard'])
  })
})
