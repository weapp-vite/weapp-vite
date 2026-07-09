import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callRoutePageMethod,
  callRoutePageMethodWithOptions,
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const ISSUE466_FLOW_CALL_OPTIONS = {
  protocolTimeoutMs: 30_000,
  retries: 1,
  recoveryAttempts: 2,
}

async function waitForIssue466PageMarker(page: any, selector: string, marker: string) {
  await page.waitForRendered({
    selector,
    dataset: { e2eIssue: marker },
    timeout: 2_500,
  })
  return true
}

async function navigateToIssue466Page(miniProgram: any, route: string, selector: string, marker: string) {
  await miniProgram.navigateTo(route).catch(() => {})
  const page = await waitForCurrentPagePath(miniProgram, route, 30_000)
  if (!page) {
    return null
  }
  await waitForIssue466PageMarker(page, selector, marker)
  return page
}

async function waitForIssue466Runtime(miniProgram: any, route: string, page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, route, '_runE2E')
      lastRuntime = runtime
      if (
        runtime?.alertType === 'function'
        && runtime?.confirmType === 'function'
        && runtime?.actionType === 'function'
        && runtime?.closeType === 'function'
      ) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  throw new Error(`Timed out waiting for issue-466 runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
}

async function waitForIssue466NativeRuntime(miniProgram: any, route: string, page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, route, '_runE2E')
      lastRuntime = runtime
      if (
        runtime?.confirmType === 'function'
        && runtime?.alertType === 'function'
      ) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  throw new Error(`Timed out waiting for issue-466 native runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
}

