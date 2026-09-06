// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component/types'
import { afterEach, expect, it, vi } from 'vitest'
import { registerWebWevuComponent } from '../src/runtime/wevu'
import { slugify } from '../src/shared/slugify'

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

it.each(['component', 'page'] as const)('decodes Web %s attributes without native nullable transport erasing prop types', async (kind) => {
  const id = `wevu-attribute-transport-${kind}`
  const previousConstructor = vi.fn()
  vi.stubGlobal('Component', previousConstructor)
  registerWebWevuComponent({
    allowNullPropInput: true,
    props: {
      enabled: Boolean,
      count: Number,
      payload: Object,
      items: Array,
    },
  }, { kind, id })
  expect((globalThis as Record<string, unknown>).Component).toBe(previousConstructor)

  const element = document.createElement(slugify(id, kind === 'page' ? 'wv-page' : 'wv-component')) as ComponentPublicInstance & {
    updateComplete: Promise<boolean>
  }
  element.setAttribute('enabled', '')
  element.setAttribute('count', '7')
  element.setAttribute('payload', '{"label":"initial"}')
  element.setAttribute('items', '[1,2]')
  document.body.append(element)
  await element.updateComplete

  expect(element.properties).toMatchObject({
    enabled: true,
    count: 7,
    payload: { label: 'initial' },
    items: [1, 2],
  })

  element.setAttribute('enabled', 'false')
  element.setAttribute('count', '12')
  element.setAttribute('payload', 'null')
  element.setAttribute('items', '[3]')
  await element.updateComplete

  expect(element.properties).toMatchObject({
    enabled: false,
    count: 12,
    payload: null,
    items: [3],
  })
})
