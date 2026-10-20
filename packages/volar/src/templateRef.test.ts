import { resolveTemplateRefLib } from './templateRef'

describe('template ref file lib directives', () => {
  it('uses the project lib when comments contain no valid lib override', () => {
    expect(resolveTemplateRefLib('wevu', [])).toBe('wevu')
    expect(resolveTemplateRefLib('vue', ['@lib wevu', '@lib "wevu', '@library "wevu"'])).toBe('vue')
  })

  it('keeps the last valid lib while ignoring later malformed JSON', () => {
    expect(resolveTemplateRefLib('vue', ['@lib "wevu"', '@lib "vue"', '@lib wevu'])).toBe('vue')
    expect(resolveTemplateRefLib('wevu', ['@lib "vue"', '@lib "wevu"', '@lib {'])).toBe('wevu')
  })

  it('reads only the first matching directive in each comment', () => {
    expect(resolveTemplateRefLib('vue', ['@strictTemplates true\n@lib "wevu"'])).toBe('vue')
    expect(resolveTemplateRefLib('wevu', ['@lib "vue"\n@lib "wevu"'])).toBe('vue')
    expect(resolveTemplateRefLib('vue', ['@lib broken\n@lib "wevu"'])).toBe('vue')
  })

  it('preserves valid JSON values instead of coercing an unsupported lib to wevu', () => {
    expect(resolveTemplateRefLib('wevu', ['@lib null'])).toBeNull()
    expect(resolveTemplateRefLib('wevu', ['@lib ["wevu"]'])).toEqual(['wevu'])
  })

  it.each(['\n', '\r', '\r\n', '\u2028', '\u2029'])('keeps line boundaries and cross-line separators for %j', (lineBreak) => {
    expect(resolveTemplateRefLib('vue', [`ignored${lineBreak}\t@lib "wevu"  ${lineBreak}later`])).toBe('wevu')
    expect(resolveTemplateRefLib('vue', [`@lib${lineBreak}\t"wevu"`])).toBe('wevu')
    expect(resolveTemplateRefLib('vue', [`@${lineBreak}@lib "wevu"`])).toBe('wevu')
    expect(resolveTemplateRefLib('vue', [`@other${lineBreak}@lib "wevu"`])).toBe('vue')
    expect(resolveTemplateRefLib('vue', [`@lib${lineBreak}@lib "wevu"`])).toBe('vue')
  })

  it('keeps generic keys and the first matched directive even when they do not set lib', () => {
    expect(resolveTemplateRefLib('vue', ['@ lib "wevu"\n@lib "wevu"'])).toBe('vue')
    expect(resolveTemplateRefLib('vue', ['@  lib "wevu"\n@lib "wevu"'])).toBe('vue')
    expect(resolveTemplateRefLib('vue', ['@\tlib "wevu"\n@lib "wevu"'])).toBe('vue')
    expect(resolveTemplateRefLib('vue', ['@plugins []\n@lib "wevu"'])).toBe('vue')
    expect(resolveTemplateRefLib('vue', ['text @lib "wevu"'])).toBe('vue')
    expect(resolveTemplateRefLib('vue', ['@\n@lib "wevu"'])).toBe('wevu')
  })

  it('preserves JSON whitespace, trailing content and unsupported scalar values', () => {
    expect(resolveTemplateRefLib('vue', ['\uFEFF\v\f@lib\u00A0"wevu"\t\uFEFF'])).toBe('wevu')
    expect(resolveTemplateRefLib('vue', ['@lib "wevu" trailing\n@lib "wevu"'])).toBe('vue')
    expect(resolveTemplateRefLib('wevu', ['@lib false'])).toBe(false)
    expect(resolveTemplateRefLib('wevu', ['@lib 0'])).toBe(0)
    expect(resolveTemplateRefLib('vue', ['@lib\n\n', '@lib \n\n', '@lib\n ', '@lib  '])).toBe('vue')
    expect(resolveTemplateRefLib('vue', ['@lib "wevu"', '@lib \n\n'])).toBe('wevu')
  })

  it('scans long whitespace and malformed keys without ambiguous backtracking', () => {
    const whitespace = ' \t\n'.repeat(10_000)
    expect(resolveTemplateRefLib('vue', [`${whitespace}@lib${whitespace}"wevu"${whitespace}`])).toBe('wevu')
    expect(resolveTemplateRefLib('vue', [`${whitespace}@${'x'.repeat(30_000)}`])).toBe('vue')
    expect(resolveTemplateRefLib('vue', [`@lib${whitespace}`])).toBe('vue')
    expect(resolveTemplateRefLib('vue', [`${'@\n'.repeat(10_000)}@lib "wevu"`])).toBe('wevu')
  })
})
