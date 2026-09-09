import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
} from './github-issues.runtime.shared'

describe('github-issues runtime import.meta bindings', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #431: renders supported native wxml import.meta bindings at runtime', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'initial',
      route: '/pages/issue-431/index',
      action: '检查原生模板和脚本的环境变量、模块路径及资源属性替换',
      nodes: [
        { selector: '#issue431-env-label', text: 'issue-431 native wxml env replacement' },
        { selector: '#issue431-image', attributes: { src: 'https://static.example.com/issue-431/logo.png' } },
        { selector: '#issue431-double', text: '/pages/issue-431/index.wxml | /pages/issue-431' },
        { selector: '#issue431-single', text: '/pages/issue-431/index.wxml | /pages/issue-431' },
        { selector: '#issue431-script-url', text: '/pages/issue-431/index.js' },
        { selector: '#issue431-script-dirname', text: '/pages/issue-431' },
      ],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)

    const page = await relaunchPage(
      miniProgram,
      '/pages/issue-431/index',
      undefined,
      20_000,
      {
        readiness: async (page) => {
          const runtime = await page.callMethod('_runE2E')
          return runtime?.url === '/pages/issue-431/index.js'
        },
      },
    )
    if (!page) {
      throw new Error('Failed to launch issue-431 page')
    }

    const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-431/index.wxml'), 'utf8')
    const runtime = await page.callMethod('_runE2E')
    const importMetaSnapshot = JSON.parse(runtime.snapshot)

    expect(runtime).toMatchObject({
      dirname: '/pages/issue-431',
      url: '/pages/issue-431/index.js',
    })
    expect(importMetaSnapshot).toMatchObject({
      dirname: '/pages/issue-431',
      filename: '/pages/issue-431/index.js',
      url: '/pages/issue-431/index.js',
    })
    expect(pageWxml).toContain('data-case="double"')
    expect(pageWxml).toContain('data-case=\'single\'')
    expect(pageWxml).toMatch(/data-template-url=(["'])\{\{['"]\/pages\/issue-431\/index\.wxml['"]\}\}\1/)
    expect(pageWxml).toMatch(/data-template-dir=(["'])\{\{['"]\/pages\/issue-431['"]\}\}\1/)
    expect(pageWxml).toMatch(/data-env-label=(["'])\{\{['"]issue-431 native wxml env replacement['"]\}\}\1/)
    expect(pageWxml).toMatch(/data-env-base=(["'])\{\{['"]https:\/\/static\.example\.com\/issue-431['"]\}\}\1/)
    expect(pageWxml).not.toContain('import.meta.env')
    expect(pageWxml).not.toContain('import.meta.url')
    expect(pageWxml).not.toContain('import.meta.dirname')
    await dom.check('initial', await getSharedMiniProgram(ctx), page)
  })
})
