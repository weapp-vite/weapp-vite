const requestGlobalsProbe = {
  fetchType: typeof fetch,
  urlName: URL.name,
  xmlHttpRequestName: XMLHttpRequest.name,
  webSocketName: WebSocket.name,
}

App({
  globalData: {
    requestGlobalsProbe,
  },
})
