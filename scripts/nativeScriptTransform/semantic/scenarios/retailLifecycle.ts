import type { SemanticTools } from '../types'
import type { retailFixture } from './fixtures'
import type { ScenarioHost, Values } from './host'
import type { RetailServices } from './retailServices'

export const retailLifecycleAssertions = [
  'empty-load-no-requests',
  'load-request-order',
  'comments-before-detail',
  'statistics-before-detail',
  'detail-waits-for-activities',
  'detail-commit',
  'setup-computed-values',
  'comments-error-keeps-state',
  'comments-error-log',
  'statistics-error-keeps-state',
  'statistics-error-log',
  'detail-rejection',
  'detail-error-keeps-state',
]

export async function observeRetailLifecycle(host: ScenarioHost, tools: SemanticTools, services: RetailServices, ctx: Values, fixture: ReturnType<typeof retailFixture>) {
  const { queue } = services
  host.hooks.get('onLoad')!({})
  host.check('empty-load-no-requests', { calls: queue.calls, spuId: ctx.spuId }, { calls: [], spuId: '' })
  host.hooks.get('onLoad')!({ spuId: 'goods-semantic' })
  host.check('load-request-order', queue.calls, [
    { name: 'fetchGood', args: ['goods-semantic'] },
    { name: 'fetchActivityList', args: [] },
    { name: 'getGoodsDetailsCommentList', args: ['goods-semantic'] },
    { name: 'getGoodsDetailsCommentsCount', args: ['goods-semantic'] },
  ])
  await queue.resolve('getGoodsDetailsCommentList', fixture.comments)
  host.check('comments-before-detail', { names: ctx.commentsList.map((item: Values) => item.userName), content: ctx.commentsList[1].commentContent, anonymous: ctx.commentsList[1].userHeadUrl === ctx.anonymousAvatar, details: ctx.details }, { names: ['甲', ''], content: '用户未填写评价', anonymous: true, details: null })
  await queue.resolve('getGoodsDetailsCommentsCount', fixture.statistics)
  host.check('statistics-before-detail', { statistics: ctx.commentsStatistics, details: ctx.details }, { statistics: { badCount: 1, commentCount: 2, goodCount: 1, goodRate: 98.7, hasImageCount: 1, middleCount: 0 }, details: null })
  await queue.resolve('fetchGood', fixture.detail)
  host.check('detail-waits-for-activities', { details: ctx.details, pending: queue.names() }, { details: null, pending: ['fetchActivityList'] })
  await queue.resolve('fetchActivityList', fixture.activities)
  await tools.flush()
  host.check('detail-commit', host.pick(ctx, ['spuId', 'isStock', 'soldout', 'soldNum', 'minSalePrice', 'maxSalePrice', 'maxLinePrice', 'primaryImage', 'specImg']), { spuId: 'goods-semantic', isStock: true, soldout: false, soldNum: 23, minSalePrice: 1250, maxSalePrice: 1750, maxLinePrice: 1999, primaryImage: '/images/primary.png', specImg: '/images/primary.png' })
  host.check('setup-computed-values', {
    images: ctx.detailImages,
    description: ctx.detailDesc,
    title: ctx.detailTitle,
    intro: ctx.intro,
    primary: ctx.detailPrimaryImage,
    limit: ctx.detailLimitBuyInfo,
    specIds: ctx.detailSpecList.map((item: Values) => item.specId),
    visible: ctx.visibleActivityList.length,
    skus: ctx.skuArray.map((item: Values) => ({ id: item.skuId, price: item.price, image: item.skuImage })),
    promotions: ctx.list,
  }, {
    images: ['/images/front.png', '/images/back.png'],
    description: ['/images/description.png'],
    title: '语义商品',
    intro: '完整模块执行',
    primary: '/images/primary.png',
    limit: '限购5件',
    specIds: ['color'],
    visible: 4,
    skus: [{ id: 'sku-red', price: 1250, image: '/images/red.png' }, { id: 'sku-blue', price: 1750, image: '/images/primary.png' }],
    promotions: [{ tag: '满减', label: '满200减20' }, ...Array.from({ length: 4 }, () => ({ tag: '满折', label: '满100元减99.9元' }))],
  })
  const commentsBefore = tools.snapshot(ctx.commentsList)
  let logStart = host.logs.length
  const comments = ctx.getCommentsList('goods-error') as Promise<void>
  await queue.reject('getGoodsDetailsCommentList', 'controlled comments failure')
  await comments
  host.check('comments-error-keeps-state', tools.snapshot(ctx.commentsList), commentsBefore)
  host.check('comments-error-log', host.logs.slice(logStart), [{ channel: 'error', arguments: ['comments error:', new Error('controlled comments failure')] }])
  const statisticsBefore = tools.snapshot(ctx.commentsStatistics)
  logStart = host.logs.length
  const statistics = ctx.getCommentsStatistics('goods-error') as Promise<void>
  await queue.reject('getGoodsDetailsCommentsCount', 'controlled statistics failure')
  await statistics
  host.check('statistics-error-keeps-state', tools.snapshot(ctx.commentsStatistics), statisticsBefore)
  host.check('statistics-error-log', host.logs.slice(logStart), [{ channel: 'error', arguments: ['comments statistics error:', new Error('controlled statistics failure')] }])
  const detailBefore = tools.snapshot(host.pick(ctx, ['details', 'activityList', 'skuArray', 'minSalePrice']))
  const failedDetail = (ctx.getDetail('goods-error') as Promise<void>).then(() => 'unexpected-success', (error: unknown) => error)
  await queue.resolve('fetchActivityList', [])
  await queue.reject('fetchGood', 'controlled detail failure')
  host.check('detail-rejection', await failedDetail, new Error('controlled detail failure'))
  host.check('detail-error-keeps-state', tools.snapshot(host.pick(ctx, ['details', 'activityList', 'skuArray', 'minSalePrice'])), detailBefore)
}
