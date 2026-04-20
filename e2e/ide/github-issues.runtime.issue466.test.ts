import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'
import { attachRuntimeErrorCollector } from './runtimeErrors'

async function waitForIssue466Runtime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await page.callMethod('_runE2E')
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

describe.sequential('github-issues runtime issue-466', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #466: keeps imported tdesign Dialog methods callable in DevTools runtime', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      const page = await miniProgram.reLaunch('/subpackages/issue-466/index')
      if (!page) {
        throw new Error('Failed to launch issue-466 page')
      }
      await page.waitFor(600)
      await waitForIssue466Runtime(page)

      expect(await page.callMethod('_resetE2E')).toMatchObject({
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

      const alertOpenMarker = collector.mark()
      const alertOpened = await page.callMethod('_openAlertE2E')
      expect(alertOpened).toMatchObject({
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
      expect(collector.getSince(alertOpenMarker)).toEqual([])

      const alertConfirmMarker = collector.mark()
      const alertConfirmed = await page.callMethod('_confirmDialogE2E')
      expect(alertConfirmed).toMatchObject({
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
      expect(collector.getSince(alertConfirmMarker)).toEqual([])

      const confirmOpenMarker = collector.mark()
      const confirmOpened = await page.callMethod('_openDialogE2E')
      expect(confirmOpened).toMatchObject({
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
      expect(collector.getSince(confirmOpenMarker)).toEqual([])

      const confirmCancelMarker = collector.mark()
      const cancelled = await page.callMethod('_cancelDialogE2E')
      expect(cancelled).toMatchObject({
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
      expect(collector.getSince(confirmCancelMarker)).toEqual([])

      const actionOpenMarker = collector.mark()
      const actionOpened = await page.callMethod('_openActionE2E')
      expect(actionOpened).toMatchObject({
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
      expect(collector.getSince(actionOpenMarker)).toEqual([])

      const actionSelectMarker = collector.mark()
      const selected = await page.callMethod('_selectSecondActionE2E')
      expect(selected).toMatchObject({
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
      expect(collector.getSince(actionSelectMarker)).toEqual([])

      const closePrepareMarker = collector.mark()
      const closePrepared = await page.callMethod('_prepareCloseHostE2E')
      expect(closePrepared).toMatchObject({
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
      expect(collector.getSince(closePrepareMarker)).toEqual([])

      const closeMarker = collector.mark()
      const closed = await page.callMethod('_closeDialogE2E')
      expect(closed).toMatchObject({
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
      expect(collector.getSince(closeMarker)).toEqual([])
    }
    finally {
      collector.dispose()
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
