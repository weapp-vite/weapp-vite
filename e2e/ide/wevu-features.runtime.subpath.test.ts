import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './wevu-features.runtime.shared'

describe.sequential('e2e app: wevu-features / subpath', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('covers wevu subpath entries: router/store/api/fetch in one page scenario', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const subpathPage = await relaunchPage(miniProgram, '/pages/subpath-entries/index', 'wevu 子路径入口综合场景')
      if (!subpathPage) {
        throw new Error('Failed to launch subpath-entries page')
      }

      const beforeWxml = await readPageWxml(subpathPage)
      expect(beforeWxml).toContain('router fullPath = pending')
      expect(beforeWxml).toContain('api status = pending')
      expect(beforeWxml).toContain('fetch status = pending')
      expect(beforeWxml).toContain('run summary = idle')

      const subpathResult = await subpathPage.callMethod('runE2E')
      expect(subpathResult?.ok, JSON.stringify(subpathResult)).toBe(true)
      expect(subpathResult?.checks?.routerResolved).toBe(true)
      expect(subpathResult?.checks?.storeUpdated).toBe(true)
      expect(subpathResult?.checks?.storePluginTouched).toBe(true)
      expect(subpathResult?.checks?.localApiSupports).toBe(true)
      expect(subpathResult?.checks?.localApiResolved).toBe(true)
      expect(subpathResult?.checks?.fetchStatusOk).toBe(true)
      expect(subpathResult?.checks?.fetchPayloadOk).toBe(true)
      expect(subpathResult?.checks?.fetchRequestCountOk).toBe(true)
      expect(subpathResult?.checks?.fetchBodyEchoOk).toBe(true)
      expect(subpathResult?.details?.routerFullPath).toBe('/pages/router-stability/target/index?from=subpath-entry&step=1')
      expect(subpathResult?.details?.apiStatus).toContain('request|supported')
      expect(subpathResult?.details?.fetchStatus).toContain('200|adapter')
      expect(subpathResult?.details?.fetchPayload).toContain('subpath-adapter')
      expect(subpathResult?.details?.requestCount).toBe(1)
      expect(subpathResult?.details?.runSummary).toBe('ok')

      const afterWxml = await readPageWxml(subpathPage)
      expect(afterWxml).toContain('router fullPath = /pages/router-stability/target/index?from=subpath-entry&amp;step=1')
      expect(afterWxml).toContain('store count/label = 1 / subpath-ready')
      expect(afterWxml).toContain('api status = request|supported')
      expect(afterWxml).toContain('fetch status = 200|adapter')
      expect(afterWxml).toContain('request count = 1')
      expect(afterWxml).toContain('run summary = ok')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
