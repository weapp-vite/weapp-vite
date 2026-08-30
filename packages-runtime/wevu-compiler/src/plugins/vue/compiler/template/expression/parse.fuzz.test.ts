import { describe, expect, it } from 'vitest'
import {
  generateExpression,
  parseBabelExpression,
  parseInlineHandler,
} from './parse'
import { normalizeWxmlExpression } from './wxml'

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 0x100000000
  }
}

const identifiers = ['value', 'item', 'index', 'user', 'profile', 'count', 'enabled']
const literals = ['0', '1_000', '42n', `'text'`, 'true', 'null']

function pick(random: () => number, values: string[]) {
  return values[Math.floor(random() * values.length)]!
}

function generateExpressionSource(random: () => number, depth: number): string {
  if (depth <= 0) {
    return pick(random, [...identifiers, ...literals])
  }
  const left = generateExpressionSource(random, depth - 1)
  const right = generateExpressionSource(random, depth - 1)
  switch (Math.floor(random() * 10)) {
    case 0:
      return `(${left}+${right})`
    case 1:
      return `(${left}??${right})`
    case 2:
      return `(${left}?${right}:${pick(random, literals)})`
    case 3:
      return `(${left}&&${right})`
    case 4:
      return `({value:${left},nested:${right}})`
    case 5:
      return `[${left},${right}]`
    case 6:
      return `(${left} as unknown)`
    case 7:
      return `(${left})!`
    case 8:
      return `({value:${left}})?.value`
    default:
      return `String(${left})`
  }
}

function buildExpressionCorpus() {
  const random = createRandom(0x5FC0FFEE)
  return Array.from({ length: 300 }, () => generateExpressionSource(random, 3))
}

describe('template expression deterministic fuzz corpus', () => {
  it('keeps parse, TypeScript stripping, generation, and normalization deterministic', () => {
    for (const source of buildExpressionCorpus()) {
      const parsed = parseBabelExpression(source)
      expect(parsed, source).not.toBeNull()
      const generated = generateExpression(parsed!)
      const reparsed = parseBabelExpression(generated)
      expect(reparsed, generated).not.toBeNull()
      expect(generateExpression(parseBabelExpression(source)!)).toBe(generated)

      const normalized = normalizeWxmlExpression(source)
      expect(normalizeWxmlExpression(source)).toBe(normalized)
      expect(normalized).not.toContain('?.')
      expect(normalized).not.toContain('??')
      expect(parseBabelExpression(normalized), normalized).not.toBeNull()
    }
  })

  it('rejects deterministic malformed mutations without throwing', () => {
    for (const source of buildExpressionCorpus().slice(0, 100)) {
      for (const malformed of [`(${source}`, `${source})`, `${source} +`, `${source} ?`]) {
        expect(parseBabelExpression(malformed), malformed).toBeNull()
        expect(parseBabelExpression(malformed), malformed).toBeNull()
      }
    }
  })

  it('keeps generated inline handler arguments parseable', () => {
    for (const source of buildExpressionCorpus().slice(0, 100)) {
      const handler = parseInlineHandler(`submit($event, ${source})`)
      expect(handler, source).not.toBeNull()
      expect(handler?.name).toBe('submit')
      expect(handler?.args).toHaveLength(2)
    }
  })
})
