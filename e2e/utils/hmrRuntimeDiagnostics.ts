import process from 'node:process'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY,
} from '@weapp-core/constants'
import { appendIdeReportEvent } from './ideWarningReport'

interface DiagnosticSession {
  currentPage: (options: { appFunctionFallback: boolean }) => Promise<{ pageId: number } | null>
  evaluate: (callback: (...args: any[]) => any, ...args: any[]) => Promise<any>
}

/** 只记录可公开的运行态字段，不改变导航或恢复测试状态。 */
export function createHmrRuntimeDiagnostics(session: DiagnosticSession, project: string) {
  const marker = `hmr-probe-${Date.now()}`

  async function capture(label: string, initialize = false) {
    const errors: string[] = []
    let pageId: number | null = null
    try {
      pageId = (await session.currentPage({ appFunctionFallback: false }))?.pageId ?? null
    }
    catch (error) {
      errors.push(`page identity: ${error instanceof Error ? error.name : typeof error}`)
    }
    let runtime: Record<string, unknown> | null = null
    try {
      runtime = await session.evaluate((keys, expectedMarker, shouldInitialize) => {
        const globals = globalThis as any
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const page = pages[pages.length - 1] as any
        const app = typeof getApp === 'function' ? getApp() as any : undefined
        if (shouldInitialize) {
          if (page) {
            page.__e2eHmrInstanceMarker = expectedMarker
          }
          if (app) {
            app.__e2eHmrInstanceMarker = expectedMarker
          }
        }
        const client = globals[keys.client]
        const transport = client?.getTransportState?.()
        const lastApply = client?.getLastApply?.()
        return {
          route: String(page?.route ?? page?.__route__ ?? ''),
          pageMarkerRetained: page?.__e2eHmrInstanceMarker === expectedMarker,
          appMarkerRetained: app?.__e2eHmrInstanceMarker === expectedMarker,
          appLaunchProbe: app?.__e2eHmrLaunch ?? null,
          nativePageId: page?.__wxWebviewId__ ?? page?.__webviewId__ ?? null,
          clientPresent: Boolean(client),
          bridgeReady: Boolean(globals[keys.bridge]?.ready),
          controlPresent: Boolean(globals[keys.control]),
          clientVersion: typeof client?.getVersion === 'function' ? client.getVersion() : null,
          transportPhase: typeof transport?.phase === 'string' ? transport.phase : null,
          lastResponseType: typeof transport?.lastResponse?.type === 'string' ? transport.lastResponse.type : null,
          lastApplyCounts: lastApply
            ? {
                changed: lastApply.changedIds?.length ?? 0,
                initialized: lastApply.initialized?.length ?? 0,
                missing: lastApply.missing?.length ?? 0,
              }
            : null,
        }
      }, {
        bridge: WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
        client: WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
        control: WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY,
      }, marker, initialize)
    }
    catch (error) {
      errors.push(`runtime snapshot: ${error instanceof Error ? error.name : typeof error}`)
    }
    const snapshot = { label, pageId, runtime, errors }
    const text = JSON.stringify(snapshot)
    appendIdeReportEvent({
      source: 'runtime',
      kind: 'message',
      level: 'info',
      channel: 'hmr-diagnostics',
      project,
      label,
      text,
    })
    process.stdout.write(`[hmr-diagnostics] ${text}\n`)
    return snapshot
  }

  return { capture, initialize: () => capture('before-updates', true) }
}
