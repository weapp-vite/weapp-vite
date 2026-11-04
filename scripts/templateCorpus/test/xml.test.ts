import { describe, expect, it } from 'vitest'
import * as api from '../../../packages/wxml/src/index'
import { assertXmlDifferential, xmlDifferentialSummary } from '../assertions/xml'
import { classifyXmlSubset } from '../assertions/xmlSubset'
import { runFuzz } from '../fuzz'
import { generatePublicXmlCase } from '../fuzz/xml'
import { corpusProfiles } from '../profiles'
import { loadXmlBaseline } from './baseline'

describe('frozen common XML differential contract', () => {
  it('classifies common syntax before parsing, retaining every exclusion reason', () => {
    const options = { syntax: 'xml' as const, rawTags: ['jds'] }
    expect(classifyXmlSubset('<View title="one &amp; two"><Item/></View>', options)).toEqual({ eligible: true })
    for (const [source, reason] of [
      ['<view>{{value}}</view>', 'template-bindings'],
      ['<jds>source</jds>', 'configured-raw-script'],
      ['<!DOCTYPE view><view/>', 'declaration-or-processing-instruction'],
      ['<view bare/>', 'bare-attribute'],
      ['<view value=unquoted/>', 'unquoted-attribute'],
      ['<view a="one" a="two"/>', 'duplicate-xml-attribute'],
      ['<view>&unknown;</view>', 'non-xml-entity'],
      ['<view>&#0;</view>', 'non-xml-entity'],
      ['<view>\0</view>', 'non-xml-character'],
    ]) {
      expect(classifyXmlSubset(source!, options)).toEqual({ eligible: false, reason })
    }
  })

  it('compares ordered attributes, entity text, comments and CDATA with real htmlparser2 events', async () => {
    const baseline = await loadXmlBaseline()
    const summary = xmlDifferentialSummary()
    for (const profile of corpusProfiles) {
      const generated = generatePublicXmlCase(0x5EED2026, 42, profile)
      assertXmlDifferential(api, baseline.Parser, generated.source, { syntax: profile.syntax, rawTags: profile.rawTags }, summary)
    }
    expect(summary).toMatchObject({ executed: corpusProfiles.length, passed: corpusProfiles.length, failed: 0, skipped: 0 })
    expect(() => assertXmlDifferential({ ...api, decodeAttribute: () => 'corrupted' }, baseline.Parser, '<View title="expected"/>', { syntax: 'xml' }, summary)).toThrow('xml-differential')
    expect(summary.failed).toBe(1)
  })

  it('allocates common XML cases inside the existing valid budget and reports skips separately', async () => {
    const baseline = await loadXmlBaseline()
    const valid = corpusProfiles.length * 10
    const report = runFuzz(api, corpusProfiles, { valid, invalid: 0, editSequences: 0 }, baseline.Parser)
    expect(report.failures).toEqual([])
    expect(report.completed.valid).toBe(valid)
    expect(report.differential.executed).toBe(valid / 5)
    expect(report.differential.passed).toBe(valid / 5)
    expect(report.differential.skipped).toBe(valid * 4 / 5)
    expect(report.differential.reasons['duplicate-xml-attribute']).toBeGreaterThan(0)
  })
})
