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

const ISSUE_1009_ROUTE = '/pages/issue-1009/index'
const EXPECTED_RESULTS = {
  bindings: 'CS',
  control: 'PA',
  ctxCallback: 'PA',
  event: 'PA-tap',
  nested: 'PAA',
  scopeCallback: 'IA',
}

describe('e2e app: github-issues / issue #1009', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-1009/index.js',
      'pages/issue-1009/index.json',
      'pages/issue-1009/index.wxml',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('keeps compiler-owned handler parameters isolated from user bindings', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'initial',
      route: ISSUE_1009_ROUTE,
      action: '检查内联事件尚未执行的首屏',
      nodes: [
        { selector: '#issue-1009-page', attributes: { 'data-e2e-issue': '1009' } },
        { selector: '#issue1009-result-ctx', text: 'ctx: pending' },
        { selector: '#issue1009-result-scope', text: 'scope: pending' },
        { selector: '#issue1009-result-bindings', text: 'bindings: pending' },
        { selector: '#issue1009-result-nested', text: 'nested: pending' },
        { selector: '#issue1009-result-event', text: 'event: pending' },
        { selector: '#issue1009-result-control', text: 'control: pending' },
      ],
    }, {
      id: 'completed',
      route: ISSUE_1009_ROUTE,
      action: '依次触发冲突与对照事件并检查运行结果',
      nodes: [
        { selector: '#issue1009-result-ctx', text: 'ctx: PA' },
        { selector: '#issue1009-result-scope', text: 'scope: IA' },
        { selector: '#issue1009-result-bindings', text: 'bindings: CS' },
        { selector: '#issue1009-result-nested', text: 'nested: PAA' },
        { selector: '#issue1009-result-event', text: 'event: PA-tap' },
        { selector: '#issue1009-result-control', text: 'control: PA' },
      ],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, ISSUE_1009_ROUTE, undefined, 45_000, {
        readiness: async (targetPage) => {
          await targetPage.waitForRendered({ selector: '#issue-1009-page', timeout: 5_000 })
          return true
        },
      })
      assert(page, 'Expected issue-1009 page')
      await dom.check('initial', miniProgram, page)

      for (const selector of [
        '#issue1009-ctx-callback',
        '#issue1009-scope-callback',
        '#issue1009-component-bindings',
        '#issue1009-nested-callbacks',
        '#issue1009-event-boundary',
        '#issue1009-control',
      ]) {
        const control = await page.$(selector, { timeout: 2_000 })
        assert(control, `Expected issue-1009 control ${selector}`)
        await control.tap()
      }

      await expect.poll(
        async () => await page.callMethod('_runE2E'),
        { timeout: 10_000 },
      ).toEqual(EXPECTED_RESULTS)
      await dom.check('completed', miniProgram, page)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
