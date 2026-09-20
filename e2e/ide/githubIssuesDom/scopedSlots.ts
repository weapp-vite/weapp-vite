import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

export const ISSUE642: DomCheckpoint[] = [1, 2].map(base => ({
  id: base === 1 ? 'initial' : 'updated',
  route: '/pages/issue-642/index',
  action: base === 1 ? '检查大批量动态 props 后三种插槽的首屏结果' : '点击 bump 后检查 props 首尾值和插槽内容保留',
  nodes: [
    text('.issue642-action', `bump ${base}`),
    text('.issue642-provided-header', 'issue-642 provided header'),
    text('.issue642-provided-default', 'issue-642 provided default'),
    text('.issue642-fallback-header', 'issue-642 fallback header', ['#issue642-empty']),
    text('.issue642-fallback-default', 'issue-642 fallback default', ['#issue642-empty']),
    { selector: '.issue642-fallback-header', scope: ['#issue642-provided'], count: 0 },
    { selector: '.issue642-fallback-default', scope: ['#issue642-provided'], count: 0 },
    text('.issue642-scoped-provided', '1234', ['#issue642-scoped', { has: '.issue642-scoped-provided' }]),
    ...['#issue642-empty', '#issue642-provided'].flatMap(host => [
      text('.issue642-props-first', `p0: ${base}`, [host]),
      text('.issue642-props-last', `p419: ${base + 419}`, [host]),
    ]),
  ],
}))

export const ISSUE642_BUG7: DomCheckpoint[] = [0, 1].map(tick => ({
  id: tick === 0 ? 'initial' : 'updated',
  route: '/pages/issue-642-bug7/index',
  action: tick === 0 ? '检查 scoped 和 default 插槽首屏' : '更新 owner 后检查插槽内容未丢失',
  nodes: [
    text('.issue642-bug7-action', `bump ${tick}`),
    text('#issue642-bug7-scoped', '1', ['#issue642-bug7-cell1', { has: '#issue642-bug7-scoped' }]),
    text('#issue642-bug7-provided', '1234'),
    { selector: '#issue642-bug7-fallback', scope: ['#issue642-bug7-cell2'], count: 0 },
  ],
}))

export const ISSUE642_BUG8: DomCheckpoint[] = [{
  id: 'initial',
  route: '/pages/issue-642-bug8/index',
  action: '检查直接和经过 Wrap 的两种 scoped-slot 投影',
  nodes: [
    text('#issue642-bug8-direct', '123', ['#issue642-bug8-direct-cell', { has: '#issue642-bug8-direct' }]),
    text('#issue642-bug8-wrapped', '123', ['#issue642-bug8-wrap', '#issue642-bug8-wrapped-cell', { has: '#issue642-bug8-wrapped' }]),
  ],
}]
