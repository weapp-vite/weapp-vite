import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
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
import { allDialogSteps, dialogCheckpoints } from './githubIssuesDom/dialogs'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const ROUTE = '/subpackages/issue-466-computed/index'

async function getComputedPage(miniProgram: any, timeoutMs = 12_000) {
  return await waitForCurrentPagePath(miniProgram, ROUTE, timeoutMs)
}

async function callCurrentComputedPageMethod(miniProgram: any, methodName: string) {
  const page = await getComputedPage(miniProgram)
  if (!page) {
    throw new Error(`Failed to resolve current computed page before calling ${methodName}`)
  }
  return await callRoutePageMethodWithOptions<Record<string, any>>(
    miniProgram,
    ROUTE,
    methodName,
    {
      protocolTimeoutMs: 12_000,
      recoveryAttempts: 1,
      retries: 1,
    },
  )
}

async function waitForComputedProbeState(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastError: unknown
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callCurrentComputedPageMethod(miniProgram, '_runE2E')
      lastRuntime = runtime
      if (
        runtime?.probe?.sum === 3
        && runtime?.probe?.summary === '1+2=3'
      ) {
        return runtime
      }
    }
    catch (error) {
      lastError = error
    }

    try {
      const page = await getComputedPage(miniProgram, 3_000)
      if (!page) {
        continue
      }
      await page.waitFor(220)
    }
    catch {
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError ?? '')
  throw new Error(`Timed out waiting for miniprogram-computed runtime: ${JSON.stringify(lastRuntime, null, 2)}; last error: ${errorMessage || '<none>'}`)
}

