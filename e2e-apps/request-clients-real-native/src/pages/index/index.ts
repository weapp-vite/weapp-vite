interface RequestGlobalsProbe {
  fetchType: string
  urlName: string
  xmlHttpRequestName: string
  webSocketName: string
}

interface IndexCard {
  title: string
  route: string
  desc: string
}

const pages: IndexCard[] = [
  {
    title: 'fetch',
    route: '/pages/fetch/index',
    desc: '原生 fetch + request globals 实际请求',
  },
  {
    title: 'axios',
    route: '/pages/axios/index',
    desc: 'axios 在纯原生页面中访问本地服务',
  },
  {
    title: 'graphql-request',
    route: '/pages/graphql-request/index',
    desc: 'graphql-request 访问本地 GraphQL endpoint',
  },
  {
    title: 'socket.io-client',
    route: '/pages/socket-io/index',
    desc: 'socket.io-client 验证 polling / websocket 链路',
  },
  {
    title: 'native WebSocket',
    route: '/pages/websocket/index',
    desc: '原生 WebSocket 连接真实 ws 服务',
  },
]

Page({
  data: {
    appProbe: {
      fetchType: '',
      urlName: '',
      xmlHttpRequestName: '',
      webSocketName: '',
    } as RequestGlobalsProbe,
    pages,
  },
  onReady() {
    const app = getApp<{ globalData?: { requestGlobalsProbe?: RequestGlobalsProbe } }>()
    this.setData({
      appProbe: app?.globalData?.requestGlobalsProbe ?? this.data.appProbe,
    })
  },
  runE2E() {
    const app = getApp<{ globalData?: { requestGlobalsProbe?: RequestGlobalsProbe } }>()
    const appProbe = app?.globalData?.requestGlobalsProbe ?? this.data.appProbe
    this.setData({
      appProbe,
    })
    return {
      appProbe,
      ok: appProbe.fetchType === 'function'
        && appProbe.urlName === 'URL'
        && appProbe.xmlHttpRequestName === 'XMLHttpRequest'
        && appProbe.webSocketName === 'WebSocket',
    }
  },
})
