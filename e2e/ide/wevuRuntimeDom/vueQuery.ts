import type { DomCheckpoint } from '../../utils/domAcceptance/types'

function queryCheckpoint(id: string, tab: string, seed: number, label: string, action: string): DomCheckpoint {
  return {
    id,
    route: '/pages/vue-query/index',
    action,
    nodes: [
      { selector: '#query-status', text: '数据就绪' },
      { selector: '#query-key', text: JSON.stringify(['demo-query', tab, seed]) },
      { selector: '#query-payload-label', text: label },
      { selector: '#query-payload-tab', text: tab },
      { selector: '#query-pending', text: 'false' },
      { selector: '#query-fetching', text: 'false' },
      { selector: '#query-success', text: 'true' },
      { selector: '.error-box', count: 0 },
      { selector: '.payload', count: 1 },
    ],
  }
}

export const VUE_QUERY_CHECKPOINTS = [
  queryCheckpoint('initial', 'overview', 0, '概览数据', '首屏查询完成后检查概览数据及响应式状态'),
  queryCheckpoint('detail', 'detail', 0, '详情数据', '点击详情 tab 后检查 key、payload 和查询状态'),
  queryCheckpoint('refreshed', 'detail', 1, '详情数据', '点击更换 queryKey 后检查新 key 对应的数据和状态'),
]
