import type { HeadlessSession } from '../../mpcore/packages/simulator/src'
import type { launchAutomator } from './automator'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'

type SnapshotSession = Awaited<ReturnType<typeof launchAutomator>>

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Snapshot runtime returned an invalid object')
  }
  return value as Record<string, unknown>
}

/** 前后夹读原生页面身份，避免把重载前后的协议结果拼成同一代运行态。 */
export async function readIssue1081SnapshotRuntime(session: SnapshotSession, headless?: HeadlessSession) {
  const before = record(await session.send('App.getCurrentPage', {}, { timeout: 1_000 }))
  if (!Number.isSafeInteger(before.pageId)) {
    throw new TypeError('Snapshot runtime returned an invalid page identity')
  }
  const data = headless
    ? record(headless.getCurrentPages().at(-1)?.data)
    : record(record(await session.send('Page.getData', { pageId: before.pageId }, { timeout: 1_000 })).data)
  const runtime = record(await session.evaluateWithOptions((key: string) => {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const page = pages[pages.length - 1] as any
    const app = typeof getApp === 'function' ? getApp() as any : undefined
    const client = (globalThis as any)[key]
    return {
      appPresent: Boolean(app && typeof app === 'object'),
      appMarker: app?.__e2eHmrInstanceMarker ?? null,
      pageMarker: page?.__e2eHmrInstanceMarker ?? null,
      pageCount: pages.length,
      route: page?.route ?? page?.__route__ ?? null,
      transportReady: client?.getTransportState?.().initialReady === true,
    }
  }, { timeout: 1_000 }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY))
  // Headless 的原始协议没有 title 字段；从本次新容器的导航栏状态读取相同语义。
  const title = headless ? headless.getCurrentPageNavigationBarTitle() : before.title
  const after = record(await session.send('App.getCurrentPage', {}, { timeout: 1_000 }))
  return {
    ...runtime,
    count: data.count,
    marker: data.marker,
    pageId: before.pageId,
    path: before.path,
    pageStable: before.pageId === after.pageId && before.path === after.path,
    title,
    titleStable: headless ? headless.getCurrentPageNavigationBarTitle() === title : after.title === title,
  }
}
