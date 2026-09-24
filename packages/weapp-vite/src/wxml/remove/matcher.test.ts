import { describe, expect, it } from 'vitest'
import { compileNames, matches } from './matcher'

function matchesWithDynamicProgramming(pattern: string, name: string): boolean {
  const table = Array.from({ length: pattern.length + 1 }, () => Array.from({ length: name.length + 1 }).fill(false))
  table[0][0] = true
  for (let patternEnd = 1; patternEnd <= pattern.length; patternEnd++) {
    const character = pattern[patternEnd - 1]
    table[patternEnd][0] = character === '*' && table[patternEnd - 1][0]
    for (let nameEnd = 1; nameEnd <= name.length; nameEnd++) {
      table[patternEnd][nameEnd] = character === '*'
        ? table[patternEnd - 1][nameEnd] || table[patternEnd][nameEnd - 1]
        : character === name[nameEnd - 1] && table[patternEnd - 1][nameEnd - 1]
    }
  }
  return table[pattern.length][name.length]
}

function stringsUpTo(alphabet: string[], maximumLength: number): string[] {
  const strings = ['']
  let level = ['']
  for (let length = 1; length <= maximumLength; length++) {
    const next: string[] = []
    for (const prefix of level) {
      for (const character of alphabet) {
        next.push(prefix + character)
      }
    }
    strings.push(...next)
    level = next
  }
  return strings
}

describe('WXML removal name matching', () => {
  it('unions exact and wildcard rules while preserving explicit-name safety information', () => {
    const matcher = compileNames(['class', 'debug-card', 'data-*'])
    expect(matches(matcher, 'class')).toBe(true)
    expect(matches(matcher, 'debug-card')).toBe(true)
    expect(matches(matcher, 'data-testid')).toBe(true)
    expect(matches(matcher, 'data-')).toBe(true)
    expect(matches(matcher, 'debug-card-extra')).toBe(false)
    expect(matches(matcher, 'Debug-card')).toBe(false)
    expect(matches(matcher, 'DATA-testid')).toBe(false)
    expect(matcher.exact.has('class')).toBe(true)
    expect(matcher.exact.has('data-testid')).toBe(false)
    expect(matcher.exact.has('data-*')).toBe(false)
  })

  it('distinguishes no rules from an exact empty name and an all-name wildcard', () => {
    expect(matches(compileNames([]), '')).toBe(false)
    expect(matches(compileNames(''), '')).toBe(true)
    expect(matches(compileNames(''), 'view')).toBe(false)
    const matcher = compileNames('****')
    expect(matches(matcher, '')).toBe(true)
    expect(matches(matcher, 'view')).toBe(true)
    expect(matcher.exact.has('view')).toBe(false)
  })

  it('treats all non-star characters literally, including regex metacharacters', () => {
    const literal = '?.+^${}()|[]\\/'
    const exact = compileNames(literal)
    expect(matches(exact, literal)).toBe(true)
    expect(matches(exact, `${literal}extra`)).toBe(false)
    const wildcard = compileNames(`${literal}*end`)
    expect(matches(wildcard, `${literal}end`)).toBe(true)
    expect(matches(wildcard, `${literal}任意字符end`)).toBe(true)
    expect(matches(wildcard, 'anything-end')).toBe(false)
    expect(matches(wildcard, `${literal}END`)).toBe(false)
  })

  it.each([
    ['ab*cd', 'abcd', true],
    ['ab*', 'xab', false],
    ['*ab', 'abx', false],
    ['ab*ab', 'ab', false],
    ['ab*ab', 'abab', true],
    ['*aba*ba', 'xxaba', false],
    ['*aba*ba', 'ababa', true],
    ['*aba*aba*', 'xxababa', false],
    ['*aba*aba*', 'xxabaaba', true],
    ['*ab*ab', 'ababab', true],
  ])('matches %j against %j as %j without overlapping literal segments', (pattern, name, expected) => {
    expect(matches(compileNames(pattern), name)).toBe(expected)
  })

  it('preserves zero-length and nonempty wildcard gaps with adjacent and distributed stars', () => {
    const matcher = compileNames('**data-***test**-id***')
    expect(matches(matcher, 'data-test-id')).toBe(true)
    expect(matches(matcher, 'prefix-data-other-test-extra-id-suffix')).toBe(true)
    expect(matches(matcher, 'data-testid')).toBe(false)
    expect(matches(matcher, 'data-id-test')).toBe(false)
  })

  it.each([
    'data-********z',
    'data-*a*a*a*a*a*a*a*z',
    'data-*a*a*a*a*a*a*z*',
  ])('rejects the 69-character pathological name for %j without regex backtracking', (pattern) => {
    const name = `data-${'a'.repeat(64)}`
    const matcher = compileNames(pattern)
    expect(matches(matcher, name)).toBe(false)
    expect(matches(matcher, `${name}z`)).toBe(true)
  })

  it('agrees with a dynamic-programming oracle over finite names and glob patterns', () => {
    const names = stringsUpTo(['a', 'b'], 5)
    for (const pattern of stringsUpTo(['a', 'b', '*'], 5)) {
      const matcher = compileNames(pattern)
      for (const name of names) {
        expect(matches(matcher, name), JSON.stringify({ pattern, name }))
          .toBe(matchesWithDynamicProgramming(pattern, name))
      }
    }
  })
})
