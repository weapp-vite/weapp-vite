import type { MiniProgram, Page } from '@weapp-vite/miniprogram-automator'
import type { HeadlessSession } from '../../mpcore/packages/simulator/src'
import type { QueryServerHandle } from '../utils/queryFixtureServer'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { startQueryServer } from '../utils/queryFixtureServer'
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

  it('deduplicates list subscribers, keeps fresh data, then refreshes invalidated hidden data after back', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/wevu-features', [
      { id: 'list:fresh', route: LIST_ROUTE, action: '首次共享请求完成后检查两个订阅者', nodes: [
        { selector: '#query-primary-result', text: 'dedup|revision:0|request:dedup-1|item:item-dedup-r0' },
        { selector: '#query-secondary-result', text: 'dedup|revision:0|request:dedup-1|item:item-dedup-r0' },
      ] },
      { id: 'detail:mutation', route: DETAIL_ROUTE, action: '详情 mutation 完成后检查结果', nodes: [
        { selector: '#query-mutation-status', text: 'success' },
        { selector: '#query-mutation-result', text: '1|revision:1' },
      ] },
      { id: 'list:refreshed', route: LIST_ROUTE, action: '返回已失效列表后检查共享刷新结果', nodes: [
        { selector: '#query-primary-result', text: 'dedup|revision:1|request:dedup-2|item:item-dedup-r1' },
        { selector: '#query-secondary-result', text: 'dedup|revision:1|request:dedup-2|item:item-dedup-r1' },
        { selector: '#query-list-status', text: 'success' },
      ] },
    ])
    const marker = runtimeErrors?.mark() ?? 0
    let listPage = await miniProgram.reLaunch(createListRoute(server.baseUrl, 'dedup'))
    expect(await waitForRenderedSelector(listPage, '#query-list-ready')).toBe(true)
    await waitForListResult(
      listPage,
      'dedup|revision:0|request:dedup-1|item:item-dedup-r0',
    )
    expect(server.state.listRequests.dedup).toBe(1)
    await dom.check('list:fresh', miniProgram, listPage)

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
    await dom.check('detail:mutation', miniProgram, detailPage)
    expect(server.state.mutationRequests).toBe(1)
    await delay(300)
    expect(server.state.listRequests.dedup).toBe(1)

    await tap(detailPage, '#query-detail-back')
    listPage = await waitForRoute(miniProgram, LIST_ROUTE, '#query-list-ready')
    await waitForListResult(
      listPage,
      'dedup|revision:1|request:dedup-2|item:item-dedup-r1',
    )
    await dom.check('list:refreshed', miniProgram, listPage)
    expect(server.state.listRequests.dedup).toBe(2)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  }, 45_000)

  it('keeps a slow old-key completion from replacing the active key result', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/wevu-features', [
      { id: 'race:fast', route: LIST_ROUTE, action: '切换到新 key 后检查较快响应', nodes: [
        { selector: '#query-primary-result', text: 'fast|revision:1|request:fast-1|item:item-fast-r1' },
        { selector: '#query-secondary-result', text: 'fast|revision:1|request:fast-1|item:item-fast-r1' },
      ] },
      { id: 'race:stable', route: LIST_ROUTE, action: '旧 key 慢请求完成后检查当前界面未被覆盖', nodes: [
        { selector: '#query-primary-result', text: 'fast|revision:1|request:fast-1|item:item-fast-r1' },
        { selector: '#query-secondary-result', text: 'fast|revision:1|request:fast-1|item:item-fast-r1' },
      ] },
    ])
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
    await dom.check('race:fast', miniProgram, listPage)
    await expect.poll(
      () => server.state.listCompletions.slow ?? 0,
      { interval: 100, timeout: 5_000 },
    ).toBe(1)
    expect(await readText(listPage, '#query-primary-result')).toBe(fastResult)
    expect(await readText(listPage, '#query-secondary-result')).toBe(fastResult)
    await dom.check('race:stable', miniProgram, listPage)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  }, 30_000)

  it.runIf(runtimeProvider === 'headless')('defers automatic queries while the app is hidden, then resumes one shared request on app show', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/wevu-features', [
      { id: 'app:resumed', route: LIST_ROUTE, action: '应用恢复前台后检查一次共享请求的界面结果', nodes: [
        { selector: '#query-primary-result', text: 'background|revision:1|request:background-1|item:item-background-r1' },
        { selector: '#query-secondary-result', text: 'background|revision:1|request:background-1|item:item-background-r1' },
        { selector: '#query-list-status', text: 'success' },
      ] },
    ])
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
    await dom.check('app:resumed', miniProgram, listPage)
    expect(server.state.listRequests.background).toBe(1)
    expect(runtimeErrors?.getSince(marker)).toEqual([])
  }, 30_000)
})
