// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { clearRuntimeDataset, readRuntimeDataset, storeRuntimeDataset, toDatasetKey } from '../src/runtime/dataset'

function store(element: Element, attribute: string, value: unknown) {
  element.setAttribute(attribute, String(value ?? ''))
  storeRuntimeDataset(element, attribute, value)
}

describe('runtime dataset snapshots', () => {
  it('uses ASCII lowercase camelCase rules and preserves other delimiters', () => {
    expect(toDatasetKey('data-item-name')).toBe('itemName')
    expect(toDatasetKey('data-a-1')).toBe('a-1')
    expect(toDatasetKey('data-a--b')).toBe('a-B')
  })

  it('returns independent containers without cloning the bound object', () => {
    const element = document.createElement('div')
    const item = { values: [1, 2] }
    element.dataset.native = 'plain'
    store(element, 'data-item', item)
    store(element, 'data-index', 0)
    const first = readRuntimeDataset(element)
    first.native = 'changed'
    expect(readRuntimeDataset(element)).toEqual({ native: 'plain', item, index: 0 })
    expect(readRuntimeDataset(element).item).toBe(item)
  })

  it('releases only its binding and accepts explicit DOM updates and removal', () => {
    const element = document.createElement('div')
    store(element, 'data-first', { id: 1 })
    store(element, 'data-second', false)
    clearRuntimeDataset(element, 'data-first')
    expect(readRuntimeDataset(element)).toEqual({ first: '[object Object]', second: false })
    element.dataset.second = 'manual'
    expect(readRuntimeDataset(element).second).toBe('manual')
    store(element, 'data-second', { id: 2 })
    element.removeAttribute('data-second')
    expect(readRuntimeDataset(element)).not.toHaveProperty('second')
  })

  it('stores and releases HTML attribute aliases through their canonical ASCII names', () => {
    const element = document.createElement('div')
    const item = { id: 'typed' }
    store(element, 'data-itemName', item)
    store(element, 'data-Foo', 0)
    expect(readRuntimeDataset(element)).toEqual({ itemname: item, foo: 0 })
    clearRuntimeDataset(element, 'data-ITEMNAME')
    expect(readRuntimeDataset(element)).toEqual({ itemname: '[object Object]', foo: 0 })
    element.setAttribute('DATA-FOO', 'manual')
    expect(readRuntimeDataset(element).foo).toBe('manual')
    store(element, 'data-FOO', false)
    element.removeAttribute('data-foo')
    expect(readRuntimeDataset(element)).not.toHaveProperty('foo')
  })

  it('preserves case-sensitive SVG attributes without inventing typed uppercase dataset keys', () => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const item = { id: 'svg' }
    store(element, 'data-Foo', 0)
    store(element, 'data-item-name', item)
    expect(element.getAttribute('data-Foo')).toBe('0')
    expect(element.getAttribute('data-foo')).toBeNull()
    const native = { ...element.dataset }
    expect(readRuntimeDataset(element)).toEqual({ ...native, itemName: item })
    clearRuntimeDataset(element, 'data-item-name')
    expect(readRuntimeDataset(element)).toEqual(native)
    expect(toDatasetKey('data-Ä-name')).toBe('ÄName')
  })

  it('does not mutate the result prototype or share values across elements', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    const value = { marker: 'owned' }
    store(first, 'data-__proto__', value)
    const dataset = readRuntimeDataset(first)
    expect(Object.getPrototypeOf(dataset)).toBe(Object.prototype)
    expect(Object.hasOwn(dataset, '__proto__')).toBe(true)
    expect(Reflect.get(dataset, '__proto__')).toBe(value)
    expect(readRuntimeDataset(second)).toEqual({})
    expect(readRuntimeDataset(null)).toEqual({})
    expect(readRuntimeDataset(undefined)).toEqual({})
  })
})
