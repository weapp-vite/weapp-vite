import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callRoutePageMethodWithOptions,
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'

const PUSH_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_push_result__'
const BACK_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_back_result__'
const SWITCH_TAB_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_switch_tab_result__'
const TAB_PUSH_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_tab_push_result__'
const STORAGE_TIMEOUT = 8_000
const ISSUE_PAGE_PATH = '/pages/issue-705/index'
const TAB_PAGE_PATH = '/pages/issue-705-tab/index'
const TARGET_PAGE_PATH = '/pages/issue-550/index'

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

async function waitForBackHooks(miniProgram: any) {
  const start = Date.now()
  let latest: any
  while (Date.now() - start <= STORAGE_TIMEOUT) {
    latest = await miniProgram.callWxMethodWithOptions('getStorageSync', {
      timeout: 2_500,
    }, BACK_RESULT_STORAGE_KEY).catch(() => undefined)
    if (latest?.hooks?.length >= 2) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for issue #705 back hooks: ${JSON.stringify(latest)}`)
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
    // 当前 DevTools 在 Page.callMethod 内可能只丢失导航回包，页面栈仍会成功切换。
    expect(result.failure.cause).toContain('navigateTo:fail timeout')
  }
  expect(result.route.path).toBe('pages/issue-550/index')
}

async function callIssue705PageMethod(
  miniProgram: any,
  route: string,
  action?: 'push' | 'switchTab',
  timeoutMs = 5_000,
) {
  return await callRoutePageMethodWithOptions<Record<string, any>>(
    miniProgram,
    route,
    '_runE2E',
    {
      protocolTimeoutMs: timeoutMs,
      recoveryAttempts: 1,
      retries: 1,
    },
    action,
  )
}

async function isIssue705PageReady(_page: any, miniProgram: any) {
  const runtime = await callIssue705PageMethod(miniProgram, ISSUE_PAGE_PATH).catch(() => undefined)
  return runtime?.ready === true && runtime?.route?.path === 'pages/issue-705/index'
}