async function waitForIssue466MainRuntime(miniProgram: any, route: string, page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, route, '_runE2E')
      lastRuntime = runtime
      if (runtime?.confirmType === 'function') {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  throw new Error(`Timed out waiting for issue-466 main runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
}

describe.sequential('github-issues runtime issue-466', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('issue #466: keeps main-package tdesign Dialog.confirm callable through a user-facing page flow', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const route = '/pages/issue-466/index'
    let collector: ReturnType<typeof attachRuntimeErrorCollector> | null = null

    try {
      const page = await relaunchPage(miniProgram, route, undefined, 45_000, {
        readiness: page => waitForIssue466PageMarker(page, '#issue466-page', '466-main'),
      })
      if (!page) {
        throw new Error('Failed to launch main-package issue-466 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      collector = attachRuntimeErrorCollector(activeMiniProgram)

      await page.waitFor(600)
      await waitForIssue466MainRuntime(activeMiniProgram, route, page)

      const marker = collector.mark()
      const flow = await callRoutePageMethodWithOptions<Record<string, any>>(
        activeMiniProgram,
        route,
        '_runMainDialogFlowE2E',
        ISSUE466_FLOW_CALL_OPTIONS,
      )
      expect(collector.getSince(marker)).toEqual([])

      expect(flow.reset).toMatchObject({
        confirmType: 'function',
        openCount: 0,
        settleCount: 0,
        dialogVisible: false,
        lastAction: 'idle',
        lastTrigger: 'idle',
        lastError: '',
        lastPayload: '',
        lastReturnedPromise: false,
      })

      expect(flow.opened).toMatchObject({
        confirmType: 'function',
        openCount: 1,
        settleCount: 0,
        dialogVisible: true,
        lastAction: 'opening',
        lastTrigger: 'user-tap',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466 main confirm title',
        lastReturnedPromise: true,
      })

      expect(flow.cancelled).toMatchObject({
        confirmType: 'function',
        openCount: 1,
        settleCount: 1,
        dialogVisible: false,
        lastAction: 'cancelled',
        lastTrigger: 'user-tap',
        lastError: '{"trigger":"cancel"}',
        lastPayload: '{"trigger":"cancel"}',
        lastTitle: 'issue-466 main confirm title',
        lastReturnedPromise: true,
      })

      expect(flow.reopened).toMatchObject({
        confirmType: 'function',
        openCount: 2,
        settleCount: 1,
        dialogVisible: true,
        lastAction: 'opening',
        lastTrigger: 'e2e',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466 main confirm title',
        lastReturnedPromise: true,
      })

      expect(flow.confirmed).toMatchObject({
        confirmType: 'function',
        openCount: 2,
        settleCount: 2,
        dialogVisible: false,
        lastAction: 'confirmed',
        lastTrigger: 'e2e',
        lastError: '',
        lastTitle: 'issue-466 main confirm title',
        lastReturnedPromise: true,
      })
    }
    finally {
      collector?.dispose()
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #466: keeps imported tdesign Dialog methods callable in DevTools runtime', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const route = '/subpackages/issue-466/index'
    let collector: ReturnType<typeof attachRuntimeErrorCollector> | null = null

    try {
      const page = await navigateToIssue466Page(
        miniProgram,
        route,
        '#issue466-subpackage-page',
        '466-subpackage',
      )
      if (!page) {
        throw new Error('Failed to launch issue-466 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      collector = attachRuntimeErrorCollector(activeMiniProgram)

      await page.waitFor(600)
      await waitForIssue466Runtime(activeMiniProgram, route, page)

      const marker = collector.mark()
      const flow = await callRoutePageMethodWithOptions<Record<string, any>>(
        activeMiniProgram,
        route,
        '_runAllDialogMethodsE2E',
        ISSUE466_FLOW_CALL_OPTIONS,
      )
      expect(collector.getSince(marker)).toEqual([])

      expect(flow.reset).toMatchObject({
        alertType: 'function',
        confirmType: 'function',
        actionType: 'function',
        closeType: 'function',
        openCount: 0,
        settleCount: 0,
        alertCount: 0,
        confirmCount: 0,
        actionCount: 0,
        closeCount: 0,
        dialogVisible: false,
        lastMethod: 'idle',
        lastAction: 'idle',
        lastError: '',
        lastPayload: '',
        lastReturnedPromise: false,
      })

      expect(flow.alertOpened).toMatchObject({
        alertType: 'function',
        openCount: 1,
        settleCount: 0,
        alertCount: 1,
        dialogVisible: true,
        lastMethod: 'alert',
        lastAction: 'opening',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466 alert title',
        lastReturnedPromise: true,
      })

      expect(flow.alertConfirmed).toMatchObject({
        alertType: 'function',
        openCount: 1,
        settleCount: 1,
        alertCount: 1,
        dialogVisible: false,
        lastMethod: 'alert',
        lastAction: 'alert-confirmed',
        lastError: '',
        lastPayload: '{"trigger":"confirm"}',
        lastTitle: 'issue-466 alert title',
        lastReturnedPromise: true,
      })

      expect(flow.confirmOpened).toMatchObject({
        confirmType: 'function',
        openCount: 2,
        settleCount: 1,
        confirmCount: 1,
        dialogVisible: true,
        lastMethod: 'confirm',
        lastAction: 'opening',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466 confirm title',
        lastReturnedPromise: true,
      })

      expect(flow.cancelled).toMatchObject({
        confirmType: 'function',
        openCount: 2,
        settleCount: 2,
        confirmCount: 1,
        dialogVisible: false,
        lastMethod: 'confirm',
        lastAction: 'cancelled',
        lastError: '{"trigger":"cancel"}',
        lastPayload: '{"trigger":"cancel"}',
        lastTitle: 'issue-466 confirm title',
        lastReturnedPromise: true,
      })

      expect(flow.actionOpened).toMatchObject({
        actionType: 'function',
        openCount: 3,
        settleCount: 2,
        actionCount: 1,
        dialogVisible: true,
        lastMethod: 'action',
        lastAction: 'opening',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466 action title',
        lastReturnedPromise: true,
      })

      expect(flow.selected).toMatchObject({
        actionType: 'function',
        openCount: 3,
        settleCount: 3,
        actionCount: 1,
        dialogVisible: false,
        lastMethod: 'action',
        lastAction: 'action-selected',
        lastError: '',
        lastPayload: '{"index":1}',
        lastTitle: 'issue-466 action title',
        lastReturnedPromise: true,
      })

      expect(flow.closePrepared).toMatchObject({
        closeType: 'function',
        openCount: 4,
        settleCount: 3,
        closeCount: 0,
        dialogVisible: true,
        lastMethod: 'close',
        lastAction: 'close-prepared',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466 close title',
        lastReturnedPromise: false,
      })

      expect(flow.closed).toMatchObject({
        closeType: 'function',
        openCount: 4,
        settleCount: 4,
        closeCount: 1,
        dialogVisible: false,
        lastMethod: 'close',
        lastAction: 'closed',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466 close title',
        lastReturnedPromise: true,
      })
    }
    finally {
      collector?.dispose()
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #466: keeps native aliased tdesign Dialog.confirm callable in DevTools runtime', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const route = '/subpackages/issue-466/native/index'
    let collector: ReturnType<typeof attachRuntimeErrorCollector> | null = null

    try {
      const page = await navigateToIssue466Page(
        miniProgram,
        route,
        '#issue466-native-page',
        '466-native',
      )
      if (!page) {
        throw new Error('Failed to launch issue-466 native page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      collector = attachRuntimeErrorCollector(activeMiniProgram)

      await page.waitFor(600)
      await waitForIssue466NativeRuntime(activeMiniProgram, route, page)

      const marker = collector.mark()
      const flow = await callRoutePageMethodWithOptions<Record<string, any>>(
        activeMiniProgram,
        route,
        '_runNativeDialogFlowE2E',
        ISSUE466_FLOW_CALL_OPTIONS,
      )
      expect(collector.getSince(marker)).toEqual([])

      expect(flow.reset).toMatchObject({
        confirmType: 'function',
        alertType: 'function',
        openCount: 0,
        settleCount: 0,
        dialogVisible: false,
        lastAction: 'idle',
        lastError: '',
        lastReturnedPromise: false,
      })

      expect(flow.opened).toMatchObject({
        confirmType: 'function',
        openCount: 1,
        settleCount: 0,
        dialogVisible: true,
        lastAction: 'opening',
        lastError: '',
        lastTitle: 'issue-466 native confirm title',
        lastReturnedPromise: true,
      })

      expect(flow.confirmed).toMatchObject({
        confirmType: 'function',
        openCount: 1,
        settleCount: 1,
        dialogVisible: false,
        lastAction: 'confirmed',
        lastError: '',
        lastTitle: 'issue-466 native confirm title',
        lastReturnedPromise: true,
      })
    }
    finally {
      collector?.dispose()
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
