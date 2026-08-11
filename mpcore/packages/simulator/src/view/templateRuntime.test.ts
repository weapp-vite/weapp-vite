import { describe, expect, it } from 'vitest'
import {
  createTemplateRenderState,
  isTemplateDefinition,
  resolveTemplateCall,
  resolveTemplateData,
} from './templateRuntime'

describe('template runtime', () => {
  const definition = {
    type: 'tag',
    name: 'template',
    attribs: { name: 'card' },
    children: [],
  }

  it('collects definitions and resolves static and dynamic template names', () => {
    const root = {
      type: 'tag',
      name: 'page',
      children: [definition],
    }
    const state = createTemplateRenderState(root)

    expect(state.definitions.get('card')).toBe(definition)
    expect(isTemplateDefinition(definition)).toBe(true)
    expect(resolveTemplateCall({
      type: 'tag',
      name: 'template',
      attribs: { is: 'card' },
    }, {})).toBe('card')
    expect(resolveTemplateCall({
      type: 'tag',
      name: 'template',
      attribs: { is: '{{templateName}}' },
    }, { templateName: 'card' })).toBe('card')
  })

  it('resolves WXML template data object syntax and direct object values', () => {
    const item = { label: 'ready' }

    expect(resolveTemplateData({
      type: 'tag',
      name: 'template',
      attribs: { data: '{{node:item,islandId:id}}' },
    }, { id: 'i0', item })).toEqual({
      islandId: 'i0',
      node: item,
    })
    expect(resolveTemplateData({
      type: 'tag',
      name: 'template',
      attribs: { data: '{{item}}' },
    }, { item })).toBe(item)
  })
})
