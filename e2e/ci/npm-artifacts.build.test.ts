import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildNpmArtifactFixture, prepareNpmArtifactFixture } from '../utils/npmArtifactFixture'

describe('issues #1355 / #1356 npm artifact publication', () => {
  let project: string | undefined
  afterAll(async () => {
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })

  it('publishes complete npm assets before hooks for each output without rewriting the first artifact', async () => {
    project = await prepareNpmArtifactFixture()
    const first = await buildNpmArtifactFixture(project, 'dist')
    expect(first.observations).toEqual({ writeBundle: true, closeBundle: true })
    const stylesheet = 'miniprogram_npm/mini-lib/icon/index.wxss'
    const original = await readFile(path.join(first.output, stylesheet), 'utf8')
    const originalPage = await readFile(path.join(first.output, 'pages/index/index.js'), 'utf8')
    expect(original).toContain('artifact observer completed')

    for (const mode of ['demo', 'prune']) {
      const next = await buildNpmArtifactFixture(project, `dist-${mode}`, mode)
      expect(next.observations).toEqual({ writeBundle: true, closeBundle: true })
      expect(await readFile(path.join(next.output, stylesheet), 'utf8')).toContain('artifact observer completed')
      expect(await readFile(path.join(first.output, stylesheet), 'utf8')).toBe(original)
      expect(await readFile(path.join(first.output, 'pages/index/index.js'), 'utf8')).toBe(originalPage)
      await expect(access(path.join(next.output, 'miniprogram_npm/mini-lib/unused'))).rejects.toMatchObject({ code: 'ENOENT' })
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(next.output, `pages/index/index.${extension}`))
        await access(path.join(next.output, `miniprogram_npm/mini-lib/icon/index.${extension}`))
      }
    }
  }, 180_000)
})
