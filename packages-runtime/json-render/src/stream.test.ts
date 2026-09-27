import { expect, it } from 'vitest'
import { createSpecStream } from './stream'
import { catalog, fixture, initial } from './testing/fixture'

it('waits for missing nodes and supports arbitrary chunk boundaries and final unterminated lines', () => {
  const stream = createSpecStream(fixture(), catalog, initial)
  expect(stream.push('{"op":"add","path":"/elements/root/children/-","value":"extra"}\n')).toBeNull()
  const line = '{"op":"add","path":"/elements/extra","value":{"type":"Text","props":{"text":"补充说明"}}}'
  for (const char of line) {
    expect(stream.push(char)).toBeNull()
  }
  expect(stream.push('', true)?.elements.extra?.props.text).toBe('补充说明')
  expect(() => stream.push('')).toThrow('流已停止')
})

it('applies repeated array patches and does not mutate the displayed input spec', () => {
  const spec = fixture()
  const stream = createSpecStream(spec, catalog, initial)
  const remove = '{"op":"remove","path":"/elements/root/children/1"}\n'
  expect(stream.push(remove + remove)?.elements.root?.children).toEqual(['search'])
  expect(spec.elements.root?.children).toEqual(['search', 'gauge', 'button'])
})

it.each([
  '{broken}\n',
  '{"op":"add","path":"/state","value":{}}\n',
  '{"op":"add","path":"/elements/__proto__/polluted","value":true}\n',
  '{"op":"copy","path":"/root","from":"/root"}\n',
])('rejects invalid patches without changing the visible description', (line) => {
  const spec = fixture()
  expect(() => createSpecStream(spec, catalog, initial).push(line)).toThrow()
  expect(spec).toEqual(fixture())
})

it('rejects unfinished references and oversized buffers', () => {
  const stream = createSpecStream(fixture(), catalog, initial)
  stream.push('{"op":"add","path":"/elements/root/children/-","value":"extra"}\n')
  expect(() => stream.push('', true)).toThrow('引用不存在')
  expect(() => createSpecStream(fixture(), catalog, initial, { maxBufferedCharacters: 3 }).push('1234')).toThrow('过大')
})
