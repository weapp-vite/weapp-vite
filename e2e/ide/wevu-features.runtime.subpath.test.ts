import { afterAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
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

  it('covers wevu subpath entries: router/store/api/fetch in one page scenario', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/wevu-features', [
      { id: 'subpath:initial', route: SUBPATH_ROUTE, action: '检查子路径页面初始结果', nodes: [
        { selector: '.subpath-entries-page__title', text: SUBPATH_READY_TEXT },
        { selector: '#subpath-store-summary', text: 'store count/label = 0 / init' },
        { selector: '#subpath-request-count', text: 'request count = 0' },
        { selector: '#subpath-run-summary', text: 'run summary = idle' },
      ] },
      { id: 'subpath:result', route: SUBPATH_ROUTE, action: '执行 router/store/api/fetch 后检查界面结果', nodes: [
        { selector: '#subpath-router-fullpath', text: 'router fullPath = /pages/router-stability/target/index?from=subpath-entry&step=1' },
        { selector: '#subpath-store-summary', text: 'store count/label = 1 / subpath-ready' },
        { selector: '#subpath-api-status', text: 'api status = request|supported' },
        { selector: '#subpath-fetch-status', text: 'fetch status = 200|adapter' },
        { selector: '#subpath-fetch-payload', text: 'fetch payload = {"ok":true,"source":"subpath-adapter"}' },
        { selector: '#subpath-request-count', text: 'request count = 1' },
        { selector: '#subpath-request-echo', text: 'request body echo = {"stage":"e2e"}' },
        { selector: '#subpath-run-summary', text: 'run summary = ok' },
      ] },
    ])
    const miniProgram = await getSharedMiniProgram()

    try {
      const subpathPage = await relaunchPage(miniProgram, SUBPATH_ROUTE, SUBPATH_READY_TEXT)
      if (!subpathPage) {
        throw new Error('Failed to launch subpath-entries page')
      }

      await dom.check('subpath:initial', miniProgram, subpathPage)
      const subpathResult = await callRoutePageMethod(miniProgram, subpathPage, SUBPATH_ROUTE, 'runE2E')
      await dom.check('subpath:result', miniProgram, subpathPage)
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
