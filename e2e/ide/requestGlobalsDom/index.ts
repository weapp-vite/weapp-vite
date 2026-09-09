import type { DomCheckpoint } from '../../utils/domAcceptance/types'

export const GLOBALS_CHECKPOINTS: DomCheckpoint[] = [{
  id: 'globals',
  route: '/pages/request-globals/index',
  action: 'launch navigation and read runtime global probe',
  nodes: [
    { selector: '.hero-title', text: 'Request Globals 验证导航' },
    { selector: 'navigator', count: 3 },
    ...['fetch', 'graphql-request', 'axios'].flatMap(client => [
      { selector: `#entry-${client} .card-title`, text: client },
      { selector: `#entry-${client}`, attributes: { url: `/pages/request-globals/${client}` } },
    ]),
    { selector: '#globals-fetch', text: 'function' },
    { selector: '#globals-url', text: 'https:' },
    { selector: '#globals-websocket', text: 'function' },
    { selector: '#globals-xhr', text: 'function' },
  ],
}]

const requests = [
  { client: 'fetch', trace: 'POST https://request-globals.invalid/fetch timeout=3500 enableHttp2=true' },
  { client: 'graphql-request', trace: 'POST https://request-globals.invalid/graphql timeout=4800 enableChunked=true' },
  { client: 'axios', trace: 'GET https://request-globals.invalid/axios timeout=4200 enableHttp2=true' },
]

export const REQUEST_CHECKPOINTS: DomCheckpoint[] = requests.flatMap(({ client, trace }) =>
  [1, 2].map(run => ({
    id: `${client}-${run}`,
    route: `/pages/request-globals/${client}`,
    action: run === 1 ? 'onLoad request' : 'tap rerun request',
    nodes: [
      { selector: '.hero-title', text: `${client} 验证` },
      { selector: '#request-page-status', text: '全部通过' },
      { selector: '#request-status', text: 'success' },
      { selector: '#request-run-count', text: String(run) },
      { selector: '#response-client', text: client },
      { selector: '#response-source', text: 'request-globals' },
      { selector: '#request-log', text: JSON.stringify([trace]) },
    ],
  })),
)
