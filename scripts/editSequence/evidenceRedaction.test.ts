import { Buffer } from 'node:buffer'
import { expect, it } from 'vitest'
import { redactSequenceEvidence, redactSequenceEvidenceText } from './evidenceRedaction'

it.each([
  ['C:\\work\\fixture', 'C:\\work\\fixture\\src\\page.vue'],
  ['/work/fixture', '/work/fixture/src/page.vue'],
])('normalizes diagnostic path suffixes for %s after decoding', (root, file) => {
  for (const encoded of [file, JSON.stringify(file), JSON.stringify(JSON.stringify(file)), encodeURIComponent(encodeURIComponent(file))]) {
    const result = redactSequenceEvidenceText(`regex\\w; compile failed: ${encoded}; trailing regex\\d`, root, '/work/repository')
    expect(result).toContain('<fixture>/src/page.vue')
    expect(result).toContain('regex\\w;')
    expect(result).toContain('trailing regex\\d')
    expect(result).not.toContain(root)
  }
})

it('normalizes recognized repository paths independently of the fixture', () => {
  expect(redactSequenceEvidenceText('at C:\\work\\repository\\src\\entry.ts:3:4', 'C:\\work\\fixture', 'C:\\work\\repository'))
    .toBe('at <repo>/src/entry.ts:3:4')
})

it.each([[256, 32], [384, 48], [512, 64]] as const)('preserves canonical sha%i integrity bytes while redacting surrounding paths', (algorithm, bytes) => {
  const integrity = `sha${algorithm}-${Buffer.alloc(bytes, 255).toString('base64')}`
  expect(redactSequenceEvidenceText(integrity, '/work/fixture')).toBe(integrity)
  expect(redactSequenceEvidence({ integrity }, '/work/fixture')).toEqual({ integrity })
  const result = redactSequenceEvidenceText(`integrity=${integrity}; failed at C:\\Users\\private-source\\page.vue`, '/work/fixture')
  expect(result).toContain(`integrity=${integrity};`)
  expect(result).toContain('<external>')
  expect(result).not.toContain('private-source')
})

it('rejects noncanonical, wrong-length and path-suffixed integrity spellings', () => {
  const digest = Buffer.alloc(32, 255).toString('base64')
  for (const value of [
    `sha512-${digest}`,
    `sha256-${digest.replace(/8=$/, '9=')}`,
    `sha256-${digest.replace(/=$/, '')}`,
    `sha256-${digest}/private-source/page.vue`,
    `sha256-${digest}=`,
    'sha512-/Users/private-source/page.vue',
  ]) {
    const result = redactSequenceEvidenceText(value, '/work/fixture')
    expect(result).not.toBe(value)
    expect(result).not.toContain('private-source')
  }
})

it('keeps preexisting placeholder-like diagnostics distinct from protected integrity tokens', () => {
  const integrity = `sha512-${Buffer.alloc(64, 255).toString('base64')}`
  const value = `<sequence-integrity:0> ${integrity}`
  expect(redactSequenceEvidenceText(value, '/work/fixture')).toBe(value)
})
