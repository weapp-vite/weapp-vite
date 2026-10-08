import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 当前写入者身份自查保留跨平台启动封装与严格查询预算。
import { execa } from 'execa'
import { resolveWechatInspectionTimeout } from '../../../devtoolsTarget/inspection'
import { windowsSelfIdentityCommand } from './command'
import { parseWindowsSelfIdentity } from './wire'

/** 仅核验当前 Node 写入进程；不能用于任意宿主、旧锁存活判断或进程清理。 */
export async function readWindowsJournalWriterIdentity() {
  const timeout = resolveWechatInspectionTimeout('win32')
  const result = await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', windowsSelfIdentityCommand(process.pid)], {
    timeout,
    reject: false,
    windowsHide: true,
    maxBuffer: 64 * 1024,
  })
  if (result.exitCode !== 0 || result.failed || result.timedOut || result.signal || result.stderr.trim()) {
    // 仅保留结构化错误标签，不能将目标路径或 PowerShell 环境输出复制到日志。
    const reason = /^WEAPP_JOURNAL_SELF_V1:error:([\w.]+):-?\d+\r?\n?$/.exec(result.stderr)?.[1] ?? 'unconfirmed'
    throw new Error(`Managed journal writer identity could not be verified; the journal remains unchanged. Inspection: exitCode=${result.exitCode ?? 'none'}, signal=${result.signal ?? 'none'}, timedOut=${result.timedOut ?? false}, timeoutMs=${timeout}, reason=${reason}.`)
  }
  return parseWindowsSelfIdentity(result.stdout, process.pid)
}
