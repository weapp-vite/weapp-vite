import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  relaunchPage,
  releaseSharedMiniProgram,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'
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
  return await page.callMethod(methodName)
}

async function waitForComputedProbeState(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
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

  throw new Error(`Timed out waiting for miniprogram-computed runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
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

describe.sequential('github-issues runtime miniprogram-computed', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('keeps build-npm cjs package miniprogram-computed working in DevTools runtime', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const collector = attachRuntimeErrorCollector(miniProgram)

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
    }
    finally {
      collector.dispose()
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
