import type { AutomatorLaunchLifecycle } from './automatorLaunchLifecycle'
import type { DevtoolsSimulatorBootDiagnostic } from './ide-devtools-logs'
import process from 'node:process'
import { captureDevtoolsLogBaseline, scanRecentDevtoolsSimulatorBootDiagnostics } from './ide-devtools-logs'
import { appendIdeReportEvent } from './ideWarningReport'

export const DEVTOOLS_LOG_SCAN_INTERVAL = 500

export class DevtoolsSimulatorBootLogError extends Error {
  constructor(label: string, readonly issue: DevtoolsSimulatorBootDiagnostic, readonly firstIssue = issue, cause?: unknown) {
    const detail = issue.line === firstIssue.line ? issue.line : `${firstIssue.line}; blocking error: ${issue.line}`
    super(`WeChat DevTools simulator boot error detected in IDE log during ${label}: ${detail}`, { cause })
    this.name = 'WechatIdeSimulatorBootLogError'
  }
}

/** 启动期保留首错，在原有预算内等同一窗口就绪；日志丢失和启动 success 均不能消除错误。 */
export function createDevtoolsSimulatorBootLogMonitor(project: string) {
  const sinceMs = Date.now()
  const baseline = captureDevtoolsLogBaseline()
  const diagnostics = new Map<string, DevtoolsSimulatorBootDiagnostic>()
  let lastScanAt = Number.NEGATIVE_INFINITY
  let starting = true

  function report(label: string, issue: DevtoolsSimulatorBootDiagnostic) {
    const level = issue.state === 'recovered' ? 'info' : 'warn'
    const text = `${label}: state=${issue.state} window=${issue.windowId ?? '<unknown>'} first-error=${issue.line}${issue.readyLine ? ` ready=${issue.readyLine}` : ''}`
    process.stdout.write(`[${level}] [runtime:devtools-log] ${text} project=${project}\n`)
    appendIdeReportEvent({ source: 'runtime', kind: 'message', project, level, channel: 'devtools-log', text })
  }

  function scan(label: string, force: boolean) {
    const now = Date.now()
    if (!force && now - lastScanAt < DEVTOOLS_LOG_SCAN_INTERVAL) {
      return
    }
    lastScanAt = now
    for (const issue of scanRecentDevtoolsSimulatorBootDiagnostics({ baseline, sinceMs })) {
      const key = `${issue.file}\n${issue.line}`
      const previous = diagnostics.get(key)
      if (!previous) {
        // 首次扫描已包含 ready 时仍保留独立首错，避免轮询快慢改变诊断事实。
        if (issue.state === 'recovered') {
          report(label, { ...issue, state: 'pending', readyLine: undefined })
        }
        diagnostics.set(key, issue)
        report(label, issue)
      }
      else if (previous.state === 'pending' && issue.state === 'recovered') {
        diagnostics.set(key, issue)
        report(label, issue)
      }
    }
  }

  function unresolved() {
    return [...diagnostics.values()].filter(issue => issue.state !== 'recovered')
  }

  function failure(label: string, issue: DevtoolsSimulatorBootDiagnostic, cause?: unknown) {
    return new DevtoolsSimulatorBootLogError(label, issue, diagnostics.values().next().value ?? issue, cause)
  }

  function assertClean(label: string, force = false) {
    scan(label, force)
    const issue = unresolved().find(issue => issue.state === 'fatal' || !starting)
    if (issue) {
      throw failure(label, issue)
    }
  }

  async function waitForPendingReady(lifecycle: AutomatorLaunchLifecycle) {
    const label = 'startup webview page ready'
    assertClean(label, true)
    while (unresolved().length) {
      // 轮询只观察当前窗口，不编译、不导航，也不延长启动 deadline。
      await lifecycle.pause(DEVTOOLS_LOG_SCAN_INTERVAL)
      assertClean(label, true)
    }
    lifecycle.throwIfAborted()
  }

  return {
    assertClean,
    waitForPendingReady,
    async finishStartup(lifecycle: AutomatorLaunchLifecycle) {
      await waitForPendingReady(lifecycle)
      starting = false
    },
    normalizeError(error: unknown) {
      if (error instanceof DevtoolsSimulatorBootLogError) {
        return error
      }
      const issue = unresolved()[0]
      // 失败后的新日志不能倒推本次启动在截止时间前已经恢复。
      return issue ? failure('startup failed before webview page ready', issue, error) : error
    },
  }
}
