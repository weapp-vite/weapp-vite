import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  getMiniprogramAttributeHoverMarkdown,
  getMiniprogramAttributeValues,
  getMiniprogramComponentAttributes,
  getMiniprogramComponentHoverMarkdown,
  getMiniprogramComponentNames,
} from './miniprogramSchema'

it('exposes native miniprogram component names', () => {
  const names = getMiniprogramComponentNames()

  assert.equal(names.includes('view'), true)
  assert.equal(names.includes('scroll-view'), true)
})

it('renders component hover markdown with docs link', () => {
  const markdown = getMiniprogramComponentHoverMarkdown('view')

  assert.equal(markdown?.includes('## `view`'), true)
  assert.equal(markdown?.includes('官方文档'), true)
})

it('renders attribute hover markdown and enum values', () => {
  const markdown = getMiniprogramAttributeHoverMarkdown('scroll-view', 'scroll-x')
  const values = getMiniprogramAttributeValues('swiper', 'display-multiple-items')

  assert.equal(markdown?.includes('## `scroll-view.scroll-x`'), true)
  assert.equal(markdown?.includes('默认值'), true)
  assert.equal(Array.isArray(values), true)
})

it('exposes conditional attribute values and filtered attrs for picker mode', () => {
  const values = getMiniprogramAttributeValues('picker', 'mode')
  const timeAttributes = getMiniprogramComponentAttributes('picker', {
    mode: 'time',
  }).map(attribute => attribute.name)
  const selectorAttributes = getMiniprogramComponentAttributes('picker', {
    mode: 'selector',
  }).map(attribute => attribute.name)

  assert.equal(values.some(item => item.value === 'time'), true)
  assert.equal(values.some(item => item.value === 'region'), true)
  assert.equal(timeAttributes.includes('start'), true)
  assert.equal(timeAttributes.includes('end'), true)
  assert.equal(timeAttributes.includes('range-key'), false)
  assert.equal(selectorAttributes.includes('range'), true)
  assert.equal(selectorAttributes.includes('range-key'), true)
})
