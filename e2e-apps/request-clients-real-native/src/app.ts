import { createRequestClientsRealHostTraceStore } from '../../../e2e/utils/requestClientsRealHostTraceRuntime'
import { REQUEST_CLIENTS_REAL_DEV_BASE_URL } from './shared/requestClientsRealDevBaseUrl'

function hasFunction(value: unknown) {
  return typeof value === 'function'
}

function hasPrototypeMethods(value: unknown, methods: string[]) {
  if (!hasFunction(value)) {
    return false
  }

  const prototype = Reflect.get(value, 'prototype')
  if (!prototype || typeof prototype !== 'object') {
    return false
  }

  return methods.every(method => typeof Reflect.get(prototype, method) === 'function')
}

function hasUsableUrl(value: unknown) {
  if (!hasFunction(value)) {
    return false
  }

  try {
    const instance = new URL('https://request-globals.invalid')
    return instance.protocol === 'https:'
  }
  catch {
    return false
  }
}

const requestGlobalsProbe = {
  fetchType: typeof fetch,
  urlAvailable: hasUsableUrl(URL),
  webSocketAvailable: hasPrototypeMethods(WebSocket, ['close', 'send']),
  xmlHttpRequestAvailable: hasPrototypeMethods(XMLHttpRequest, ['open', 'send']),
}

const requestHostTrace = createRequestClientsRealHostTraceStore()

App({
  globalData: {
    requestClientsRealBaseUrl: REQUEST_CLIENTS_REAL_DEV_BASE_URL,
    requestGlobalsProbe,
    requestHostTrace,
  },
})
