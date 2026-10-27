// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import { html, nothing, render } from 'lit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readRuntimeDataset } from '../src/runtime/dataset'
import { bindRuntimeDataset } from '../src/runtime/datasetBinding'
import { createRenderContext } from '../src/runtime/renderContext'
import { compileDatasetTemplate as compile } from './helpers/datasetTemplate'

afterEach(() => document.body.replaceChildren())

describe('compiled dataset rendering', () => {
  it('keeps string attributes while preserving evaluated dataset types in events', () => {
    const capture = vi.fn()
    const context = createRenderContext({} as ComponentPublicInstance, { capture })
    const template = compile('<view id="probe" data-literal="0" data-index="{{index}}" data-enabled="{{enabled}}" data-item="{{item}}" data-item-name="{{item.name}}" bindtap="capture" />')
    const item = { name: 'pending', values: [1, 2] }
    const container = document.createElement('div')
    document.body.append(container)
    render(template({ index: 0, enabled: false, item }, context), container)
    const element = container.querySelector('#probe')!

    expect(element.getAttribute('data-literal')).toBe('0')
    expect(element.getAttribute('data-index')).toBe('0')
    expect(element.getAttribute('data-enabled')).toBe('false')
    expect(element.getAttribute('data-item-name')).toBe('pending')
    element.dispatchEvent(new MouseEvent('click'))
    expect(capture).toHaveBeenCalledOnce()
    expect(capture.mock.calls[0]![0].currentTarget.dataset).toEqual({ literal: '0', index: 0, enabled: false, item, itemName: 'pending' })
    expect(readRuntimeDataset(element).item).toBe(item)
  })

  it('distinguishes full expressions, mixed strings and nullish attributes across updates', () => {
    const context = createRenderContext({} as ComponentPublicInstance, {})
    const template = compile('<view data-value="{{value}}" data-mixed="value={{value}}" data-empty="{{missing}}" data-null="{{nil}}" />')
    const container = document.createElement('div')
    for (const value of [0, false, { id: 'same' }, ['value'], 'plain', null, undefined]) {
      render(template({ value, nil: null }, context), container)
      const element = container.querySelector('weapp-view')!
      expect(element.getAttribute('data-value')).toBe(String(value ?? ''))
      expect(element.getAttribute('data-null')).toBe('')
      expect(element.getAttribute('data-empty')).toBe('')
      expect(readRuntimeDataset(element)).toEqual({ value, mixed: `value=${value ?? ''}`, empty: undefined, null: null })
    }
  })

  it('cleans changed attribute names and restores the current value after disconnect and reconnect', () => {
    const container = document.createElement('div')
    const template = (name: string, value: unknown) => html`<div ${bindRuntimeDataset(name, value)}></div>`
    const item = { id: 'same' }
    const part = render(template('data-first', item), container)
    const element = container.querySelector('div')!
    expect(readRuntimeDataset(element).first).toBe(item)
    part.setConnected(false)
    expect(readRuntimeDataset(element).first).toBe('[object Object]')
    part.setConnected(true)
    expect(readRuntimeDataset(element).first).toBe(item)
    part.setConnected(false)
    const next = { id: 'next' }
    render(template('data-next', next), container)
    expect(element.hasAttribute('data-first')).toBe(false)
    expect(readRuntimeDataset(element).next).toBe('[object Object]')
    part.setConnected(true)
    expect(readRuntimeDataset(element)).toEqual({ next })
    render(nothing, container)
    expect(readRuntimeDataset(element).next).toBe('[object Object]')
  })

  it('cleans canonical names when a dynamic binding changes attribute case and spelling', () => {
    const container = document.createElement('div')
    const template = (name: string, value: unknown) => html`<div ${bindRuntimeDataset(name, value)}></div>`
    const part = render(template('data-itemName', { id: 'first' }), container)
    const element = container.querySelector('div')!
    expect(readRuntimeDataset(element)).toEqual({ itemname: { id: 'first' } })
    render(template('data-ITEM-NAME', { id: 'next' }), container)
    expect(element.hasAttribute('data-itemname')).toBe(false)
    expect(readRuntimeDataset(element)).toEqual({ itemName: { id: 'next' } })
    part.setConnected(false)
    expect(readRuntimeDataset(element)).toEqual({ itemName: '[object Object]' })
    part.setConnected(true)
    expect(readRuntimeDataset(element)).toEqual({ itemName: { id: 'next' } })
    render(nothing, container)
    expect(readRuntimeDataset(element)).toEqual({ itemName: '[object Object]' })
  })
})
