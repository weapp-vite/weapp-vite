import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { debuglog } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 当前写入者身份自查保留跨平台启动封装与严格查询预算。
import { execa } from 'execa'
import { resolveWechatInspectionTimeout } from '../../../devtoolsTarget/inspection'
import { windowsSelfIdentityCommand } from './command'
import { observeWindowsSelfIdentityPhases, stripWindowsSelfIdentityPhases, traceWindowsSelfIdentityCommand } from './trace'
import { parseWindowsSelfIdentity } from './wire'

const debug = debuglog('weapp-ide-journal-writer')

/** 仅核验当前 Node 写入进程；不能用于任意宿主、旧锁存活判断或进程清理。 */
export async function readWindowsJournalWriterIdentity() {
  const timeout = resolveWechatInspectionTimeout('win32')
  const trace = debug.enabled
  const command = windowsSelfIdentityCommand(process.pid)
  const started = performance.now()
  const query = execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', trace ? traceWindowsSelfIdentityCommand(command) : command], {
    timeout,
    reject: false,
    windowsHide: true,
    maxBuffer: 64 * 1024,
    // 阶段行必须保留完整终止符；默认查询继续使用原有末尾换行裁剪。
    stripFinalNewline: !trace,
  })
  if (trace) {
    const report = (phase: string) => debug('phase=%s elapsedMs=%s', phase, (performance.now() - started).toFixed(1))
    report('launch')
    query.nodeChildProcess.once('spawn', () => report('spawn'))
    query.stderr?.on('data', observeWindowsSelfIdentityPhases(report))
  }
  const result = await query
  const stderr = trace ? stripWindowsSelfIdentityPhases(result.stderr) : result.stderr
  if (trace) {
    debug('phase=settled elapsedMs=%s exitCode=%s signal=%s timedOut=%s', (performance.now() - started).toFixed(1), result.exitCode ?? 'none', result.signal ?? 'none', result.timedOut ?? false)
  }
  if (result.exitCode !== 0 || result.failed || result.timedOut || result.signal || stderr.trim()) {
    // 仅保留结构化错误标签，不能将目标路径或 PowerShell 环境输出复制到日志。
    const reason = /^WEAPP_JOURNAL_SELF_V1:error:([\w.]+):-?\d+\r?\n?$/.exec(stderr)?.[1] ?? 'unconfirmed'
    throw new Error(`Managed journal writer identity could not be verified; the journal remains unchanged. Inspection: exitCode=${result.exitCode ?? 'none'}, signal=${result.signal ?? 'none'}, timedOut=${result.timedOut ?? false}, timeoutMs=${timeout}, reason=${reason}.`)
  }
  return parseWindowsSelfIdentity(result.stdout, process.pid)
}
