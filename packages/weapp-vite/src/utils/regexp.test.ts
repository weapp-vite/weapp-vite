import { describe, expect, it } from 'vitest'
import { CSS_LANGS_RE, isCSSRequest, isRegexp, regExpTest } from './regexp'

describe('utils/regexp', () => {
  describe('isCSSRequest', () => {
    it('detects supported CSS extensions with queries', () => {
      expect(isCSSRequest('styles.wxss?inline')).toBe(true)
      expect(isCSSRequest('theme.scss')).toBe(true)
      expect(isCSSRequest('file.wxml')).toBe(false)
    })
  })

  describe('isRegexp', () => {
    it('checks value type', () => {
      expect(isRegexp(/foo/)).toBe(true)
      expect(isRegexp('foo')).toBe(false)
      expect(isRegexp(null)).toBe(false)
    })
  })

  describe('regExpTest', () => {
    it('matches substrings for string patterns by default', () => {
      expect(regExpTest(['components', 'widgets'], 'pages/components/index')).toBe(true)
      expect(regExpTest(['missing'], 'pages/components/index')).toBe(false)
    })

    it('supports exact string matching when requested', () => {
      expect(regExpTest(['foo', 'bar'], 'foo', { exact: true })).toBe(true)
      expect(regExpTest(['foo', 'bar'], 'foobar', { exact: true })).toBe(false)
    })

    it('resets lastIndex when testing regex patterns', () => {
      const pattern = /foo/g
      pattern.lastIndex = 10
      expect(regExpTest([pattern], 'foo foo')).toBe(true)
      expect(pattern.lastIndex).toBeGreaterThan(0)
    })

    it('throws when input is not an array', () => {
      expect(() => regExpTest(undefined as unknown as [], 'foo')).toThrowError(
        'paramater \'arr\' should be an Array of Regexp | String',
      )
    })
  })

  it('exposes the compiled CSS language regex', () => {
    expect(CSS_LANGS_RE.source).toContain('wxss')
  })
})
