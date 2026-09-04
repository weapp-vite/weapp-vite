import { afterAll, describe, expect, it } from 'vitest'
import {
  callRoutePageMethod,
  closeSharedMiniProgram,
  getSharedMiniProgram,
  relaunchPage,
  releaseSharedMiniProgram,
} from './wevu-features.runtime.shared'

const SUBPATH_ROUTE = '/pages/subpath-entries/index'
const SUBPATH_READY_TEXT = 'wevu 子路径入口综合场景'

describe('e2e app: wevu-features / subpath', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('covers wevu subpath entries: router/store/api/fetch in one page scenario', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const subpathPage = await relaunchPage(miniProgram, SUBPATH_ROUTE, SUBPATH_READY_TEXT)
      if (!subpathPage) {
        throw new Error('Failed to launch subpath-entries page')
      }

      const subpathResult = await callRoutePageMethod(miniProgram, subpathPage, SUBPATH_ROUTE, 'runE2E')
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
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
