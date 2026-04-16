import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  getMiniprogramAttributeCompletionDetail,
  getMiniprogramAttributeHoverMarkdown,
  getMiniprogramAttributeValues,
  getMiniprogramComponentAttributes,
  getMiniprogramComponentCompletionDetail,
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
  assert.equal(values.find(item => item.value === 'time')?.desc?.[0]?.includes('`start`'), true)
  assert.equal(values.find(item => item.value === 'time')?.detail, '可用: value, start, end 等4项')
  assert.equal(timeAttributes.includes('start'), true)
  assert.equal(timeAttributes.includes('end'), true)
  assert.equal(timeAttributes.includes('range-key'), false)
  assert.equal(selectorAttributes.includes('range'), true)
  assert.equal(selectorAttributes.includes('range-key'), true)
  assert.equal(getMiniprogramAttributeCompletionDetail('picker', 'mode'), 'enum')
  assert.equal(getMiniprogramAttributeCompletionDetail('picker', 'start', { mode: 'time' }), 'mode=time')
  assert.equal(getMiniprogramComponentCompletionDetail(), 'native component')
})

it('renders conditional hover markdown for root and nested attrs', () => {
  const modeMarkdown = getMiniprogramAttributeHoverMarkdown('picker', 'mode')
  const startMarkdown = getMiniprogramAttributeHoverMarkdown('picker', 'start', {
    mode: 'time',
  })

  assert.equal(modeMarkdown?.includes('### 条件分支'), true)
  assert.equal(modeMarkdown?.includes('`time`'), true)
  assert.equal(modeMarkdown?.includes('`start`'), true)
  assert.equal(startMarkdown?.includes('条件：`mode="time"`'), true)
  assert.equal(startMarkdown?.includes('## `picker.start`'), true)
})
