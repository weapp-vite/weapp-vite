import { REQUEST_CLIENTS_REAL_DEV_BASE_URL } from './shared/requestClientsRealDevBaseUrl'

function hasUsableConstructor(value: unknown, args: unknown[]) {
  if (typeof value !== 'function') {
    return false
  }

  try {
    Reflect.construct(value, args)
    return true
  }
  catch {
    return false
  }
}

const requestGlobalsProbe = {
  fetchType: typeof fetch,
  urlAvailable: hasUsableConstructor(URL, ['https://request-globals.invalid']),
  webSocketAvailable: hasUsableConstructor(WebSocket, ['wss://request-globals.invalid']),
  xmlHttpRequestAvailable: hasUsableConstructor(XMLHttpRequest, []),
}

App({
  globalData: {
    requestClientsRealBaseUrl: REQUEST_CLIENTS_REAL_DEV_BASE_URL,
    requestGlobalsProbe,
  },
})
