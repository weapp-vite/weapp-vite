import type { MiniProgramNode } from './screen'
import { expect, it } from 'vitest'
import { toHaveAttribute, toHaveTextContent } from './matchers'

function textNode(textContent: string) {
  return { textContent } as MiniProgramNode
}

it('preserves partial text and reusable regular expressions', () => {
  const node = textNode('count: 2')
  const pattern = /count/gu
  expect(toHaveTextContent(node, 'count').pass).toBe(true)
  expect(toHaveTextContent(node, 'missing').pass).toBe(false)
  expect(toHaveTextContent(node, pattern).pass).toBe(true)
  expect(toHaveTextContent(node, pattern).pass).toBe(true)
})

it('handles numeric, nonempty and explicit normalized text assertions', () => {
  expect(toHaveTextContent(textNode('count: 2'), 2).pass).toBe(true)
  expect(toHaveTextContent(textNode('count: 2'), 3).pass).toBe(false)
  expect(toHaveTextContent(textNode('')).pass).toBe(false)
  expect(toHaveTextContent(textNode('ready')).pass).toBe(true)
  const node = textNode('  count:\n  2  ')
  expect(toHaveTextContent(node, 'count: 2').pass).toBe(false)
  expect(toHaveTextContent(node, 'count: 2', { normalizeWhitespace: true }).pass).toBe(true)
  expect(toHaveTextContent(textNode(' \n '), undefined, { normalizeWhitespace: true }).pass).toBe(false)
})

it('compares attributes without coercing unknown expected values', () => {
  const node = { getAttribute: () => '2' } as unknown as MiniProgramNode
  expect(toHaveAttribute(node, 'data-count', '2').pass).toBe(true)
  expect(toHaveAttribute(node, 'data-count', 2).pass).toBe(false)
  expect(toHaveAttribute(node, 'data-count').pass).toBe(true)
})
