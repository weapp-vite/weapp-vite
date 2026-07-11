import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'

const PUSH_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_push_result__'
const SWITCH_TAB_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_switch_tab_result__'
const TAB_PUSH_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_tab_push_result__'
const STORAGE_TIMEOUT = 8_000

async function removeStorage(miniProgram: any, key: string) {
  await miniProgram.callWxMethodWithOptions('removeStorageSync', {
    timeout: 2_500,
  }, key).catch(() => {})
}

async function waitForStorage(miniProgram: any, key: string) {
  const start = Date.now()
  let latest: any
  while (Date.now() - start <= STORAGE_TIMEOUT) {
    latest = await miniProgram.callWxMethodWithOptions('getStorageSync', {
      timeout: 2_500,
    }, key).catch(() => undefined)
    if (latest?.route?.path) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for issue #705 storage probe: key=${key} latest=${JSON.stringify(latest)}`)
}

function expectNavigationResult(result: any, from: string) {
  expect(result.hooks).toEqual([
    {
      phase: 'before',
      to: 'pages/issue-550/index',
      from,
    },
    {
      phase: 'after',
      to: 'pages/issue-550/index',
      from,
    },
  ])
  if (result.failure) {
    // 当前 DevTools 在 Page.callMethod 内导航时可能超时；hooks 参数仍必须正确。
    expect(result.failure.cause).toContain('navigateTo:fail timeout')
    expect(result.route.path).toBe(from)
  }
  else {
    expect(result.route.path).toBe('pages/issue-550/index')
  }
}

async function isIssue705PageReady(page: any) {
  const runtime = await page.callMethodWithOptions('_runE2E', {
    timeout: 5_000,
  }).catch(() => undefined)
  return runtime?.ready === true && runtime?.route?.path === 'pages/issue-705/index'
}

async function waitForIssue705TabReady(page: any) {
  const start = Date.now()
  let latest: any
  while (Date.now() - start <= STORAGE_TIMEOUT) {
    latest = await page.callMethodWithOptions('_runE2E', {
      timeout: 5_000,
    }).catch(() => undefined)
    if (latest?.ready === true && latest?.route?.path === 'pages/issue-705-tab/index') {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for issue #705 tab readiness: ${JSON.stringify(latest)}`)
}

describe.sequential('e2e app: github-issues / issue #705', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('keeps route state and hook origins synchronized across router and native tab navigation', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      await Promise.all([
        removeStorage(miniProgram, PUSH_RESULT_STORAGE_KEY),
        removeStorage(miniProgram, SWITCH_TAB_RESULT_STORAGE_KEY),
        removeStorage(miniProgram, TAB_PUSH_RESULT_STORAGE_KEY),
      ])

      const issuePage = await relaunchPage(
        miniProgram,
        '/pages/issue-705/index',
        undefined,
        30_000,
        {
          readiness: isIssue705PageReady,
        },
      )
      if (!issuePage) {
        throw new Error('Failed to launch issue-705 page')
      }

      await issuePage.callMethodWithOptions('_runE2E', {
        timeout: 12_000,
      }, 'push').catch(() => undefined)
      const pushResult = await waitForStorage(miniProgram, PUSH_RESULT_STORAGE_KEY)
      expectNavigationResult(pushResult, 'pages/issue-705/index')

      const reloadedIssuePage = await relaunchPage(
        miniProgram,
        '/pages/issue-705/index',
        undefined,
        30_000,
        {
          readiness: isIssue705PageReady,
        },
      )
      if (!reloadedIssuePage) {
        throw new Error('Failed to relaunch issue-705 page')
      }

      await reloadedIssuePage.callMethodWithOptions('_runE2E', {
        timeout: 12_000,
      }, 'switchTab').catch(() => undefined)
      const switchTabResult = await waitForStorage(miniProgram, SWITCH_TAB_RESULT_STORAGE_KEY)
      expect(switchTabResult.route.path).toBe('pages/issue-705-tab/index')

      const tabPage = await waitForCurrentPagePath(miniProgram, '/pages/issue-705-tab/index', 8_000)
      if (!tabPage) {
        throw new Error('Failed to switch to issue-705 tab page')
      }

      const tabSnapshot = await waitForIssue705TabReady(tabPage)
      expect(tabSnapshot.route.path).toBe('pages/issue-705-tab/index')

      await tabPage.callMethodWithOptions('_runE2E', {
        timeout: 12_000,
      }, 'push').catch(() => undefined)
      const tabPushResult = await waitForStorage(miniProgram, TAB_PUSH_RESULT_STORAGE_KEY)
      expectNavigationResult(tabPushResult, 'pages/issue-705-tab/index')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
