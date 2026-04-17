import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'
import { attachRuntimeErrorCollector } from './runtimeErrors'

async function waitForComputedProbeState(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await page.callMethod('_runE2E')
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
      await page.waitFor(220)
    }
    catch {
    }
  }

  throw new Error(`Timed out waiting for miniprogram-computed runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
}

async function waitForUpdatedComputedProbeState(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await page.callMethod('_runE2E')
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
      const page = await miniProgram.reLaunch('/subpackages/issue-466-computed/index')
      if (!page) {
        throw new Error('Failed to launch issue-466-computed page')
      }

      await page.waitFor(600)

      const initialMarker = collector.mark()
      const initialRuntime = await waitForComputedProbeState(page)
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

      await page.callMethod('applyNextE2E')
      const updatedMarker = collector.mark()
      const updatedRuntime = await waitForUpdatedComputedProbeState(page)
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
    }
    finally {
      collector.dispose()
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