async function waitForUpdatedComputedProbeState(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callCurrentComputedPageMethod(miniProgram, '_runE2E')
      lastRuntime = runtime
      if (
        runtime?.probe?.sum === 7
        && runtime?.probe?.summary === '3+4=7'
        && typeof runtime?.probe?.watchCount === 'number'
        && runtime.probe.watchCount >= 1
        && runtime?.probe?.lastWatch === '1:2->3:4'
      ) {
        return runtime
      }
    }
    catch {
    }

    try {
      const page = await getComputedPage(miniProgram, 3_000)
      if (!page) {
        continue
      }
      await page.waitFor(220)
    }
    catch {
    }
  }

  throw new Error(`Timed out waiting for updated miniprogram-computed runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
}

describe('github-issues runtime miniprogram-computed', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('keeps build-npm cjs package miniprogram-computed working in DevTools runtime', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [
      { id: 'initial', route: ROUTE, action: '首屏检查 computed sum 和 summary', nodes: [
        { selector: '#computed-sum', scope: ['#issue466-computed-probe'], text: 'sum = 3' },
        { selector: '#computed-summary', scope: ['#issue466-computed-probe'], text: 'summary = 1+2=3' },
      ] },
      { id: 'updated', route: ROUTE, action: '更新组件 props 后检查计算结果与 watch 轨迹', nodes: [
        { selector: '#computed-sum', scope: ['#issue466-computed-probe'], text: 'sum = 7' },
        { selector: '#computed-summary', scope: ['#issue466-computed-probe'], text: 'summary = 3+4=7' },
        { selector: '#computed-watch', scope: ['#issue466-computed-probe'], text: 'lastWatch = 1:2->3:4' },
      ] },
      ...dialogCheckpoints(ROUTE, '#issue466-computed-dialog', allDialogSteps(true), resolveRuntimeProviderName()),
    ])
    let miniProgram = await getSharedMiniProgram(ctx)
    let collector: ReturnType<typeof attachRuntimeErrorCollector> | undefined

    try {
      const page = await relaunchPage(
        miniProgram,
        ROUTE,
        undefined,
        20_000,
      )
      if (!page) {
        throw new Error('Failed to launch issue-466-computed page')
      }
      miniProgram = await getSharedMiniProgram(ctx)
      collector = attachRuntimeErrorCollector(miniProgram)

      const initialMarker = collector.mark()
      const initialRuntime = await waitForComputedProbeState(miniProgram)
      expect(initialRuntime).toMatchObject({
        pageData: {
          a: 1,
          b: 2,
        },
        probe: {
          a: 1,
          b: 2,
          sum: 3,
          summary: '1+2=3',
        },
      })
      expect(collector.getSince(initialMarker)).toEqual([])
      await dom.check('initial', miniProgram, page)

      await callCurrentComputedPageMethod(miniProgram, 'applyNextE2E')
      const updatedMarker = collector.mark()
      const updatedRuntime = await waitForUpdatedComputedProbeState(miniProgram)
      expect(updatedRuntime).toMatchObject({
        pageData: {
          a: 3,
          b: 4,
        },
        probe: {
          a: 3,
          b: 4,
          sum: 7,
          summary: '3+4=7',
          lastWatch: '1:2->3:4',
        },
      })
      expect(updatedRuntime.probe.watchCount).toBeGreaterThanOrEqual(1)
      expect(collector.getSince(updatedMarker)).toEqual([])
      await dom.check('updated', miniProgram, page)

      const dialogResetMarker = collector.mark()
      const dialogReset = await callCurrentComputedPageMethod(miniProgram, '_resetDialogE2E')
      expect(dialogReset.dialog).toMatchObject({
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
      expect(collector.getSince(dialogResetMarker)).toEqual([])
      await dom.check('reset', miniProgram, page)

      const alertOpenMarker = collector.mark()
      const alertOpened = await callCurrentComputedPageMethod(miniProgram, '_openAlertE2E')
      expect(alertOpened.dialog).toMatchObject({
        alertType: 'function',
        openCount: 1,
        settleCount: 0,
        alertCount: 1,
        dialogVisible: true,
        lastMethod: 'alert',
        lastAction: 'opening',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466-computed alert title',
        lastReturnedPromise: true,
      })
      expect(collector.getSince(alertOpenMarker)).toEqual([])
      await dom.check('alertOpened', miniProgram, page)

      const alertConfirmMarker = collector.mark()
      const alertConfirmed = await callCurrentComputedPageMethod(miniProgram, '_confirmDialogE2E')
      expect(alertConfirmed.dialog).toMatchObject({
        alertType: 'function',
        openCount: 1,
        settleCount: 1,
        alertCount: 1,
        dialogVisible: false,
        lastMethod: 'alert',
        lastAction: 'alert-confirmed',
        lastError: '',
        lastPayload: '{"trigger":"confirm"}',
        lastTitle: 'issue-466-computed alert title',
        lastReturnedPromise: true,
      })
      expect(collector.getSince(alertConfirmMarker)).toEqual([])
      await dom.check('alertConfirmed', miniProgram, page)

      const confirmOpenMarker = collector.mark()
      const confirmOpened = await callCurrentComputedPageMethod(miniProgram, '_openConfirmE2E')
      expect(confirmOpened.dialog).toMatchObject({
        confirmType: 'function',
        openCount: 2,
        settleCount: 1,
        confirmCount: 1,
        dialogVisible: true,
        lastMethod: 'confirm',
        lastAction: 'opening',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466-computed confirm title',
        lastReturnedPromise: true,
      })
      expect(collector.getSince(confirmOpenMarker)).toEqual([])
      await dom.check('confirmOpened', miniProgram, page)

      const confirmCancelMarker = collector.mark()
      const cancelled = await callCurrentComputedPageMethod(miniProgram, '_cancelDialogE2E')
      expect(cancelled.dialog).toMatchObject({
        confirmType: 'function',
        openCount: 2,
        settleCount: 2,
        confirmCount: 1,
        dialogVisible: false,
        lastMethod: 'confirm',
        lastAction: 'cancelled',
        lastError: '{"trigger":"cancel"}',
        lastPayload: '{"trigger":"cancel"}',
        lastTitle: 'issue-466-computed confirm title',
        lastReturnedPromise: true,
      })
      expect(collector.getSince(confirmCancelMarker)).toEqual([])
      await dom.check('cancelled', miniProgram, page)

      const actionOpenMarker = collector.mark()
      const actionOpened = await callCurrentComputedPageMethod(miniProgram, '_openActionE2E')
      expect(actionOpened.dialog).toMatchObject({
        actionType: 'function',
        openCount: 3,
        settleCount: 2,
        actionCount: 1,
        dialogVisible: true,
        lastMethod: 'action',
        lastAction: 'opening',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466-computed action title',
        lastReturnedPromise: true,
      })
      expect(collector.getSince(actionOpenMarker)).toEqual([])
      await dom.check('actionOpened', miniProgram, page)

      const actionSelectMarker = collector.mark()
      const selected = await callCurrentComputedPageMethod(miniProgram, '_selectSecondActionE2E')
      expect(selected.dialog).toMatchObject({
        actionType: 'function',
        openCount: 3,
        settleCount: 3,
        actionCount: 1,
        dialogVisible: false,
        lastMethod: 'action',
        lastAction: 'action-selected',
        lastError: '',
        lastPayload: '{"index":1}',
        lastTitle: 'issue-466-computed action title',
        lastReturnedPromise: true,
      })
      expect(collector.getSince(actionSelectMarker)).toEqual([])
      await dom.check('selected', miniProgram, page)

      const closePrepareMarker = collector.mark()
      const closePrepared = await callCurrentComputedPageMethod(miniProgram, '_prepareCloseHostE2E')
      expect(closePrepared.dialog).toMatchObject({
        closeType: 'function',
        openCount: 4,
        settleCount: 3,
        closeCount: 0,
        dialogVisible: true,
        lastMethod: 'close',
        lastAction: 'close-prepared',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466-computed close title',
        lastReturnedPromise: false,
      })
      expect(collector.getSince(closePrepareMarker)).toEqual([])
      await dom.check('closePrepared', miniProgram, page)

      const closeMarker = collector.mark()
      const closed = await callCurrentComputedPageMethod(miniProgram, '_closeDialogE2E')
      expect(closed.dialog).toMatchObject({
        closeType: 'function',
        openCount: 4,
        settleCount: 4,
        closeCount: 1,
        dialogVisible: false,
        lastMethod: 'close',
        lastAction: 'closed',
        lastError: '',
        lastPayload: '',
        lastTitle: 'issue-466-computed close title',
        lastReturnedPromise: true,
      })
      expect(collector.getSince(closeMarker)).toEqual([])
      await dom.check('closed', miniProgram, page)
    }
    finally {
      collector?.dispose()
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
