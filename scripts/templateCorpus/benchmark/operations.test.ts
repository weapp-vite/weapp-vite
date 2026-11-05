import type { TemplateApi } from '../assertions'
import type { HtmlApi, ProfileFixture, ProfileOperation } from './types'
import { Buffer } from 'node:buffer'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'
import * as api from '../../../packages/wxml/src/index'
import { corpusHash } from '../integrity'
import { corpusProfiles } from '../profiles'
import { createProfileRuntime } from './operations'

async function dependencies() {
  const require = createRequire(new URL('../../../packages/wxml/package.json', import.meta.url))
  const html = await import(pathToFileURL(require.resolve('htmlparser2')).href) as HtmlApi
  const { default: render } = await import(pathToFileURL(require.resolve('dom-serializer')).href) as { default: Parameters<typeof createProfileRuntime>[0]['render'] }
  return { html, render }
}

function fixtureFor(source: string): ProfileFixture {
  const profile = corpusProfiles.find(profile => profile.id === 'weapp-legacy')!
  return { id: 'shared-xml', sha256: corpusHash(source), source, bytes: Buffer.byteLength(source), profile, options: { syntax: profile.syntax, rawTags: profile.rawTags }, frameworks: ['native'], categories: ['native'], quotaEligible: true, features: ['attributes', 'entities'], size: 'small', comparison: { eligible: true } }
}

it('runs actual metadata-producing parsers and full serialization on the same shared XML input', async () => {
  const source = '<view title = \'&amp;\'/>'
  const fixture = fixtureFor(source)
  const runtime = createProfileRuntime({ api, ...await dependencies() }, [fixture])
  expect(runtime.prepare()).toEqual([])
  expect(runtime.run(fixture, 'scan', 'candidate')).toEqual(runtime.run(fixture, 'scan', 'baseline'))
  const parsed = runtime.run(fixture, 'parse', 'candidate') as ReturnType<typeof api.parse>
  expect(parsed.tokens.length).toBeGreaterThan(0)
  for (const arm of ['candidate', 'baseline'] as const) {
    const output = runtime.run(fixture, 'canonical', arm)
    expect(typeof output).toBe('string')
    expect(output).not.toBe(source)
    expect(output).toContain('title="&amp;"')
  }
})

it('binds each actual API once and keeps parse, edit and serialization equivalent to the compatibility runner', async () => {
  const source = '<view title=\'&amp;\'>old &amp; text</view>'
  const fixture = fixtureFor(source)
  const reads: string[] = []
  const tracked = (arm: string): TemplateApi => ({
    get scan() {
      reads.push(`${arm}:scan`)
      return api.scan
    },
    get parse() {
      reads.push(`${arm}:parse`)
      return api.parse
    },
    get edit() {
      reads.push(`${arm}:edit`)
      return api.edit
    },
    get serialize() {
      reads.push(`${arm}:serialize`)
      return api.serialize
    },
    get decodeAttribute() {
      reads.push(`${arm}:decodeAttribute`)
      return api.decodeAttribute
    },
    walk: api.walk,
  })
  const runtime = createProfileRuntime({ api: tracked('candidate'), baselineApi: tracked('baseline'), ...await dependencies() }, [fixture])
  expect(runtime.prepare()).toEqual([])
  reads.length = 0
  const operations = ['scan', 'parse', 'canonical', 'parse-edit-serialize', 'preserve-noop'] as const
  const runners = operations.flatMap(operation => (['baseline', 'candidate'] as const).map(arm => ({ operation, arm, run: runtime.select(operation, arm) })))
  const selectedReads = reads.slice()
  expect(selectedReads).toEqual([
    'baseline:parse',
    'candidate:parse',
    'baseline:serialize',
    'candidate:serialize',
    'baseline:parse',
    'baseline:edit',
    'baseline:serialize',
    'candidate:parse',
    'candidate:edit',
    'candidate:serialize',
    'baseline:serialize',
    'candidate:serialize',
  ])
  const outputs = runners.map(runner => ({ ...runner, output: runner.run(fixture) }))
  for (const { run, output } of outputs) {
    expect(run(fixture)).toEqual(output)
  }
  expect(reads).toEqual(selectedReads)
  for (const { operation, arm, output } of outputs) {
    expect(runtime.run(fixture, operation, arm)).toEqual(output)
    expect(() => runtime.verifyOperation!(fixture, operation)).not.toThrow()
    if (operation === 'parse') {
      expect((output as ReturnType<typeof api.parse>).tokens.length).toBeGreaterThan(0)
    }
    if (operation === 'parse-edit-serialize') {
      expect(output).toBe('<view title="&amp;" data-template-regression="edited">template regression text</view>')
    }
    if (operation === 'preserve-noop') {
      expect(output).toBe(source)
    }
  }
})

it('selects the requested real consumer arm and preserves missing baseline failures', async () => {
  const fixture = fixtureFor('<view>text</view>')
  const consumers = {
    'consumer-scanner': {
      baseline: (file: ProfileFixture) => api.parse(file.source, { syntax: 'legacy' }),
      candidate: (file: ProfileFixture) => api.parse(file.source, { syntax: 'xml' }),
    },
  }
  const runtime = createProfileRuntime({ api, consumers, ...await dependencies() }, [fixture])
  for (const arm of ['baseline', 'candidate'] as const) {
    const runner = runtime.select('consumer-scanner', arm)
    expect(runner).toBe(consumers['consumer-scanner'][arm])
    expect((runner(fixture) as ReturnType<typeof api.parse>).syntax).toBe(arm === 'baseline' ? 'legacy' : 'xml')
    expect(runtime.run(fixture, 'consumer-scanner', arm)).toEqual(runner(fixture))
  }
  for (const operation of ['consumer-web', 'parse-edit-serialize'] satisfies ProfileOperation[]) {
    expect(() => runtime.select(operation, 'baseline')).toThrow(operation === 'consumer-web' ? 'Missing paired production entry' : 'requires a paired TemplateApi')
    expect(() => runtime.run(fixture, operation, 'baseline')).toThrow()
  }
})
