// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import {
  readRuntimeDataset,
  storeRuntimeDataset,
  toDatasetKey,
} from '../src/runtime/dataset'

function createElement() {
  return document.createElement('div')
}

describe('toDatasetKey', () => {
  it('mirrors the DOMStringMap camelCase rule', () => {
    expect(toDatasetKey('data-item')).toBe('item')
    expect(toDatasetKey('data-item-name')).toBe('itemName')
    expect(toDatasetKey('data-a-b-c')).toBe('aBC')
  })
})

describe('storeRuntimeDataset', () => {
  it('keeps object references off the attribute', () => {
    const element = createElement()
    const payload = { value: 'pending', index: 2 }

    expect(storeRuntimeDataset(element, 'data-item', payload)).toBe(true)
    expect(readRuntimeDataset(element).item).toBe(payload)
  })

  it('lets primitive values fall through to the native dataset', () => {
    const element = createElement()
    element.setAttribute('data-index', '3')

    expect(storeRuntimeDataset(element, 'data-index', 3)).toBe(false)
    expect(readRuntimeDataset(element).index).toBe('3')
  })

  it('keeps primitive and object values side by side', () => {
    const element = createElement()
    const payload = { value: 'done' }
    element.setAttribute('data-index', '1')

    storeRuntimeDataset(element, 'data-item', payload)

    const dataset = readRuntimeDataset(element)
    expect(dataset.item).toBe(payload)
    expect(dataset.index).toBe('1')
  })

  it('drops the stored reference when the value turns primitive again', () => {
    const element = createElement()
    storeRuntimeDataset(element, 'data-item', { value: 'x' })
    storeRuntimeDataset(element, 'data-item', 'plain')

    expect(readRuntimeDataset(element).item).toBeUndefined()
  })

  it('drops the stored reference when the value becomes undefined', () => {
    const element = createElement()
    storeRuntimeDataset(element, 'data-item', { value: 'x' })
    storeRuntimeDataset(element, 'data-item', undefined)

    expect(readRuntimeDataset(element).item).toBeUndefined()
  })

  it('does not leak object references between elements', () => {
    const first = createElement()
    const second = createElement()
    const payload = { value: 'first' }

    storeRuntimeDataset(first, 'data-item', payload)

    expect(readRuntimeDataset(first).item).toBe(payload)
    expect(readRuntimeDataset(second).item).toBeUndefined()
  })

  it('returns a spread-safe snapshot', () => {
    const element = createElement()
    const payload = { value: 'spread' }
    element.setAttribute('data-index', '7')
    storeRuntimeDataset(element, 'data-item', payload)

    const snapshot = { ...readRuntimeDataset(element) }

    expect(snapshot).toEqual({ index: '7', item: payload })
  })

  it('handles a detached element without throwing', () => {
    expect(readRuntimeDataset(null)).toEqual({})
    expect(readRuntimeDataset(undefined)).toEqual({})
  })
})
