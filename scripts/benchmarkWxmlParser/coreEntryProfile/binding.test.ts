import type { CoreEntryApi, EntryFixture } from './types'
import { describe, expect, it, vi } from 'vitest'
import * as core from '../../../packages/wxml/src/core'
import * as root from '../../../packages/wxml/src/index'
import { bindCoreParsers, bindRootParsers } from './binding'

const fixtures: EntryFixture[] = [
  { id: 'first', source: '<view>{{value}}</view>', bytes: 22, profileId: 'xml', options: { syntax: 'xml', rawTags: [] } },
  { id: 'second', source: '<view/>', bytes: 7, profileId: 'xml', options: { syntax: 'xml', rawTags: [] } },
  { id: 'script', source: '<wxs>const value = "<view/>"</wxs>', bytes: 36, profileId: 'scripts', options: { syntax: 'xml', rawTags: ['wxs'] } },
]

describe('isolated core entry binding', () => {
  it('compiles each explicit dialect and creates each parser exactly once', () => {
    const api = { compileDialect: vi.fn(core.compileDialect), createParser: vi.fn(core.createParser) } as unknown as CoreEntryApi
    const parsers = bindCoreParsers(api, fixtures)
    expect(api.compileDialect).toHaveBeenCalledTimes(2)
    expect(api.createParser).toHaveBeenCalledTimes(2)
    expect(parsers.size).toBe(2)
    expect(parsers.get('scripts')!.scan(fixtures[2]!.source).tokens.some(token => token.kind === 'script')).toBe(true)
    for (const fixture of fixtures) {
      const bound = parsers.get(fixture.profileId)!
      const compatible = bindRootParsers(root, fixtures).get(fixture.profileId)!
      expect(bound.scan(fixture.source)).toEqual(compatible.scan(fixture.source))
      expect(bound.parse(fixture.source).tokens).toEqual(compatible.parse(fixture.source).tokens)
    }
  })

  it('rejects implicit platform inference and conflicting frozen profile definitions', () => {
    expect(() => bindCoreParsers(core as unknown as CoreEntryApi, [{ ...fixtures[0]!, options: {} }])).toThrow('explicit frozen syntax and rawTags')
    expect(() => bindCoreParsers(core as unknown as CoreEntryApi, [fixtures[0]!, { ...fixtures[1]!, options: { syntax: 'legacy', rawTags: [] } }])).toThrow('conflicting lexical definitions')
  })
})
