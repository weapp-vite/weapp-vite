import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { parseLockDocuments } from './parseLock'

function convertDocuments(documents: ReturnType<typeof parseLockDocuments>): unknown[] {
  const errors = documents.flatMap(document => document.errors)
  if (errors.length > 0) {
    throw errors[0]
  }
  return documents.map(document => document.toJS() as unknown)
}

describe('lockfile YAML validation', () => {
  it.each([
    {
      name: 'multiple documents and independent nested block and flow maps',
      source: 'packages:\n  example@1.0.0: {dependencies: {first: one, second: two}}\n---\npackages:\n  example@1.0.0:\n    dependencies:\n      first: one\n      second: two\n',
    },
    {
      name: 'quoted and escaped scalar keys',
      source: '"escaped\\u006bey": one\n"another key": two\n',
    },
    {
      name: 'distinct numeric, boolean, null and string scalar keys',
      source: '1: numeric\n"1": string\ntrue: boolean\n"true": string\nnull: empty\n"null": string\n',
    },
    {
      name: 'NaN scalar keys that are unequal with the default comparator',
      source: '.nan: first\n.nan: second\n',
    },
    {
      name: 'anchored values and alias keys without deep key comparison',
      source: 'base: &base {dependency: one}\nkey: &key example\npackages:\n  example@1.0.0: *base\naliasKeys:\n  ? *key\n  : first\n  ? *key\n  : second\n',
    },
    {
      name: 'repeated YAML 1.1 merge keys',
      source: '%YAML 1.1\n---\nbase: &base {first: one}\nother: &other {second: two}\npackages:\n  example@1.0.0:\n    <<: *base\n    <<: *other\n',
    },
  ])('matches the original parser and conversion for $name', ({ source }) => {
    const expected = convertDocuments(YAML.parseAllDocuments(source))
    expect(convertDocuments(parseLockDocuments(source))).toEqual(expected)
  })

  it.each([
    { name: 'root block keys', source: 'duplicate: one\nduplicate: two\n' },
    { name: 'nested flow keys', source: 'packages: {example@1.0.0: {duplicate: one, duplicate: two}}\n' },
    { name: 'escaped string keys', source: '"escaped\\u006bey": one\nescapedkey: two\n' },
    { name: 'numeric scalar keys', source: '1: one\n1.0: two\n' },
    { name: 'positive and negative zero', source: '0: one\n-0: two\n' },
    { name: 'a later document', source: 'valid: one\n---\nnested:\n  duplicate: one\n  duplicate: two\n' },
  ])('rejects duplicate $name just like the original parser', ({ source }) => {
    const original = YAML.parseAllDocuments(source)
    const documents = parseLockDocuments(source)
    const expectedCodes = original.flatMap(document => document.errors.map(error => error.code))
    expect(expectedCodes).toContain('DUPLICATE_KEY')
    expect(documents.flatMap(document => document.errors.map(error => error.code))).toEqual(expectedCodes)
    expect(() => convertDocuments(original)).toThrow()
    expect(() => convertDocuments(documents)).toThrow()
  })

  it.each([
    { name: 'malformed nested flow syntax', source: 'packages:\n  example@1.0.0: {broken: [one, two}\n' },
    { name: 'malformed syntax in a later document', source: 'valid: one\n---\nbroken: "unterminated\n' },
    { name: 'duplicate ordered-map keys', source: 'packages: !!omap\n  - example@1.0.0: one\n  - example@1.0.0: two\n' },
  ])('preserves rejection of $name', ({ source }) => {
    const original = YAML.parseAllDocuments(source)
    const documents = parseLockDocuments(source)
    expect(original.flatMap(document => document.errors)).not.toEqual([])
    expect(documents.flatMap(document => document.errors.map(error => error.code)))
      .toEqual(original.flatMap(document => document.errors.map(error => error.code)))
    expect(() => convertDocuments(original)).toThrow()
    expect(() => convertDocuments(documents)).toThrow()
  })

  it.each([
    { name: 'an unresolved alias', source: 'packages:\n  example@1.0.0: *missing\n', error: /Unresolved alias/ },
    { name: 'an invalid merge source', source: '%YAML 1.1\n---\npackages:\n  example@1.0.0:\n    <<: one\n', error: /Merge sources must be maps/ },
    { name: 'excessive aliases', source: `base: &base value\nvalues: [${Array.from({ length: 101 }).fill('*base').join(', ')}]\n`, error: /Excessive alias count/ },
  ])('keeps full conversion checks for $name', ({ source, error }) => {
    const original = YAML.parseAllDocuments(source)
    const documents = parseLockDocuments(source)
    expect(original.flatMap(document => document.errors)).toEqual([])
    expect(documents.flatMap(document => document.errors)).toEqual([])
    expect(() => convertDocuments(original)).toThrow(error)
    expect(() => convertDocuments(documents)).toThrow(error)
  })
})
