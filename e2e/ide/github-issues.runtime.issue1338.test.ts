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

const ISSUE_ROUTE = '/pages/issue-1338/index'

describe('e2e app: github-issues / issue #1338', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const extension of ['js', 'json', 'wxml']) {
      await expect(fs.pathExists(path.join(DIST_ROOT, `pages/issue-1338/index.${extension}`))).resolves.toBe(true)
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('runs the Web API compatibility cases in the mini-program runtime', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'initial',
      route: ISSUE_ROUTE,
      action: '检查 URL、URLSearchParams、FormData 和 AbortController 的兼容结果',
      nodes: [
        { selector: '#issue-1338-page' },
        { selector: '#issue1338-summary', text: 'issue-1338 Web API compatibility' },
        { selector: '#issue1338-relative', text: 'relative: https://example.com/api' },
      ],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 45_000, {
        readiness: async (targetPage) => {
          await targetPage.waitForRendered({ selector: '#issue-1338-page', timeout: 5_000 })
          return true
        },
      })
      if (!page) {
        throw new Error('Failed to launch issue-1338 page')
      }

      await expect.poll(() => page.callMethod('_runE2E'), { timeout: 10_000 }).toEqual({
        abort: {
          defaultReasonName: 'AbortError',
          explicitReason: 'timeout',
        },
        credentials: {
          host: 'example.com:8080',
          password: 'pass',
          username: 'user',
        },
        form: [
          ['key', 'uploads/b.txt'],
          ['file', 'payload'],
        ],
        ipv6: {
          hostname: '[::1]',
          port: '8080',
        },
        normalized: {
          href: 'https://example.com/a/c/d',
          pathname: '/a/c/d',
          port: '',
        },
        relative: 'https://example.com/api',
        search: {
          deleteByValue: 'a=1&b=3',
          setOrder: 'a=x&b=2',
        },
      })
      await dom.check('initial', miniProgram, page)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
