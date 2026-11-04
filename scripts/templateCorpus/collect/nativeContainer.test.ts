import type { CorpusSource } from '../types'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { corpusHash } from '../integrity'
import { collectSources } from './index'
import { mitFixtureLicense } from './licenseFixtures'

const temporary: string[] = []
const source: CorpusSource = {
  repository: 'example/quickapp',
  commit: 'a'.repeat(40),
  license: { spdx: 'MIT', files: ['LICENSE'] },
  selections: [{ platform: 'quickapp', profileId: 'quickapp-template', extensions: ['.ux'], evidence: ['README.md'] }],
}

async function collect(containers: Record<string, string>) {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'native-template-container-'))
  temporary.push(cacheDir)
  const files = new Map(Object.entries({ 'LICENSE': mitFixtureLicense, 'README.md': '官方快应用格式测试工程', ...containers }).map(([file, text]) => [file, new TextEncoder().encode(text)]))
  return collectSources([source], {
    cacheDir,
    transport: {
      async json() {
        return { truncated: false, tree: [...files].map(([path, bytes]) => ({ path, type: 'blob', sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') })) }
      },
      async bytes(url) {
        return files.get(decodeURIComponent(url.split(`/${source.commit}/`)[1]!))!
      },
    },
  })
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('native UX template eligibility', () => {
  it('records script-only application exclusions while collecting explicit empty and nonempty templates', async () => {
    const application = '<script>export default { onCreate() { return "<template>fake</template>" } }</script>'
    const result = await collect({
      'app.ux': application,
      'empty.ux': '<template></template><script>export default {}</script>',
      'pages/home.ux': '<template><div>😀</div></template>',
    })
    expect(result.documents.map(document => document.source).sort()).toEqual(['', '<div>😀</div>'])
    expect(result.documents.flatMap(document => document.origins).map(origin => origin.path).sort()).toEqual(['empty.ux', 'pages/home.ux'])
    expect(result.excluded).toEqual([expect.objectContaining({
      repository: source.repository,
      commit: source.commit,
      path: 'app.ux',
      platform: 'quickapp',
      profileId: 'quickapp-template',
      reason: 'no-explicit-template',
      evidence: expect.arrayContaining([`container-sha256:${corpusHash(application)}`]),
    })])
    expect(result.repositories[0]).toMatchObject({ selectedFiles: 2, excludedFiles: 1, complete: true })
  })

  it('keeps an application-only source complete without counting it as a template', async () => {
    const result = await collect({ 'app.ux': '<script>export default {}</script>' })
    expect(result.documents).toEqual([])
    expect(result.excluded[0]).toMatchObject({ path: 'app.ux', reason: 'no-explicit-template' })
    expect(result.repositories[0]).toMatchObject({ selectedFiles: 0, excludedFiles: 1, complete: true })
  })

  it('preserves malformed container failures instead of turning them into no-template exclusions', async () => {
    for (const malformed of ['<template', '<template><div/>', '<template/>', '<template></template><template></template>', '<script>export default {}']) {
      await expect(collect({ 'app.ux': malformed, 'page.ux': '<template><div/></template>' })).rejects.toThrow()
    }
  })
})
