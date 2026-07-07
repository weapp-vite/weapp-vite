const AUTOMATOR_OVERLAY_RE = /\s*\.luna-dom-highlighter[\s\S]*$/
const LEADING_SLASH_RE = /^\/+/
const ROUTE_QUERY_RE = /[?#].*$/u

const REQUEST_CLIENTS_REAL_ROUTE_MARKERS: Record<string, string> = {
  'pages/axios/index': 'axios transport',
  'pages/fetch/index': 'fetch transport',
  'pages/graphql-request/index': 'graphql-request transport',
  'pages/index/index': 'Request Clients Real',
  'pages/socket-io/index': 'socket.io-client transport',
  'pages/vue-query/index': 'vue-query transport',
  'pages/websocket/index': 'native WebSocket transport',
}
const REQUEST_CLIENTS_REAL_ROUTE_DOM: Record<string, { dataset: Record<string, string>, selector: string }> = {
  'pages/axios/index': { selector: '#axios-route', dataset: { e2eRoute: 'axios' } },
  'pages/fetch/index': { selector: '#fetch-route', dataset: { e2eRoute: 'fetch' } },
  'pages/graphql-request/index': { selector: '#graphql-route', dataset: { e2eRoute: 'graphql-request' } },
  'pages/index/index': { selector: '#request-clients-real-root', dataset: { e2eRoute: 'index' } },
  'pages/socket-io/index': { selector: '#socket-route', dataset: { e2eRoute: 'socket-io' } },
  'pages/vue-query/index': { selector: '#vue-query-route', dataset: { e2eRoute: 'vue-query' } },
  'pages/websocket/index': { selector: '#websocket-route', dataset: { e2eRoute: 'websocket' } },
}
const REQUEST_CLIENTS_REAL_STATUS_DOM: Record<string, { dataset: Record<string, string>, selector: string }> = {
  'pages/axios/index': { selector: '#axios-status', dataset: { e2eStatus: 'success' } },
  'pages/fetch/index': { selector: '#fetch-status', dataset: { e2eStatus: 'success' } },
  'pages/graphql-request/index': { selector: '#graphql-status', dataset: { e2eStatus: 'success' } },
  'pages/socket-io/index': { selector: '#socket-status', dataset: { e2eStatus: 'success' } },
  'pages/vue-query/index': { selector: '#vue-query-status', dataset: { e2eStatus: '数据就绪' } },
  'pages/websocket/index': { selector: '#websocket-status', dataset: { e2eStatus: 'success' } },
}

function normalizeRoute(route: string) {
  return route
    .replace(ROUTE_QUERY_RE, '')
    .replace(LEADING_SLASH_RE, '')
}

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(AUTOMATOR_OVERLAY_RE, '')
}

export function resolveRequestClientsRealRouteMarker(route: string) {
  return REQUEST_CLIENTS_REAL_ROUTE_MARKERS[normalizeRoute(route)] ?? ''
}

async function waitForRequestClientsRealRenderedNode(
  page: any,
  dom: { dataset: Record<string, string>, selector: string },
  timeout: number,
) {
  if (typeof page?.waitForRendered === 'function') {
    return await page.waitForRendered({
      dataset: dom.dataset,
      selector: dom.selector,
      timeout,
    })
  }

  if (typeof page?.renderedNodes === 'function') {
    const startedAt = Date.now()
    let latestNodes: unknown[] = []
    while (Date.now() - startedAt <= timeout) {
      latestNodes = await page.renderedNodes(dom.selector).catch(() => [])
      const matched = latestNodes.find((node: any) => {
        const dataset = node?.dataset ?? {}
        return Object.entries(dom.dataset).every(([key, value]) => String(dataset[key] ?? '') === value)
      })
      if (matched) {
        return JSON.stringify({
          nodes: latestNodes,
          selector: dom.selector,
        })
      }
      if (typeof page?.waitFor === 'function') {
        await page.waitFor(220).catch(() => undefined)
      }
      else {
        await new Promise(resolve => setTimeout(resolve, 220))
      }
    }
    throw new Error(`Timed out waiting request-clients-real DOM selector=${dom.selector} dataset=${JSON.stringify(dom.dataset)} latest=${JSON.stringify(latestNodes).slice(0, 800)}`)
  }

  return ''
}

export async function readRequestClientsRealPageWxml(page: any) {
  if (typeof page?.wxml === 'function') {
    return stripAutomatorOverlay(await page.wxml())
  }

  let lastError: unknown
  for (const selector of ['page', 'body', 'weapp-app-shell', 'view']) {
    try {
      const element = await page.$(selector)
      if (!element) {
        continue
      }
      return stripAutomatorOverlay(await element.wxml())
    }
    catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to find rendered page element')
}

export async function waitForRequestClientsRealPageDom(
  page: any,
  options: {
    text?: string
    timeout?: number
  } = {},
) {
  const timeout = options.timeout ?? 15_000
  if (typeof page?.waitForRendered === 'function') {
    return stripAutomatorOverlay(await page.waitForRendered({
      ...(options.text ? { text: options.text } : {}),
      timeout,
    }))
  }

  const startedAt = Date.now()
  let latestWxml = ''
  let latestError: unknown
  while (Date.now() - startedAt <= timeout) {
    try {
      const wxml = await readRequestClientsRealPageWxml(page)
      latestWxml = wxml
      latestError = undefined
      const normalized = wxml.trim()
      if (options.text ? normalized.includes(options.text) : normalized && normalized !== '<text></text>') {
        return wxml
      }
    }
    catch (error) {
      latestError = error
    }
    if (typeof page?.waitFor === 'function') {
      await page.waitFor(220).catch(() => undefined)
    }
    else {
      await new Promise(resolve => setTimeout(resolve, 220))
    }
  }

  const reason = latestError instanceof Error ? latestError.message : String(latestError ?? 'condition not met')
  throw new Error(`Timed out waiting request-clients-real DOM text=${options.text ?? '<non-empty>'}; reason=${reason}; latest=${latestWxml.slice(0, 800)}`)
}

export async function waitForRequestClientsRealRouteDom(page: any, route: string) {
  const normalizedRoute = normalizeRoute(route)
  const dom = REQUEST_CLIENTS_REAL_ROUTE_DOM[normalizedRoute]
  if (dom) {
    return await waitForRequestClientsRealRenderedNode(page, dom, 15_000)
  }
  const marker = resolveRequestClientsRealRouteMarker(normalizedRoute)
  return await waitForRequestClientsRealPageDom(page, marker ? { text: marker } : {})
}

export async function waitForRequestClientsRealSuccessDom(page: any, route: string) {
  const normalizedRoute = normalizeRoute(route)
  const dom = REQUEST_CLIENTS_REAL_STATUS_DOM[normalizedRoute]
  if (dom) {
    return await waitForRequestClientsRealRenderedNode(page, dom, 15_000)
  }
  const marker = normalizedRoute === 'pages/vue-query/index'
    ? 'status = 数据就绪'
    : 'status = success'
  return await waitForRequestClientsRealPageDom(page, {
    text: marker,
  })
}
