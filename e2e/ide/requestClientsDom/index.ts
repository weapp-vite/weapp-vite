import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'

function line(selector: string, text: string): DomNodeExpectation {
  return { selector, text: text.trim() }
}

const transports = {
  'fetch': { prefix: 'fetch', title: 'fetch transport', path: '/fetch', client: 'fetch', transport: 'fetch', method: 'POST', operationName: '', event: '', httpStatus: 200 },
  'axios': { prefix: 'axios', title: 'axios transport', path: '/axios', client: 'axios', transport: 'axios', method: 'POST', operationName: '', event: '', httpStatus: 200 },
  'graphql-request': { prefix: 'graphql', title: 'graphql-request transport', path: '/graphql', client: 'graphql-request', transport: '', method: '', operationName: 'TransportProbe', event: '', httpStatus: 200 },
  'socket-io': { prefix: 'socket', title: 'socket.io-client transport', path: '/socket.io', client: 'socket.io-client', transport: 'websocket', method: '', operationName: '', event: 'server-random', httpStatus: 101 },
  'websocket': { prefix: 'websocket', title: 'native WebSocket transport', path: '/ws', client: 'native-websocket', transport: 'websocket', method: '', operationName: '', event: 'server-random', httpStatus: 101 },
} as const

export function requestCheckpoints(transport: keyof typeof transports, autoStart = false): DomCheckpoint[] {
  const expected = transports[transport]
  return [false, true].map((completed) => {
    const ready = autoStart || completed
    const runs = Number(autoStart) + Number(completed)
    const nodes: DomNodeExpectation[] = [
      line('.hero-title', expected.title),
      line(`#${expected.prefix}-page-status`, `pageStatus = ${ready ? '全部通过' : '待执行'}`),
      line(`#${expected.prefix}-status`, `status = ${ready ? 'success' : 'idle'}`),
      line(`#${expected.prefix}-run-count`, `runCount = ${runs}`),
      line(`#${expected.prefix}-http-status`, `httpStatus = ${ready ? expected.httpStatus : 0}`),
      line(`#${expected.prefix}-request-path`, `requestPath = ${ready ? expected.path : ''}`),
      ...(['client', 'transport', 'method', 'operationName', 'event'] as const).map(key =>
        line(`#${expected.prefix}-response-${key}`, `${key} = ${ready ? expected[key] : ''}`)),
      { selector: '.error', count: 0 },
    ]
    if (expected.httpStatus === 200) {
      nodes.push(line(`#${expected.prefix}-request-count`, `requestCount = ${runs}`))
    }
    if (transport === 'socket-io') {
      nodes.push(line('#socket-websocket-transport', `websocketOnlyTransport = ${ready ? 'websocket' : ''}`))
      nodes.push(line('#socket-default-supported', `defaultTransportSupported = ${ready}`))
      nodes.push(line('#socket-random-received', `serverRandomReceived = ${ready}`))
      nodes.push(line('#socket-websocket-connected', `websocketOnlyConnected = ${ready}`))
    }
    if (transport === 'websocket') {
      nodes.push(line('#websocket-connected-ready-state', `connectedReadyState = ${ready ? 1 : -1}`))
      nodes.push(line('#websocket-final-ready-state', `finalReadyState = ${ready ? 3 : -1}`))
      nodes.push(line('#websocket-echo-stage', `echoStage = ${ready ? 'echo' : ''}`))
      nodes.push(line('#websocket-echo-run', `echoRun = ${ready ? runs : 0}`))
    }
    return { id: completed ? 'completed' : 'initial', route: `/pages/${transport}/index`, action: completed ? '执行真实请求后检查响应字段和页面结果' : autoStart ? '检查首屏自动请求完成后的响应内容' : '检查请求前首屏状态和空响应', nodes }
  })
}

export function globalsCheckpoints(native: boolean): DomCheckpoint[] {
  return ['initial', 'refreshed'].map(id => ({
    id,
    route: '/pages/index/index',
    action: id === 'initial' ? '首屏显示真实 globals 探针值' : '重新执行探针后检查显示值',
    nodes: [
      line('.hero-title', native ? 'Request Clients Real Native E2E' : 'Request Clients Real E2E'),
      line('#globals-fetch', 'fetchType = function'),
      line('#globals-url', 'urlAvailable = true'),
      line('#globals-xhr', 'xmlHttpRequestAvailable = true'),
      line('#globals-websocket', 'webSocketAvailable = true'),
      { selector: '.card-route', count: native ? 5 : 6 },
    ],
  }))
}

export const QUERY_CHECKPOINTS: DomCheckpoint[] = [
  { id: 'initial', tab: 'overview', seed: 0, count: 0, refetches: 0, ready: false },
  { id: 'overview', tab: 'overview', seed: 0, count: 1, refetches: 0, ready: true },
  { id: 'detail', tab: 'detail', seed: 0, count: 2, refetches: 0, ready: true },
  { id: 'refetched', tab: 'detail', seed: 0, count: 3, refetches: 1, ready: true },
  { id: 'rotated', tab: 'detail', seed: 1, count: 4, refetches: 1, ready: true },
].map(expected => ({
  id: expected.id,
  route: '/pages/vue-query/index',
  action: `检查 Vue Query ${expected.id} 阶段的状态、响应和 key`,
  nodes: [
    line('.hero-title', 'vue-query transport'),
    line('#vue-query-status', `status = ${expected.ready ? '数据就绪' : '加载中'}`),
    line('#vue-query-selected-tab', `selectedTab = ${expected.tab}`),
    line('#vue-query-refresh-seed', `refreshSeed = ${expected.seed}`),
    line('#vue-query-key', `queryKey = ${JSON.stringify(['request-clients-real', expected.tab, expected.seed])}`),
    line('#vue-query-request-count', `requestCount = ${expected.count}`),
    line('#vue-query-refetch-count', `refetchCount = ${expected.refetches}`),
    line('#vue-query-label', `label = ${expected.ready ? expected.tab === 'overview' ? 'Overview Data' : 'Detail Data' : '--'}`),
    line('#vue-query-payload-tab', `tab = ${expected.ready ? expected.tab : '--'}`),
    line('#vue-query-payload-seed', `seed = ${expected.ready ? expected.seed : -1}`),
    line('#vue-query-pending', `isPending = ${!expected.ready}`),
    line('#vue-query-fetching', 'isFetching = false'),
    line('#vue-query-success', `isSuccess = ${expected.ready}`),
  ],
}))
