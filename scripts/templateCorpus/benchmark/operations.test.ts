import type { HtmlApi } from './types'
import { Buffer } from 'node:buffer'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'
import * as api from '../../../packages/wxml/src/index'
import { corpusHash } from '../integrity'
import { corpusProfiles } from '../profiles'
import { createProfileRuntime } from './operations'

it('runs actual metadata-producing parsers and full serialization on the same shared XML input', async () => {
  const require = createRequire(new URL('../../../packages/wxml/package.json', import.meta.url))
  const html = await import(pathToFileURL(require.resolve('htmlparser2')).href) as HtmlApi
  const { default: render } = await import(pathToFileURL(require.resolve('dom-serializer')).href) as { default: Parameters<typeof createProfileRuntime>[0]['render'] }
  const source = '<view title = \'&amp;\'/>'
  const profile = corpusProfiles.find(profile => profile.id === 'weapp-legacy')!
  const fixture = { id: 'shared-xml', sha256: corpusHash(source), source, bytes: Buffer.byteLength(source), profile, options: { syntax: profile.syntax, rawTags: profile.rawTags }, frameworks: ['native'], categories: ['native'], quotaEligible: true, features: ['attributes', 'entities'], size: 'small' as const, comparison: { eligible: true as const } }
  const runtime = createProfileRuntime({ api, html, render }, [fixture])
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
