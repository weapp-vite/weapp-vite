import type { Fixture } from './types'
import { describe, expect, it, vi } from 'vitest'
import * as wxml from '../../packages/wxml/src'
import { DECODED_XML_PARSE_OPTIONS, firstParse, RAW_XML_PARSE_OPTIONS } from './parserContract'

describe('shared raw parser options', () => {
  it('keeps raw XML tree settings separate from decoded query and serializer settings', () => {
    expect(RAW_XML_PARSE_OPTIONS).toEqual({ xmlMode: true, decodeEntities: false, recognizeSelfClosing: true, withStartIndices: true, withEndIndices: true })
    expect(DECODED_XML_PARSE_OPTIONS).toEqual({ ...RAW_XML_PARSE_OPTIONS, decodeEntities: true })
  })

  it('uses the raw tree contract for browser first parse without preparing serializer trees', () => {
    const fixtures: Fixture[] = [
      { id: 'weapp', sha256: 'weapp', bytes: 7, origins: ['test.wxml'], source: '<view/>', platform: 'weapp', cohort: 'shared', size: 'small' },
      { id: 'alipay', sha256: 'alipay', bytes: 7, origins: ['test.axml'], source: '<view/>', platform: 'alipay', cohort: 'shared', size: 'small' },
    ]
    const candidate = { ...wxml, parse: vi.fn(wxml.parse) }
    const html = { parseDocument: vi.fn(() => ({ type: 'root' })) }
    firstParse(fixtures, 'baseline', candidate, html)
    expect(html.parseDocument.mock.calls).toEqual(fixtures.map(fixture => [fixture.source, RAW_XML_PARSE_OPTIONS]))
    expect(candidate.parse).not.toHaveBeenCalled()
    html.parseDocument.mockClear()
    firstParse(fixtures, 'candidate', candidate, html)
    expect(candidate.parse.mock.calls).toEqual(fixtures.map(fixture => [fixture.source, { syntax: 'xml', platform: fixture.platform }]))
    expect(html.parseDocument).not.toHaveBeenCalled()
  })
})
