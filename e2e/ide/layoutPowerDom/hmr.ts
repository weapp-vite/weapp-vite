import fs from 'node:fs/promises'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import path from 'pathe'
import { expect } from 'vitest'
import { waitForFileContains } from '../../utils/hmr-helpers'
import { appendIdeReportEvent } from '../../utils/ideWarningReport'
import { DIST_ROOT } from './session'

const VENDOR_REQUIRE_RE = /require\(["']\.\.\/\.\.\/(weapp-vendors\/[^"']+\.js)["']\)/g

export async function assertRuntimeVendorOutputs() {
  const pageJs = await waitForFileContains(path.join(DIST_ROOT, 'pages/index/index.js'), 'weapp-vendors/', 30_000)
  const vendorFiles = [...new Set([...pageJs.matchAll(VENDOR_REQUIRE_RE)].map(match => match[1]!))]
  expect(vendorFiles.length).toBeGreaterThan(0)
  const contents: string[] = []
  for (const file of vendorFiles) {
    const resolved = path.resolve(DIST_ROOT, file)
    expect(path.relative(DIST_ROOT, resolved).startsWith('..'), `vendor output must stay inside dist: ${file}`).toBe(false)
    contents.push(await fs.readFile(resolved, 'utf8'))
  }
  expect(contents.some(content => content.includes('setPageLayout'))).toBe(true)
  return pageJs
}

export async function readHmrVersion(miniProgram: any) {
  return await miniProgram.evaluate(() => {
    const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
    return typeof client?.getVersion === 'function' ? Number(client.getVersion()) : -1
  })
}

export async function waitForHmrVersion(miniProgram: any, expected: number) {
  await expect.poll(() => readHmrVersion(miniProgram), { timeout: 30_000, interval: 250 }).toBe(expected)
}

export async function captureLayoutPageState(miniProgram: any, label: string) {
  const nativePage = await miniProgram.currentPage({ appFunctionFallback: false })
  const nativeOptions = { fallback: false, timeout: 2_500 }
  const readNativeState = async () => {
    const data = await nativePage.data(undefined, nativeOptions)
    return {
      currentLayout: data.currentLayout,
      runtimeEvents: data.runtimeEvents,
      e2eRuntimeVendorMarker: data.e2eRuntimeVendorMarker,
    }
  }
  const before = await readNativeState()
  // Stable IDE 的方法协议跨 Runtime registry 传递 objectId；显式在 AppService 内执行一次公开页面方法。
  const methodResult = await nativePage.callMethodWithOptions('runE2E', { ...nativeOptions, routeOnly: true })
  const after = await readNativeState()
  const state = await miniProgram.evaluate((bridgeKey: string) => {
    const pages = getCurrentPages() as any[]
    const page = pages[pages.length - 1]
    const bridge = (globalThis as any)[bridgeKey]
    const tracked = bridge?.getDebugSnapshot(true)?.instances ?? []
    return {
      route: page?.route,
      pageId: page?.__wxWebviewId__ ?? page?.__webviewId__,
      data: {
        currentLayout: page?.data?.currentLayout,
        runtimeEvents: page?.data?.runtimeEvents,
        e2eRuntimeVendorMarker: page?.data?.e2eRuntimeVendorMarker,
      },
      tracked: tracked.map((entry: any) => ({
        moduleId: entry.moduleId,
        count: entry.count,
        initialDefinitionMarker: entry.initialDefinitionData?.e2eRuntimeVendorMarker,
        latestDefinitionMarker: entry.latestDefinitionData?.e2eRuntimeVendorMarker,
        definitionPropertyKeys: entry.definitionPropertyKeys,
        definitionChanged: entry.definitionChanged,
        states: entry.states?.map((value: any) => ({
          route: value.route,
          pageId: value.pageId,
          instancePropertyKeys: value.instancePropertyKeys,
          dataReferenceStable: value.dataReferenceStable,
          pendingDefaultKeys: value.pendingDefaultKeys,
          dataMarker: value.data?.e2eRuntimeVendorMarker,
          snapshotMarker: value.snapshot?.e2eRuntimeVendorMarker,
        })),
      })),
    }
  }, WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)
  const nativeState = { pageId: nativePage.pageId, before, after }
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'message',
    level: 'info',
    channel: 'hmr-diagnostics',
    project: 'apps/layout-power-demo',
    text: JSON.stringify({ label, state, nativeState, methodResult }),
  })
  expect(String(state.pageId), 'AppService 与原生协议必须指向同一页面').toBe(String(nativeState.pageId))
  expect(after, '只读方法不能改写原生页面状态').toEqual(before)
  expect(state.data, '方法调用后的 AppService 状态必须与原生页面一致').toEqual(before)
  expect(methodResult).toMatchObject({ currentLayout: before.currentLayout, marker: before.e2eRuntimeVendorMarker })
  return { nativePage, nativeState, state, methodResult }
}
