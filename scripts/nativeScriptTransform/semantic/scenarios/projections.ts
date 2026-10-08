import type { Options, ScenarioHost, Values } from './host'

export const wevuProjectionAssertions = ['class-array-shadowing', 'class-object', 'class-numeric', 'class-null-item', 'class-source-error', 'class-source-error-log']
export const retailProjectionAssertions = ['guard-no-evaluation', 'projection-array-values', 'projection-array-identity', 'projection-object', 'projection-conflict-warning', 'projection-key-error', 'projection-key-error-log', 'projection-source-error', 'projection-source-error-log']

export function observeWevuProjections(host: ScenarioHost, options: Options) {
  const fn = options.computed.__wv_cls_0!
  const ctx: Values = {
    $state: { filterList: true, activeCategory: 'base' },
    __wevuProps: { filterList: [{ key: 'wrong-props' }], activeCategory: 'wrong-props' },
    filterList: [{ key: 'base' }, { key: 'device' }],
    activeCategory: 'base',
    filter: { key: 'wrong-context-alias' },
  }
  host.check('class-array-shadowing', fn.call(ctx), ['filter active', 'filter'])
  ctx.filterList = { first: { key: 'device' }, second: { key: 'base' } }
  host.check('class-object', fn.call(ctx), { first: 'filter', second: 'filter active' })
  ctx.filterList = 3.8
  host.check('class-numeric', fn.call(ctx), ['filter', 'filter', 'filter'])
  ctx.filterList = [null, { key: 'base' }]
  host.check('class-null-item', fn.call(ctx), ['filter', 'filter active'])
  const before = host.logs.length
  Object.defineProperty(ctx, 'filterList', { get() {
    throw new Error('controlled loop source failure')
  } })
  host.check('class-source-error', fn.call(ctx), [])
  host.check('class-source-error-log', host.logs.slice(before), [{ channel: 'error', arguments: ['[wevu] 模板 v-for 数据源表达式执行失败: filterList', new Error('controlled loop source failure')] }])
}

export function observeRetailProjections(host: ScenarioHost, options: Options) {
  const fn = options.computed.__wv_bind_0!
  let reads = 0
  const off = { commentsStatistics: { commentCount: 0 }, get commentsList() {
    reads++
    throw new Error('guard evaluated forbidden source')
  } }
  const disabled = fn.call(off)
  host.check('guard-no-evaluation', { value: disabled, reads }, { value: undefined, reads: 0 })
  const row = { goodsSpu: 'row-a', title: 'source item' }
  const ctx: Values = {
    commentsStatistics: { commentCount: 1 },
    commentsList: [row, null, 4],
    commentItem: { goodsSpu: 'wrong-alias' },
    $state: { commentsList: true, commentsStatistics: { commentCount: 1 } },
    __wevuProps: { commentsList: [{ goodsSpu: 'wrong-props' }], commentsStatistics: { commentCount: 0 } },
  }
  const projected = fn.call(ctx) as Values[]
  host.check('projection-array-values', projected.map(item => item.__wv_key_0), ['row-a', undefined, 2])
  host.check('projection-array-identity', projected[0]!.__wv_value_0 === row, true)
  ctx.commentsList = { left: row, right: { goodsSpu: '' } }
  const object = fn.call(ctx) as Values
  host.check('projection-object', { keys: Object.keys(object), ids: [object.left.__wv_key_0, object.right.__wv_key_0], same: object.left.__wv_value_0 === row }, { keys: ['left', 'right'], ids: ['row-a', 'right'], same: true })
  const conflict = { goodsSpu: 'conflict', __wv_key_0: 'reserved-value' }
  ctx.commentsList = [conflict]
  const warnings = host.logs.length
  const collision = fn.call(ctx) as Values[]
  host.check('projection-conflict-warning', { key: collision[0]!.__wv_key_0, same: collision[0]!.__wv_value_0 === conflict, logs: host.logs.slice(warnings) }, { key: 'conflict', same: true, logs: [{ channel: 'warn', arguments: ['[wevu] v-for :key 内部字段冲突，投影将使用保留字段 __wv_key_0 / __wv_value_0', conflict] }] })
  const broken = Object.create({ get goodsSpu() {
    throw new Error('controlled key failure')
  } }) as Values
  ctx.commentsList = [broken]
  const keyErrors = host.logs.length
  const badKey = fn.call(ctx) as Values[]
  host.check('projection-key-error', { key: badKey[0]!.__wv_key_0, same: badKey[0]!.__wv_value_0 === broken }, { key: undefined, same: true })
  host.check('projection-key-error-log', host.logs.slice(keyErrors), [{ channel: 'error', arguments: ['[wevu] v-for :key 表达式执行失败: commentItem.goodsSpu || index', new Error('controlled key failure')] }])
  const sourceErrors = host.logs.length
  Object.defineProperty(ctx, 'commentsList', { get() {
    throw new Error('controlled projection source failure')
  } })
  host.check('projection-source-error', fn.call(ctx), undefined)
  host.check('projection-source-error-log', host.logs.slice(sourceErrors), [{ channel: 'error', arguments: ['[wevu] 模板运行时表达式执行失败: __wv_bind_0 = v-for :key commentItem.goodsSpu || index', new Error('controlled projection source failure')] }])
}
