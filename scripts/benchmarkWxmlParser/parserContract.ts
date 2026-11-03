import type { Arm, Fixture, WxmlApi } from './types'

export const RAW_XML_PARSE_OPTIONS = Object.freeze({ xmlMode: true, decodeEntities: false, recognizeSelfClosing: true, withStartIndices: true, withEndIndices: true })
export const DECODED_XML_PARSE_OPTIONS = Object.freeze({ ...RAW_XML_PARSE_OPTIONS, decodeEntities: true })

interface RawHtmlApi {
  parseDocument: (source: string, options: Record<string, unknown>) => unknown
}

/** 浏览器首次建树复用 warm 与 Node cold 的原文实体配置，不提前建立预备树。 */
export function firstParse(fixtures: Fixture[], arm: Arm, wxml: WxmlApi, html: RawHtmlApi) {
  let sink: unknown
  const start = performance.now()
  for (const fixture of fixtures) {
    sink = arm === 'candidate'
      ? wxml.parse(fixture.source, { syntax: 'xml', platform: fixture.platform as 'weapp' })
      : html.parseDocument(fixture.source, RAW_XML_PARSE_OPTIONS)
  }
  const duration = performance.now() - start
  Reflect.set(globalThis, '__wxmlColdSink', sink)
  return duration
}
