import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callRoutePageMethodWithOptions,
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_564_ROUTE = '/pages/issue-564/index'
const ISSUE_564_LABELS = ['issue-564-home', 'issue-564-user']
const ISSUE_564_ROUTE_METHOD_OPTIONS = {
  protocolTimeoutMs: 30_000,
  retries: 1,
  recoveryAttempts: 2,
}

describe.sequential('e2e app: github-issues / issue #564', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders native component default content without nested scoped slot components in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, ISSUE_564_ROUTE, undefined, 45_000, {
        readiness: 'route',
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-564 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)

      const runtime = await callRoutePageMethodWithOptions<Record<string, any>>(
        activeMiniProgram,
        ISSUE_564_ROUTE,
        '_runE2E',
        ISSUE_564_ROUTE_METHOD_OPTIONS,
      )
      expect(runtime).toMatchObject({
        labels: ISSUE_564_LABELS,
        ok: true,
      })

      const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-564/index.wxml'), 'utf8')
      expect(pageWxml).toContain('<issue-564-native-tabbar>')
      expect(pageWxml).toContain('<issue-564-native-tabbar-item')
      expect(pageWxml).toContain('wx:for="{{tabItems}}"')
      expect(pageWxml).toContain('label="{{__wv_item_0.label}}"')
      expect(pageWxml).toContain('{{__wv_item_0.label}}')

      const itemWxml = await fs.readFile(path.join(DIST_ROOT, 'components/issue-564/native-tabbar-item/index.wxml'), 'utf8')
      expect(itemWxml).toContain('data-issue564-label="{{label}}"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
