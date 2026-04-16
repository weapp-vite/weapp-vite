import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  getMiniprogramAttributeHoverMarkdown,
  getMiniprogramAttributeValues,
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
