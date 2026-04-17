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

  throw new Error(`Timed out waiting for issue-466 runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
}

describe.sequential('github-issues runtime issue-466', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #466: keeps imported tdesign Dialog.confirm callable in DevTools runtime', async (ctx) => {
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
        confirmType: 'function',
        openCount: 0,
        settleCount: 0,
        dialogVisible: false,
        lastAction: 'idle',
        lastError: '',
        lastReturnedPromise: false,
      })

      const openMarker = collector.mark()
      const opened = await page.callMethod('_openDialogE2E')
      expect(opened).toMatchObject({
        confirmType: 'function',
        openCount: 1,
        settleCount: 0,
        dialogVisible: true,
        lastAction: 'opening',
        lastError: '',
        lastTitle: 'issue-466 confirm title',
        lastReturnedPromise: true,
      })
      expect(collector.getSince(openMarker)).toEqual([])

      const closeMarker = collector.mark()
      const confirmed = await page.callMethod('_confirmDialogE2E')
      expect(confirmed).toMatchObject({
        confirmType: 'function',
        openCount: 1,
        settleCount: 1,
        dialogVisible: false,
        lastAction: 'confirmed',
        lastError: '',
        lastTitle: 'issue-466 confirm title',
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
