import { expect, it } from 'vitest'
import { createComponentInstance } from '../src/runtime/componentInstance'

it('exposes the native component data descriptor with live property and setData values', () => {
  const instance = createComponentInstance({
    definition: { properties: { label: String }, data: { count: 0 } },
    properties: { label: 'native label' },
  })
  const descriptor = Object.getOwnPropertyDescriptor(instance, '__data__')
  expect(descriptor).toMatchObject({ configurable: false, enumerable: true, writable: false })
  expect(descriptor?.value).toBe(instance.data)
  instance.setData({ count: 1, label: 'updated' })
  expect(instance.__data__).toEqual({ count: 1, label: 'updated' })
})
