import type { Message } from '../src/index.js'
import { expect, it } from 'vitest'
import { compactMessages } from '../src/index.js'

function readGroup(id: string, text = 'x'.repeat(600)): Message[] {
  return [
    { role: 'assistant', text: '', calls: [{ id, name: 'read_file', input: { path: 'page.ts' } }] },
    { role: 'tool', callId: id, name: 'read_file', result: { text } },
  ]
}

function userInstructions(messages: Message[]): Message[] {
  return messages.filter(message => message.role === 'user' && message.origin !== 'engine')
}

it('returns fitting context unchanged', () => {
  const messages: Message[] = [{ role: 'user', text: 'Keep the existing API.' }, ...readGroup('read')]
  const result = compactMessages(messages, 8000)
  expect(result.messages).toBe(messages)
  expect(result).toMatchObject({ compacted: false, budgetExceeded: false })
})

it('preserves every full user instruction in order across a long tool history', () => {
  const messages: Message[] = [{ role: 'user', text: 'Original goal: implement one page and preserve the public API.' }]
  for (let i = 0; i < 25; i++) {
    messages.push(...readGroup(`read-${i}`))
    if (i === 10) {
      messages.push({ role: 'user', origin: 'user', text: 'Additional constraint: preserve the user changes.' })
    }
  }
  messages.push({ role: 'user', origin: 'engine', text: 'Verify all changed files. '.repeat(1000) })
  messages.push({ role: 'user', origin: 'user', text: 'Continue.' })
  const result = compactMessages(messages, 8000)
  expect(result).toMatchObject({ compacted: true, budgetExceeded: false })
  expect(userInstructions(result.messages)).toEqual(userInstructions(messages))
  expect(JSON.stringify(result.messages).length).toBeLessThanOrEqual(8000)
  expect(result.messages.at(-1)).toEqual(messages.at(-1))
  expect(result.messages[0]).toMatchObject({ role: 'user', origin: 'engine' })
  for (const message of result.messages) {
    if (message.role === 'assistant') {
      for (const call of message.calls ?? []) {
        expect(result.messages).toContainEqual(messages.find(candidate => candidate.role === 'tool' && candidate.callId === call.id))
      }
    }
    if (message.role === 'tool') {
      expect(result.messages.some(candidate => candidate.role === 'assistant' && candidate.calls?.some(call => call.id === message.callId))).toBe(true)
    }
  }
})

it('keeps the tail of a long request when an indivisible tool group is omitted', () => {
  const request: Message = { role: 'user', text: `${'"\\\n'.repeat(650)}Critical final constraint: do not change exports.` }
  const messages: Message[] = [
    request,
    { role: 'assistant', text: '', calls: [{ id: 'huge', name: 'write', input: { content: 'x'.repeat(50000) } }] },
    { role: 'tool', name: 'write', callId: 'huge', result: { text: 'done', data: 'x'.repeat(50000) } },
  ]
  const result = compactMessages(messages, 8000)
  expect(result).toMatchObject({ compacted: true, budgetExceeded: false })
  expect(userInstructions(result.messages)).toEqual([request])
  expect(result.messages.some(message => message.role === 'tool' || message.role === 'assistant')).toBe(false)
  expect(JSON.stringify(result.messages).length).toBeLessThanOrEqual(8000)
})

it.each([1800, 6000])('keeps or removes a whole multi-call group with %i-character results', (length) => {
  const batch: Message[] = [
    { role: 'assistant', text: '', calls: [
      { id: 'first', name: 'read_file', input: { path: 'first.ts' } },
      { id: 'second', name: 'read_file', input: { path: 'second.ts' } },
    ] },
    { role: 'tool', callId: 'first', name: 'read_file', result: { text: 'a'.repeat(length) } },
    { role: 'tool', callId: 'second', name: 'read_file', result: { text: 'b'.repeat(length) } },
  ]
  const result = compactMessages([
    { role: 'user', text: 'Read both files.' },
    { role: 'assistant', text: 'Old analysis. '.repeat(2000) },
    ...batch,
  ], 8000)
  expect(result.messages.filter(message => message.role === 'assistant' || message.role === 'tool')).toEqual(length === 1800 ? batch : [])
  expect(JSON.stringify(result.messages).length).toBeLessThanOrEqual(8000)
})

it('reports protected context overflow without truncating legacy or explicit user requests', () => {
  const messages: Message[] = [
    { role: 'user', text: 'Legacy instruction '.repeat(500) },
    ...readGroup('read'),
    { role: 'user', origin: 'user', text: 'Keep this follow-up too.' },
  ]
  const result = compactMessages(messages, 8000)
  expect(result.budgetExceeded).toBe(true)
  expect(result.requiredCharacters).toBe(JSON.stringify(userInstructions(messages)).length)
  expect(result.messages).toEqual(userInstructions(messages))
})

it('preserves image bytes while charging each image a bounded context cost', () => {
  const request: Message = {
    role: 'user',
    origin: 'user',
    text: 'Match the reference.',
    images: [{ type: 'image', mediaType: 'image/png', data: 'a'.repeat(50000) }],
  }
  const result = compactMessages([request, ...readGroup('large', 'x'.repeat(20000))], 8000)
  expect(result).toMatchObject({ compacted: true, budgetExceeded: false })
  expect(result.requiredCharacters).toBeGreaterThan(1792)
  expect(result.requiredCharacters).toBeLessThan(2000)
  expect(userInstructions(result.messages)).toEqual([request])
  const manyImages: Message = { ...request, images: Array.from({ length: 5 }, () => ({ type: 'image', mediaType: 'image/png', data: 'small' })) }
  expect(compactMessages([manyImages], 8000).budgetExceeded).toBe(true)
})

it('does not discount ordinary tool arguments named images', () => {
  const messages: Message[] = [
    { role: 'user', text: 'Inspect the asset list.' },
    { role: 'assistant', text: '', calls: [{ id: 'assets', name: 'inspect', input: { images: ['x'.repeat(20000)] } }] },
    { role: 'tool', callId: 'assets', name: 'inspect', result: { text: 'done' } },
  ]
  const result = compactMessages(messages, 8000)
  expect(result.compacted).toBe(true)
  expect(result.messages.some(message => message.role === 'assistant')).toBe(false)
  expect(JSON.stringify(result.messages).length).toBeLessThanOrEqual(8000)
})

it('can omit the summary when only the protected instructions fit', () => {
  const request: Message = { role: 'user', text: 'Keep every character.' }
  const budget = JSON.stringify([request]).length
  const result = compactMessages([request, ...readGroup('old')], budget)
  expect(result).toMatchObject({ messages: [request], compacted: true, budgetExceeded: false, requiredCharacters: budget })
})
