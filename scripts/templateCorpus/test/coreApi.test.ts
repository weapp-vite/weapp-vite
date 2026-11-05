import type { ParseOptions, TemplateDocument } from '../../../packages/wxml/src/types'
import type { CorpusDocument } from '../types'
import { describe, expect, it } from 'vitest'
import * as coreApi from '../../../packages/wxml/src/core'
import * as rootApi from '../../../packages/wxml/src/index'
import { runCorpusCases } from '../assertions/corpus'
import { runSyntaxMatrix } from '../assertions/syntax'
import { corpusHash } from '../integrity'
import { corpusProfiles } from '../profiles'
import { createCoreTemplateApi } from './coreApi'

const source = '<view disabled empty="" data="{{ value }}">😀</view>'
const documents: CorpusDocument[] = [{
  source,
  sha256: corpusHash(source),
  origins: corpusProfiles.map(profile => ({
    repository: 'weapp-vite/template-contracts',
    commit: '0123456789012345678901234567890123456789',
    path: `fixtures/${profile.id}.xml`,
    platform: profile.platform,
    profileId: profile.id,
    category: 'native' as const,
    licenseId: 'fixture-mit',
    expectation: 'valid' as const,
  })),
}]

describe('shared corpus contracts for root and platform-free core entries', () => {
  it('keeps test metadata outside the real core AST and retains edit context identity', () => {
    const parsed: TemplateDocument[] = []
    const api = createCoreTemplateApi({
      ...coreApi,
      createParser(dialect, options) {
        const parser = coreApi.createParser(dialect, options)
        return {
          ...parser,
          parse(source) {
            const document = parser.parse(source)
            parsed.push(document)
            return document
          },
        }
      },
    })
    const options = { syntax: 'xml' as const, rawTags: ['opaque'] }
    const document = api.parse('<opaque>const fake="</opaque><fake/>";</opaque>', options)
    expect(parsed[0]).not.toHaveProperty('platform')
    expect(parsed[0]).not.toHaveProperty('options')
    expect(document.tokens).toBe(parsed[0]?.tokens)
    const edited = api.edit(document, (handle) => {
      if (handle.node.kind === 'element') {
        handle.setBooleanAttribute('active')
      }
    })
    expect(api.serialize(edited)).toBe('<opaque active>const fake="</opaque><fake/>";</opaque>')
    expect(parsed[0]?.source).toBe('<opaque>const fake="</opaque><fake/>";</opaque>')
  })

  it('does not share parser contexts between distinct resolver closures with equal source text', () => {
    const api = createCoreTemplateApi(coreApi)
    const resolver = (accept: boolean): NonNullable<ParseOptions['resolveScriptBoundary']> => (_source, _start, _tag, candidates) => accept ? candidates.closingTag : undefined
    const selected = { syntax: 'xml' as const, rawTags: ['opaque'] }
    const source = '<opaque>module.exports={};</opaque>'
    expect(api.parse(source, { ...selected, resolveScriptBoundary: resolver(true) }).diagnostics).toEqual([])
    expect(api.parse(source, { ...selected, resolveScriptBoundary: resolver(false) }).diagnostics).not.toEqual([])
  })

  it.each([
    ['root', rootApi],
    ['core', createCoreTemplateApi(coreApi)],
  ] as const)('%s entry executes every registered syntax scenario', (_name, api) => {
    const report = runSyntaxMatrix(api, corpusProfiles)
    expect(report).toEqual(Object.fromEntries(corpusProfiles.map(profile => [profile.id, expect.any(Array)])))
    expect(Object.values(report).every(scenarios => scenarios.length > 0)).toBe(true)
  })

  it.each([
    ['root', rootApi],
    ['core', createCoreTemplateApi(coreApi)],
  ] as const)('%s entry uses the same source and edit assertions for every profile', (_name, api) => {
    const report = runCorpusCases(api, documents, corpusProfiles)
    expect(report.accepted).toBe(true)
    expect(report.pending).toBe(0)
    expect(report.failures).toEqual([])
    expect(report.cases).toBe(corpusProfiles.length)
    expect(report.entries.default.passed).toBe(corpusProfiles.length)
  })
})
