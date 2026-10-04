import type { SemanticTools } from '../types'
import type { ScenarioHost, Values } from './host'
import assert from 'node:assert/strict'
import { createDeferredCalls, strictObject } from './host'

export function createRetailServices(host: ScenarioHost, tools: SemanticTools) {
  const queue = createDeferredCalls(host, tools, ['fetchGood', 'fetchActivityList', 'getGoodsDetailsCommentList', 'getGoodsDetailsCommentsCount', 'navigateTo', 'switchTab'])
  const toasts: Values[] = []
  const idService = (name: string) => (id: string) => {
    assert(['goods-semantic', 'goods-error'].includes(id), `Unexpected service id ${id}`)
    return queue.invoke(name, [id])
  }
  const navigation = (name: string) => (payload: { url: string }) => {
    assert.deepEqual(Object.keys(payload), ['url'])
    assert.equal(typeof payload.url, 'string')
    assert(payload.url.startsWith('/pages/'))
    return queue.invoke(name, [payload])
  }
  return {
    queue,
    toasts,
    imports: {
      'wevu/api': { wpi: strictObject('wpi', { navigateTo: navigation('navigateTo'), switchTab: navigation('switchTab') }) },
      '@/hooks/useToast': { showToast(payload: Values) {
        assert.strictEqual(payload.context, host.nativeInstance)
        assert.deepEqual(Object.keys(payload).sort(), ['context', 'duration', 'icon', 'message'])
        assert(['请选择规格', '点击加入购物车'].includes(payload.message))
        assert.equal(payload.duration, 1000)
        assert.equal(payload.icon, '')
        const observed = { message: payload.message, icon: payload.icon, duration: payload.duration, nativeContextMatches: true }
        toasts.push(observed)
        host.record('showToast', observed)
      } },
      '../../../config/index': { cdnBase: 'https://semantic.invalid/assets' },
      '../../../services/activity/fetchActivityList': { fetchActivityList: () => queue.invoke('fetchActivityList', []) },
      '../../../services/good/fetchGood': { fetchGood: idService('fetchGood') },
      '../../../services/good/fetchGoodsDetailsComments': {
        getGoodsDetailsCommentList: idService('getGoodsDetailsCommentList'),
        getGoodsDetailsCommentsCount: idService('getGoodsDetailsCommentsCount'),
      },
    },
  }
}

export type RetailServices = ReturnType<typeof createRetailServices>
