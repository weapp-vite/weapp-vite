import { expect, it, vi } from 'vitest'
import { createComponentInstance } from '../src/runtime/componentInstance'
import { flushComponentAttachments, isComponentAttached } from '../src/runtime/componentInstance/attachment'

it('does not attach pending siblings or run ready early during a reentrant render', () => {
  const siblings = [createComponentInstance({ definition: {} }), createComponentInstance({ definition: {} })]
  const order: string[] = []
  const reentrantAttach = vi.fn()
  expect(flushComponentAttachments(siblings, (instance) => {
    order.push(`start:${siblings.indexOf(instance)}`)
    expect(isComponentAttached(instance)).toBe(false)
    expect(flushComponentAttachments(siblings, reentrantAttach)).toBe(false)
    order.push(`end:${siblings.indexOf(instance)}`)
  })).toBe(true)
  expect(reentrantAttach).not.toHaveBeenCalled()
  expect(order).toEqual(['start:0', 'end:0', 'start:1', 'end:1'])
  expect(siblings.every(isComponentAttached)).toBe(true)
})

it('releases unstarted siblings after an attached callback throws', () => {
  const first = createComponentInstance({ definition: {} })
  const second = createComponentInstance({ definition: {} })
  const failure = new Error('attached failed')
  expect(() => flushComponentAttachments([first, second], () => {
    throw failure
  })).toThrow(failure)
  expect(isComponentAttached(first)).toBe(true)
  expect(isComponentAttached(second)).toBe(false)
  const attach = vi.fn()
  expect(flushComponentAttachments([first, second], attach)).toBe(true)
  expect(attach).toHaveBeenCalledExactlyOnceWith(second)
})
