import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

const ROUTE = 'pages/index/index'
const DIRECT_BINDINGS = ['change', 'selectA', 'selectB', 'localVisible', 'localResult', 'hasNext']

describe('issue #1295: mergeModels props projection build', { concurrent: false }, () => {
  let project: string | undefined

  afterEach(async () => {
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
    project = undefined
  })

  it('emits complete page files and keeps unrelated bindings direct', async () => {
    project = await createIssueRegressionProject(1295)
    await buildIssueRegressionProject(project, 'weapp')
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([ROUTE])
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(project, 'dist', `${ROUTE}.${extension}`))
    }
    const template = await readFile(path.join(project, 'dist', `${ROUTE}.wxml`), 'utf8')
    for (const binding of DIRECT_BINDINGS) {
      expect(template).toMatch(new RegExp(`id="[^"]+">\\{\\{\\s*${binding}\\s*\\}\\}</text>`))
    }
    expect(template).toMatch(/id="model-value"[^>]*>\{\{__wv_bind_\d+\}\}/)
    expect(new Set(template.match(/__wv_bind_\d+/g)).size).toBe(1)
  }, 180_000)
})
