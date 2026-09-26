import { ok as assert } from 'node:assert'
import { fs } from '@weapp-core/shared/node'
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
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_ROUTE = '/pages/issue-1012/index'

describe('e2e app: github-issues / issue #1012', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-1012/index.js',
      'pages/issue-1012/index.json',
      'pages/issue-1012/index.wxml',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('keeps JavaScript this ownership across compiled template expressions', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'initial',
      route: ISSUE_ROUTE,
      action: '检查动态 this 场景执行前的首屏',
      nodes: [
        { selector: '#issue1012-map-result', text: 'pending' },
        { selector: '#issue1012-results', text: 'pending' },
      ],
    }, {
      id: 'executed',
      route: ISSUE_ROUTE,
      action: '触发模板内联事件并检查动态与模板 this 的实际结果',
      nodes: [
        { selector: '#issue1012-map-result', text: '[7]' },
        { selector: '#issue1012-results', text: '[8,9,10,11,12,13,99,99,99,99]' },
      ],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 45_000, {
        readiness: async (targetPage) => {
          await targetPage.waitForRendered({ selector: '#issue-1012-page', timeout: 5_000 })
          return true
        },
      })
      assert(page, 'Expected issue-1012 page')
      await dom.check('initial', miniProgram, page)

      const runButton = await page.$('#issue1012-run', { timeout: 5_000 })
      assert(runButton, 'Expected issue-1012 run button')
      await runButton.tap()
      await dom.check('executed', miniProgram, page)

      const appJson = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as { pages?: string[] }
      expect(appJson.pages).toContain('pages/issue-1012/index')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
