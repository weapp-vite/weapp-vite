/**
 * @file AppService Page 方法调用兼容层。
 */
import type Connection from './Connection'
import { sleep, uuid } from './internal/compat'

interface RouteMethodResult {
  __weappVitePageMethodFound: boolean
  error?: string
  status?: 'fulfilled' | 'pending' | 'rejected'
  value?: any
}

const PAGE_CALL_METHOD_FALLBACK_RETRIES = 3
const PAGE_CALL_METHOD_FALLBACK_RETRY_DELAY = 300
const ROUTE_METHOD_CALL_STORE = '__weappViteAutomatorMethodCalls__'

function isProtocolTimeoutError(error: unknown) {
  return error instanceof Error
    && 'code' in error
    && error.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && 'method' in error
    && error.method === 'App.callFunction'
}

function isRouteMethodResult(value: unknown): value is RouteMethodResult {
  return value !== null
    && typeof value === 'object'
    && '__weappVitePageMethodFound' in value
}

const ROUTE_METHOD_FUNCTION_DECLARATION = `function (route, query, method, args, callId, cleanupDelay) {
  var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  var normalizedRoute = String(route || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
  function matchesQuery(page, expectedQuery) {
    if (!expectedQuery || !Object.keys(expectedQuery).length) {
      return true;
    }
    var actualQuery = page && (page.options || page.query || {});
    return Object.keys(expectedQuery).every(function (key) {
      var actualValue = String(actualQuery[key] == null ? '' : actualQuery[key]);
      var expectedValue = String(expectedQuery[key]);
      var decodedActualValue = actualValue;
      try {
        decodedActualValue = decodeURIComponent(actualValue);
      }
      catch (_) {
      }
      return actualValue === expectedValue
        || decodedActualValue === expectedValue
      || actualValue === encodeURIComponent(expectedValue);
    });
  }
  function resolvePage() {
    for (var index = pages.length - 1; index >= 0; index -= 1) {
      var page = pages[index];
      var pageRoute = String(page.path || page.route || page.__route__ || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
      if (pageRoute === normalizedRoute && matchesQuery(page, query) && typeof page[method] === 'function') {
        return page;
      }
    }
    for (var fallbackIndex = pages.length - 1; fallbackIndex >= 0; fallbackIndex -= 1) {
      var fallbackPage = pages[fallbackIndex];
      if (matchesQuery(fallbackPage, query) && typeof fallbackPage[method] === 'function') {
        return fallbackPage;
      }
    }
  }
  var storeOwner;
  if (typeof getApp === 'function') {
    try {
      storeOwner = getApp();
    }
    catch (_) {
    }
  }
  var store = storeOwner && storeOwner[${JSON.stringify(ROUTE_METHOD_CALL_STORE)}];
  if (store && store[callId]) {
    return store[callId];
  }
  var targetPage = resolvePage();
  if (!targetPage) {
    return { __weappVitePageMethodFound: false };
  }
  if (!storeOwner || (typeof storeOwner !== 'object' && typeof storeOwner !== 'function')) {
    storeOwner = targetPage;
  }
  store = storeOwner[${JSON.stringify(ROUTE_METHOD_CALL_STORE)}];
  if (!store || typeof store !== 'object') {
    store = {};
    storeOwner[${JSON.stringify(ROUTE_METHOD_CALL_STORE)}] = store;
  }
  if (store[callId]) {
    return store[callId];
  }
  var result = {
    __weappVitePageMethodFound: true,
    status: 'pending'
  };
  store[callId] = result;
  setTimeout(function () {
    delete store[callId];
  }, cleanupDelay);
  try {
    var value = targetPage[method].apply(targetPage, args || []);
    if (value && typeof value.then === 'function') {
      value.then(function (resolvedValue) {
        result.status = 'fulfilled';
        result.value = resolvedValue;
      }, function (error) {
        result.status = 'rejected';
        result.error = error && error.message ? String(error.message) : String(error);
      });
    }
    else {
      result.status = 'fulfilled';
      result.value = value;
    }
  }
  catch (error) {
    result.status = 'rejected';
    result.error = error && error.message ? String(error.message) : String(error);
  }
  return result;
}`

/** 通过 AppService 调用页面方法，并兼容 DevTools 不等待 Promise 结果的行为。 */
export async function callRouteMethodViaAppService(
  connection: Connection,
  route: string,
  query: Record<string, any>,
  method: string,
  args: any[],
  timeout: number,
) {
  const callId = uuid()
  const cleanupDelay = timeout + 5_000
  const maxPendingPolls = Math.max(1, Math.ceil(timeout / PAGE_CALL_METHOD_FALLBACK_RETRY_DELAY))
  let pendingPolls = 0
  let protocolFailures = 0
  let unavailableReads = 0
  let latestResult: any

  while (true) {
    let fallbackResult: any
    try {
      fallbackResult = (await connection.send('App.callFunction', {
        functionDeclaration: ROUTE_METHOD_FUNCTION_DECLARATION,
        args: [route, query, method, args, callId, cleanupDelay],
      }, {
        timeout,
      })).result
    }
    catch (error) {
      protocolFailures += 1
      if (!isProtocolTimeoutError(error) || protocolFailures >= PAGE_CALL_METHOD_FALLBACK_RETRIES) {
        throw error
      }
      await sleep(PAGE_CALL_METHOD_FALLBACK_RETRY_DELAY)
      continue
    }

    if (isRouteMethodResult(fallbackResult)) {
      if (!fallbackResult.__weappVitePageMethodFound) {
        unavailableReads += 1
        if (unavailableReads >= PAGE_CALL_METHOD_FALLBACK_RETRIES) {
          return undefined
        }
      }
      else if (fallbackResult.status === 'pending') {
        pendingPolls += 1
        if (pendingPolls >= maxPendingPolls) {
          throw new Error(`Timed out waiting for page method ${method} after ${timeout}ms`)
        }
      }
      else if (fallbackResult.status === 'rejected') {
        throw new Error(`Page method ${method} failed: ${fallbackResult.error || 'unknown error'}`)
      }
      else {
        return fallbackResult.value
      }
    }
    else {
      latestResult = fallbackResult
      if (latestResult !== undefined) {
        return latestResult
      }
      unavailableReads += 1
      if (unavailableReads >= PAGE_CALL_METHOD_FALLBACK_RETRIES) {
        return latestResult
      }
    }

    await sleep(PAGE_CALL_METHOD_FALLBACK_RETRY_DELAY)
  }
}
