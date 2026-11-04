import type { CorpusLicense } from './types'
import { Buffer } from 'node:buffer'
import { expect, it } from 'vitest'
import { apacheFixtureLicense, mitFixtureLicense } from './collect/licenseFixtures'
import { corpusHash } from './integrity'
import { encodeLicenseFile, identifyLicense, licenseFileBytes, resolveTemplateLicense } from './license'

function license(files: Record<string, string>, spdx = 'MIT'): CorpusLicense {
  return { id: 'test', repository: 'example/templates', commit: 'a'.repeat(40), spdx, files: Object.entries(files).map(([path, text]) => encodeLicenseFile(path, new TextEncoder().encode(text))) }
}

it('requires an actual grant instead of a title, source URL or metadata identifier', () => {
  expect(identifyLicense(mitFixtureLicense)).toBe('MIT')
  expect(identifyLicense(apacheFixtureLicense)).toBe('Apache-2.0')
  for (const text of ['MIT', 'MIT License', 'SPDX-License-Identifier: MIT', 'From: https://example.invalid/article']) {
    expect(identifyLicense(text)).toBeUndefined()
  }
})

it('does not let dependency or sibling licenses authorize ancestor template code', () => {
  const dependencies = license({ 'node_modules/library/LICENSE': mitFixtureLicense, 'vendor/tool/LICENSE': mitFixtureLicense, 'other/LICENSE': mitFixtureLicense })
  expect(resolveTemplateLicense('src/page.wxml', dependencies)).toMatchObject({ confirmed: false, reason: 'no-ancestor-license-grant' })
  expect(resolveTemplateLicense('other/page.wxml', dependencies)).toMatchObject({ confirmed: true, path: 'other/LICENSE', spdx: 'MIT' })
  dependencies.files.push(encodeLicenseFile('LICENSE', new TextEncoder().encode(mitFixtureLicense)))
  expect(resolveTemplateLicense('src/page.wxml', dependencies)).toMatchObject({ confirmed: true, path: 'LICENSE', spdx: 'MIT' })
})

it('blocks inheritance through an unknown nested LICENSE while preserving licensed siblings', () => {
  const attribution = license({ 'LICENSE': mitFixtureLicense, 'components/copied/LICENSE': 'From: https://example.invalid/article', 'components/own/NOTICE': 'Copyright example' })
  expect(resolveTemplateLicense('components/copied/page.wxml', attribution)).toMatchObject({ confirmed: false, reason: 'nearest-license-grant-unconfirmed' })
  expect(resolveTemplateLicense('components/own/page.wxml', attribution)).toMatchObject({ confirmed: true, path: 'LICENSE' })
  expect(resolveTemplateLicense('components/copied-sibling/page.wxml', attribution)).toMatchObject({ confirmed: true, path: 'LICENSE' })
})

it('records a real nested grant and rejects a mismatched declared root license', () => {
  const nested = license({ 'LICENSE': mitFixtureLicense, 'lib/LICENSE': apacheFixtureLicense })
  expect(resolveTemplateLicense('lib/page.wxml', nested)).toMatchObject({ confirmed: true, path: 'lib/LICENSE', spdx: 'Apache-2.0' })
  expect(resolveTemplateLicense('page.wxml', license({ LICENSE: apacheFixtureLicense }))).toMatchObject({ confirmed: false, reason: 'declared-root-license-does-not-match-grant' })
})

it('does not guess a dual grant or inherit root MIT past conflicting numbered GPL files', () => {
  const gpl = (version: number) => `GNU GENERAL PUBLIC LICENSE Version ${version}\nTERMS AND CONDITIONS\nCopyright example`
  const attribution = license({ 'LICENSE': mitFixtureLicense, 'admin/LICENSE.txt': gpl(2), 'admin/LICENSE2.txt': gpl(3) })
  expect(resolveTemplateLicense('admin/package.json', attribution)).toMatchObject({ confirmed: false, reason: 'multiple-license-grants-require-confirmed-expression' })
  expect(resolveTemplateLicense('pages/home.qml', attribution)).toMatchObject({ confirmed: true, path: 'LICENSE', spdx: 'MIT' })
  expect(resolveTemplateLicense('admin/package.json', attribution).evidence).toEqual(attribution.files.filter(file => file.path.startsWith('admin/')).map(file => `license-scope:${file.path}:${file.sha256}`))
  const unknown = license({ 'LICENSE': mitFixtureLicense, 'vendor/COPYING2.txt': 'Unconfirmed grant; review required.' })
  expect(resolveTemplateLicense('vendor/Page.vue', unknown)).toMatchObject({ confirmed: false, reason: 'nearest-license-grant-unconfirmed' })
})

it('preserves non-UTF8 attribution bytes and hash without guessing a charset or granting ancestor permissions', () => {
  const bytes = Buffer.from('46726f6da3ba68747470733a2f2f6578616d706c652e696e76616c6964', 'hex')
  const encoded = encodeLicenseFile('external/LICENSE', bytes)
  expect(encoded).toMatchObject({ encoding: 'base64', bytes: bytes.length, sha256: corpusHash(bytes), base64: bytes.toString('base64') })
  expect(licenseFileBytes(encoded)).toEqual(new Uint8Array(bytes))
  const attribution = license({ LICENSE: mitFixtureLicense })
  attribution.files.push(encoded)
  expect(resolveTemplateLicense('external/page.wxml', attribution).confirmed).toBe(false)
  const viewed = encodeLicenseFile('external/LICENSE', bytes, 'gb18030')
  expect(viewed).toMatchObject({ charset: 'gb18030', decodedText: 'From：https://example.invalid' })
  expect(licenseFileBytes(viewed)).toEqual(new Uint8Array(bytes))
})

it('refuses altered original bytes and altered decoded views', () => {
  const bytes = Buffer.from('a3ba', 'hex')
  const encoded = encodeLicenseFile('LICENSE', bytes, 'gb18030')
  if (!('encoding' in encoded)) {
    throw new Error('Expected a base64 fixture')
  }
  expect(() => licenseFileBytes({ ...encoded, base64: `${encoded.base64}\n` })).toThrow('Noncanonical license base64')
  expect(() => licenseFileBytes({ ...encoded, bytes: 10 })).toThrow('License byte count mismatch')
  expect(() => licenseFileBytes({ ...encoded, decodedText: 'altered' })).toThrow('Decoded license view mismatch')
  expect(() => licenseFileBytes({ ...encoded, sha256: 'a'.repeat(64) })).toThrow('License content hash mismatch')
})
