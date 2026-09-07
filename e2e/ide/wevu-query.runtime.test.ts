import type { MiniProgram, Page } from '@weapp-vite/miniprogram-automator'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HeadlessSession } from '../../mpcore/packages/simulator/src'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { createServer } from 'node:http'
import { URL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { installQueryRequestTransport } from '../utils/queryRequestTransport'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { attachRuntimeErrorCollector } from './runtimeErrors'
import {
  delay,
  launchIsolatedMiniProgram,
  waitForCurrentPagePath,
  waitForRenderedSelector,
} from './wevu-features.runtime.shared'

const LIST_ROUTE = '/pages/query-list/index'
const DETAIL_ROUTE = '/pages/query-detail/index'
const runtimeProvider = resolveRuntimeProviderName()

interface QueryServerState {
  listCompletions: Record<string, number>
  listRequests: Record<string, number>
  mutationRequests: number
  revision: number
}

interface QueryServerHandle {
  baseUrl: string
  state: QueryServerState
  stop: () => Promise<void>
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function handleQueryRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: QueryServerState,
) {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (request.method === 'GET' && requestUrl.pathname === '/query/items') {
    const filter = requestUrl.searchParams.get('filter') ?? 'all'
    const requestNumber = (state.listRequests[filter] ?? 0) + 1
    const revision = state.revision
    state.listRequests[filter] = requestNumber
    let responseDelay = 90
    if (filter === 'slow') {
      responseDelay = 650
    }
    else if (filter === 'fast') {
      responseDelay = 30
    }
    await delay(responseDelay)
    state.listCompletions[filter] = (state.listCompletions[filter] ?? 0) + 1
    sendJson(response, 200, {
      filter,
      items: [{ id: '1', title: `item-${filter}-r${revision}` }],
      requestId: `${filter}-${requestNumber}`,
      revision,
    })
    return
  }

  const itemId = requestUrl.pathname.match(/^\/query\/items\/([^/]+)$/)?.[1]
  if (request.method === 'POST' && itemId) {
    state.mutationRequests += 1
    state.revision += 1
    sendJson(response, 200, {
      id: decodeURIComponent(itemId),
      revision: state.revision,
    })
    return
  }

  sendJson(response, 404, { error: 'not found' })
}

async function startQueryServer(): Promise<QueryServerHandle> {
  const state: QueryServerState = {
    listCompletions: {},
    listRequests: {},
    mutationRequests: 0,
    revision: 0,
  }
  const server = createServer((request, response) => {
    void handleQueryRequest(request, response, state).catch((error) => {
      if (!response.writableEnded) {
        sendJson(response, 500, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    await new Promise<void>(resolve => server.close(() => resolve()))
    throw new Error('Query fixture server did not expose a TCP port')
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    stop: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    }),
  }
}

function createListRoute(baseUrl: string, filter: string) {
  return `${LIST_ROUTE}?baseUrl=${encodeURIComponent(baseUrl)}&filter=${encodeURIComponent(filter)}`
}

async function readText(page: Page, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Missing query fixture selector: ${selector}`)
  }
  return String(await element.text()).trim()
}

async function tap(page: Page, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Missing query fixture control: ${selector}`)
  }
  await element.tap()
}

async function waitForListResult(page: Page, expected: string) {
  await expect.poll(
    async () => await readText(page, '#query-primary-result'),
    { interval: 100, timeout: 12_000 },
  ).toBe(expected)
  expect(await readText(page, '#query-secondary-result')).toBe(expected)
  expect(await readText(page, '#query-list-status')).toBe('success')
}

async function waitForRoute(miniProgram: MiniProgram, route: string, selector: string) {
  const page: Page | null = await waitForCurrentPagePath(miniProgram, route)
  if (!page || !await waitForRenderedSelector(page, selector)) {
    throw new Error(`Query fixture route did not render: ${route}`)
  }
  return page
}

describe(`@wevu/query mini-program runtime [${runtimeProvider}]`, { concurrent: false }, () => {
  let miniProgram!: MiniProgram
  let runtimeErrors: RuntimeErrorCollector | undefined
  let disposeQueryRequestTransport: (() => void) | undefined
  let headlessSession: HeadlessSession | undefined
  let server!: QueryServerHandle

  beforeAll(async () => {
    server = await startQueryServer()
    miniProgram = await launchIsolatedMiniProgram({
      configureHeadlessSession(session) {
        headlessSession = session
        disposeQueryRequestTransport = installQueryRequestTransport(session, server.baseUrl)
      },
    })
    runtimeErrors = attachRuntimeErrorCollector(miniProgram)
  }, 360_000)

  afterAll(async () => {
    const errors: unknown[] = []
    for (const cleanup of [
      () => runtimeErrors?.dispose(),
      () => disposeQueryRequestTransport?.(),
      () => miniProgram?.close(),
      () => server?.stop(),
    ]) {
      try {
        await cleanup()
      }
      catch (error) {
        errors.push(error)
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Query runtime cleanup failed')
    }
  })

  it('deduplicates list subscribers, keeps fresh data, then refreshes invalidated hidden data after back', async () => {
    const marker = runtimeErrors?.mark() ?? 0
    let listPage = await miniProgram.reLaunch(createListRoute(server.baseUrl, 'dedup'))
    expect(await waitForRenderedSelector(listPage, '#query-list-ready')).toBe(true)
    await waitForListResult(
      listPage,
      'dedup|revision:0|request:dedup-1|item:item-dedup-r0',
    )
    expect(server.state.listRequests.dedup).toBe(1)

    await tap(listPage, '#query-open-detail')
    let detailPage = await waitForRoute(miniProgram, DETAIL_ROUTE, '#query-detail-ready')
    await tap(detailPage, '#query-detail-back')
    listPage = await waitForRoute(miniProgram, LIST_ROUTE, '#query-list-ready')
    await delay(300)
    expect(server.state.listRequests.dedup).toBe(1)

    await tap(listPage, '#query-open-detail')
    detailPage = await waitForRoute(miniProgram, DETAIL_ROUTE, '#query-detail-ready')
    await tap(detailPage, '#query-mutate')
    await expect.poll(
      async () => await readText(detailPage, '#query-mutation-status'),
      { interval: 100, timeout: 8_000 },
    ).toBe('success')
    expect(await readText(detailPage, '#query-mutation-result')).toBe('1|revision:1')
    expect(server.state.mutationRequests).toBe(1)
    await delay(300)
    expect(server.state.listRequests.dedup).toBe(1)

    await tap(detailPage, '#query-detail-back')
    listPage = await waitForRoute(miniProgram, LIST_ROUTE, '#query-list-ready')
    await waitForListResult(
      listPage,
      'dedup|revision:1|request:dedup-2|item:item-dedup-r1',
    )
    expect(server.state.listRequests.dedup).toBe(2)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  }, 45_000)

  it('keeps a slow old-key completion from replacing the active key result', async () => {
    const marker = runtimeErrors?.mark() ?? 0
    const listPage = await miniProgram.reLaunch(createListRoute(server.baseUrl, 'race-seed'))
    expect(await waitForRenderedSelector(listPage, '#query-list-ready')).toBe(true)
    await waitForListResult(
      listPage,
      'race-seed|revision:1|request:race-seed-1|item:item-race-seed-r1',
    )

    await tap(listPage, '#query-use-slow')
    await expect.poll(() => server.state.listRequests.slow ?? 0).toBe(1)
    await tap(listPage, '#query-use-fast')
    const fastResult = 'fast|revision:1|request:fast-1|item:item-fast-r1'
    await waitForListResult(listPage, fastResult)
    await expect.poll(
      () => server.state.listCompletions.slow ?? 0,
      { interval: 100, timeout: 5_000 },
    ).toBe(1)
    expect(await readText(listPage, '#query-primary-result')).toBe(fastResult)
    expect(await readText(listPage, '#query-secondary-result')).toBe(fastResult)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  }, 30_000)

  it.runIf(runtimeProvider === 'headless')('defers automatic queries while the app is hidden, then resumes one shared request on app show', async () => {
    if (!headlessSession) {
      throw new Error('The headless session must be configured before bootstrap')
    }
    const marker = runtimeErrors?.mark() ?? 0
    headlessSession.triggerAppHide({ reason: 0 })
    let listPage!: Page
    try {
      listPage = await miniProgram.reLaunch(createListRoute(server.baseUrl, 'background'))
      expect(await waitForRenderedSelector(listPage, '#query-list-ready')).toBe(true)
      await delay(300)
      expect(server.state.listRequests.background ?? 0).toBe(0)
    }
    finally {
      headlessSession.triggerAppShow()
    }
    await waitForListResult(
      listPage,
      'background|revision:1|request:background-1|item:item-background-r1',
    )
    expect(server.state.listRequests.background).toBe(1)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  }, 30_000)
})