async function waitForIssue705TabReady(miniProgram: any) {
  const start = Date.now()
  let latest: any
  while (Date.now() - start <= STORAGE_TIMEOUT) {
    latest = await callIssue705PageMethod(miniProgram, TAB_PAGE_PATH).catch(() => undefined)
    if (latest?.ready === true && latest?.route?.path === 'pages/issue-705-tab/index') {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for issue #705 tab readiness: ${JSON.stringify(latest)}`)
}

async function waitForIssue705Page(miniProgram: any) {
  const page = await waitForCurrentPagePath(miniProgram, ISSUE_PAGE_PATH, STORAGE_TIMEOUT)
  if (!page || !(await isIssue705PageReady(page, miniProgram))) {
    throw new Error('Failed to return to issue-705 page')
  }
  return page
}

async function navigateBackFromHost(miniProgram: any) {
  if (typeof miniProgram.navigateBack === 'function') {
    await miniProgram.navigateBack()
    return
  }
  await miniProgram.callWxMethodWithOptions('navigateBack', {
    timeout: 12_000,
  })
}

async function callIssue550BackAction(miniProgram: any, targetPage: any, action: string, timeoutMs: number) {
  if (typeof miniProgram.evaluateWithOptions !== 'function' && typeof miniProgram.evaluate !== 'function') {
    return await targetPage.callMethodWithOptions('_runE2E', {
      timeout: timeoutMs,
    }, action)
  }
  return await callRoutePageMethodWithOptions(
    miniProgram,
    TARGET_PAGE_PATH,
    '_runE2E',
    {
      protocolTimeoutMs: timeoutMs,
      recoveryAttempts: 1,
      retries: 1,
    },
    action,
  )
}

describe.sequential('e2e app: github-issues / issue #705', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('keeps route state and hook origins synchronized across router and native tab navigation', async (ctx) => {
    let miniProgram = await getSharedMiniProgram(ctx)
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
      miniProgram = await getSharedMiniProgram(ctx)

      await callIssue705PageMethod(miniProgram, ISSUE_PAGE_PATH, 'push', 12_000).catch(() => undefined)
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
      miniProgram = await getSharedMiniProgram(ctx)

      await callIssue705PageMethod(miniProgram, ISSUE_PAGE_PATH, 'switchTab', 12_000).catch(() => undefined)
      const switchTabResult = await waitForStorage(miniProgram, SWITCH_TAB_RESULT_STORAGE_KEY)
      expect({
        pageStack: switchTabResult.pageStack,
        route: switchTabResult.route.path,
        routerRoute: switchTabResult.routerRoute.path,
      }).toEqual({
        pageStack: ['pages/issue-705-tab/index'],
        route: 'pages/issue-705-tab/index',
        routerRoute: 'pages/issue-705-tab/index',
      })

      const tabPage = await waitForCurrentPagePath(miniProgram, '/pages/issue-705-tab/index', 8_000)
      if (!tabPage) {
        throw new Error('Failed to switch to issue-705 tab page')
      }

      const tabSnapshot = await waitForIssue705TabReady(miniProgram)
      expect(tabSnapshot.route.path).toBe('pages/issue-705-tab/index')

      await callIssue705PageMethod(miniProgram, TAB_PAGE_PATH, 'push', 12_000).catch(() => undefined)
      const tabPushResult = await waitForStorage(miniProgram, TAB_PUSH_RESULT_STORAGE_KEY)
      expectNavigationResult(tabPushResult, 'pages/issue-705-tab/index')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('restores route state after every back path and allows pushing the same target again', async (ctx) => {
    let miniProgram = await getSharedMiniProgram(ctx)
    try {
      for (const backMode of ['router', 'native', 'system'] as const) {
        await Promise.all([
          removeStorage(miniProgram, BACK_RESULT_STORAGE_KEY),
          removeStorage(miniProgram, PUSH_RESULT_STORAGE_KEY),
        ])
        const issuePage = await relaunchPage(
          miniProgram,
          ISSUE_PAGE_PATH,
          undefined,
          30_000,
          {
            readiness: isIssue705PageReady,
          },
        )
        if (!issuePage) {
          throw new Error(`Failed to launch issue-705 page for ${backMode} back`)
        }
        miniProgram = await getSharedMiniProgram(ctx)

        await callIssue705PageMethod(miniProgram, ISSUE_PAGE_PATH, 'push', 12_000).catch(() => undefined)
        const firstPushResult = await waitForStorage(miniProgram, PUSH_RESULT_STORAGE_KEY)
        expectNavigationResult(firstPushResult, 'pages/issue-705/index')

        const targetPage = await waitForCurrentPagePath(miniProgram, TARGET_PAGE_PATH, STORAGE_TIMEOUT)
        if (!targetPage) {
          throw new Error(`Failed to navigate to issue-705 target for ${backMode} back`)
        }

        if (backMode === 'system') {
          await callIssue550BackAction(miniProgram, targetPage, 'prepareBack', 5_000)
          await navigateBackFromHost(miniProgram)
        }
        else {
          const backStart = await callIssue550BackAction(
            miniProgram,
            targetPage,
            backMode === 'router' ? 'routerBack' : 'nativeBack',
            12_000,
          )
          expect(backStart).toEqual({
            mode: backMode,
            started: true,
          })
        }

        await waitForIssue705Page(miniProgram)
        const backResult = await waitForBackHooks(miniProgram)
        expect(backResult.hooks).toEqual([
          {
            phase: 'before',
            to: 'pages/issue-705/index',
            from: 'pages/issue-550/index',
          },
          {
            phase: 'after',
            to: 'pages/issue-705/index',
            from: 'pages/issue-550/index',
          },
        ])
        const returnedSnapshot = await callIssue705PageMethod(miniProgram, ISSUE_PAGE_PATH)
        expect(returnedSnapshot.route.path).toBe('pages/issue-705/index')
        expect(returnedSnapshot.routerRoute.path).toBe('pages/issue-705/index')

        await removeStorage(miniProgram, PUSH_RESULT_STORAGE_KEY)
        await callIssue705PageMethod(miniProgram, ISSUE_PAGE_PATH, 'push', 12_000).catch(() => undefined)
        const secondPushResult = await waitForStorage(miniProgram, PUSH_RESULT_STORAGE_KEY)
        expectNavigationResult(secondPushResult, 'pages/issue-705/index')
        expect(await waitForCurrentPagePath(miniProgram, TARGET_PAGE_PATH, STORAGE_TIMEOUT)).toBeTruthy()
      }
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
