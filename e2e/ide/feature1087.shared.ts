import type { MiniProgram, Page } from '@weapp-vite/miniprogram-automator'
import type { Feature1087Record } from '../../e2e-apps/github-issues/src/shared/feature1087'
import { ok as assert } from 'node:assert'
import { expect } from 'vitest'
import { waitForCurrentPagePath } from './github-issues.runtime.shared'

export const LIST = '/pages/feature-1087/index'
export const SKYLINE = '/pages/feature-1087/skyline/index'
export const DOCUMENT = '/pages/feature-1087/page/index'
export const NATIVE = '/pages/feature-1087/native/index'
export const TAB = '/pages/feature-1087/tab/index'
export const TAB_PEER = '/pages/feature-1087/tab-peer/index'
export const FEATURE_ROUTES = [LIST, SKYLINE, DOCUMENT, NATIVE, TAB, TAB_PEER]

export interface Feature1087Snapshot {
  SDKVersion: string
  platform: string
  renderer: string | null
  automatic: boolean
  apis: Record<string, string>
  records: Feature1087Record[]
  errors: string[]
  navigation: { settled: boolean, failed: boolean, path: string }
  instance: number
  path: string
  ready: boolean
  contentReady: boolean
  marker: string
  observed: { primaryTop: number, secondaryTop: number }
}

interface ScrollOffset { scrollTop: number, scrollLeft: number }

/** 探针是同一 fixture 的公开测试入口，不读取编译生成的 helper 或内部 ref。 */
export async function snapshot(page: Page) {
  return await page.callMethod('_snapshot') as Feature1087Snapshot
}

export async function currentPage(miniProgram: MiniProgram, route: string) {
  const page = await waitForCurrentPagePath(miniProgram, route, 15_000)
  assert(page, `Expected current page ${route}`)
  await expect.poll(async () => {
    const state = await snapshot(page)
    const start = state.records.findLast(record => record.phase === 'BeforeAppRoute')
    return {
      ready: route === NATIVE || route === TAB_PEER || state.ready,
      done: start?.path === route.replace(/^\/+/, '').split('?')[0]
        && state.records.some(record => record.phase === 'AppRouteDone'
          && (record.routeEventId === start.routeEventId
            || (record.routeEventId === '' && typeof start.webviewId === 'number'
              && record.webviewId === start.webviewId && record.path === start.path && record.openType === start.openType))),
    }
  }, { timeout: 10_000 }).toEqual({ ready: true, done: true })
  return page
}

export async function expectListPosition(page: Page, top: number, left: number, secondaryTop: number) {
  await expect.poll(async () => {
    // selectorQuery 返回宿主实际 scrollOffset；没有用绑定 ref 或模拟 dataset 替代。
    // 原生 Page 协议不等待 Promise；显式走 AppService 获取异步查询的实际结果。
    const offsets = await page.callMethodWithOptions('_measure', { routeOnly: true }) as [ScrollOffset, ScrollOffset, { height: number } | null]
    return offsets[0] && offsets[1] && offsets[2]
      ? {
          primary: Math.abs(offsets[0].scrollTop - top) <= 2,
          horizontal: Math.abs(offsets[0].scrollLeft - left) <= 2,
          secondary: Math.abs(offsets[1].scrollTop - secondaryTop) <= 2,
          content: offsets[2].height >= 1700,
        }
      : offsets
  }, { timeout: 10_000 }).toEqual({ primary: true, horizontal: true, secondary: true, content: true })
}

export async function setListPosition(page: Page, top: number, left: number, secondaryTop: number) {
  await page.callMethodWithOptions('_setPosition', { routeOnly: true }, top, left, secondaryTop)
  await expectListPosition(page, top, left, secondaryTop)
  await expect.poll(async () => (await snapshot(page)).observed, { timeout: 10_000 })
    .toEqual({ primaryTop: top, secondaryTop })
}

export async function expectPagePosition(page: Page, top: number) {
  await expect.poll(async () => {
    const offsets = await page.callMethodWithOptions('_measure', { routeOnly: true }) as [ScrollOffset]
    return Math.abs(offsets[0].scrollTop - top)
  }, { timeout: 10_000 }).toBeLessThanOrEqual(2)
}

export function expectCapturedBeforeUnload(records: Feature1087Record[], instance: number, top?: number) {
  const capture = records.findIndex(record => record.instance === instance && record.phase === 'capture')
  const unload = records.findIndex(record => record.instance === instance && record.phase === 'unload')
  expect(capture).toBeGreaterThanOrEqual(0)
  expect(unload).toBeGreaterThan(capture)
  if (top !== undefined) {
    expect(records[capture].primaryTop).toBe(top)
  }
}

export function expectNativeRoutePhases(records: Feature1087Record[], path: string, openType: string) {
  const startIndex = records.findLastIndex(record => record.phase === 'BeforeAppRoute' && record.path === path.slice(1) && record.openType === openType)
  const start = records[startIndex]
  assert(start?.routeEventId, `Missing native route start: ${JSON.stringify(records)}`)
  const phases = records.slice(startIndex).filter(record => ['BeforeAppRoute', 'AppRoute', 'AppRouteDone'].includes(record.phase))
  expect(phases.map(record => record.phase)).toEqual(['BeforeAppRoute', 'AppRoute', 'AppRouteDone'])
  expect(phases[1].routeEventId).toBe(start.routeEventId)
  expect(phases[2]).toMatchObject({ path: start.path, openType, webviewId: start.webviewId })
  // SDK 的同路径 reLaunch 完成通知允许空 id；保留原始观测值，不伪造事件字段。
  expect([start.routeEventId, '']).toContain(phases[2].routeEventId)
}
