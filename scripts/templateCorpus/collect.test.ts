import type { CorpusSource } from './types'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { collectSources } from './collect'
import { mitFixtureLicense } from './collect/licenseFixtures'

const temporary: string[] = []
const commit = 'a'.repeat(40)
const source: CorpusSource = {
  repository: 'example/templates',
  commit,
  license: { spdx: 'MIT', files: ['LICENSE'] },
  selections: [{ platform: 'weapp', profileId: 'weapp-legacy', extensions: ['.wxml'], evidence: ['app.json'] }],
}

async function directory() {
  const result = await mkdtemp(path.join(os.tmpdir(), 'template-collect-'))
  temporary.push(result)
  return result
}

function transport(contents: Record<string, string>, calls: string[] = []) {
  const bytes = new Map(Object.entries(contents).map(([file, text]) => [file, new TextEncoder().encode(text)]))
  return {
    async json(endpoint: string) {
      calls.push(endpoint)
      return { truncated: false, tree: [...bytes].map(([path, value]) => ({ path, type: 'blob', sha: createHash('sha1').update(`blob ${value.length}\0`).update(value).digest('hex') })) }
    },
    async bytes(url: string) {
      calls.push(url)
      return bytes.get(decodeURIComponent(url.split(`/${commit}/`)[1]!))!
    },
  }
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('collects all selected files, freezes attribution and evidence, preserves BOM, and resumes without network', async () => {
  const cacheDir = await directory()
  const text = '\uFEFF<view wx:if="{{ok}}">😀</view>\r\n'
  const contents = { 'LICENSE': mitFixtureLicense, 'NOTICE': 'Original copyright', 'app.json': '{"pages":["home"]}', 'home.wxml': text, 'copy.wxml': text }
  const result = await collectSources([source], { cacheDir, transport: transport(contents) })
  expect(result.documents).toHaveLength(1)
  expect(result.documents[0]!.source).toBe(text)
  expect(result.documents[0]!.origins).toHaveLength(2)
  expect(result.licenses[0]!.files.map(file => file.path)).toEqual(['LICENSE', 'NOTICE'])
  expect(result.repositories[0]).toMatchObject({ treeFiles: 5, selectedFiles: 2, complete: true })
  expect(result.repositories[0]!.identityEvidence?.[0]).toMatchObject({ path: 'app.json' })
  const unavailable = async (): Promise<never> => {
    throw new Error('Resume unexpectedly accessed network')
  }
  expect(await collectSources([source], { cacheDir, transport: { json: unavailable, bytes: unavailable } })).toEqual(result)
})

it('retains unconfirmed platform candidates without counting them as accepted templates', async () => {
  const alipay: CorpusSource = { ...source, selections: [{ platform: 'alipay', profileId: 'alipay-xml', extensions: ['.axml'], evidence: ['app.json'] }] }
  const result = await collectSources([alipay], { cacheDir: await directory(), transport: transport({ 'LICENSE': mitFixtureLicense, 'app.json': '{"pages":["home"]}', 'home.axml': '<view a:if="{{ok}}"/>' }) })
  expect(result.documents).toEqual([])
  expect(result.excluded).toEqual([expect.objectContaining({ path: 'home.axml', platform: 'alipay', profileId: 'alipay-xml', reason: 'platform-identity-unconfirmed' })])
  expect(result.repositories[0]).toMatchObject({ selectedFiles: 0, excludedFiles: 1, complete: true })
})

it('extracts UX template content with raw container identity and original UTF-16 ranges', async () => {
  const quickapp: CorpusSource = { ...source, selections: [{ platform: 'quickapp', profileId: 'quickapp-template', extensions: ['.ux'], evidence: ['app.json'] }] }
  const container = '<template><div>😀</div></template><script>export default {}</script><style>.x { color: red }</style>'
  const result = await collectSources([quickapp], { cacheDir: await directory(), transport: transport({ 'LICENSE': mitFixtureLicense, 'README.md': '快应用示例', 'app.json': '{}', 'home.ux': container }) })
  expect(result.documents[0]!.source).toBe('<div>😀</div>')
  expect(result.documents[0]!.origins[0]!.evidence).toContain('container-template-utf16:10:23')
  expect(result.documents[0]!.origins[0]!.evidence!.some(item => item.startsWith('container-sha256:'))).toBe(true)
})

it('keeps unknown nested grants as attribution metadata and excludes their code without downloading it', async () => {
  const calls: string[] = []
  const result = await collectSources([source], { cacheDir: await directory(), transport: transport({
    'LICENSE': mitFixtureLicense,
    'app.json': '{"pages":["home"]}',
    'home.wxml': '<view wx:if="{{ok}}"/>',
    'external/LICENSE': 'From: https://example.invalid/original-article',
    'external/page.wxml': '<view wx:if="{{ok}}">not licensed by the ancestor</view>',
  }, calls) })
  expect(result.documents).toHaveLength(1)
  expect(result.documents[0]!.origins[0]).toMatchObject({ licensePath: 'LICENSE', licenseSpdx: 'MIT' })
  expect(result.excluded).toEqual([expect.objectContaining({ path: 'external/page.wxml', reason: 'nearest-license-grant-unconfirmed' })])
  expect(result.licenses[0]!.files).toHaveLength(2)
  expect(calls.some(call => call.endsWith('/external/page.wxml'))).toBe(false)
})
