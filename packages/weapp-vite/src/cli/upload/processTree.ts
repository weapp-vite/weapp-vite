import { execFileSync } from 'node:child_process'
import process from 'node:process'

interface ProcessLifetime {
  start: number
  end: number
}

function childPids(pid: number, lifetime?: ProcessLifetime): number[] {
  if (process.platform === 'win32') {
    const since = lifetime
      ? `[DateTimeOffset]::FromUnixTimeMilliseconds(${lifetime.start}).UtcDateTime`
      : `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CreationDate.ToUniversalTime()`
    const until = lifetime ? `[DateTimeOffset]::FromUnixTimeMilliseconds(${lifetime.end}).UtcDateTime` : '[DateTime]::UtcNow'
    // PowerShell 启动与 CIM 查询使用独立有界预算，不复用 taskkill 的短时限。
    const output = execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$ErrorActionPreference = 'Stop'; $since = ${since}; $until = ${until}; `
      + `Get-CimInstance Win32_Process -Filter 'ParentProcessId = ${pid}' `
      + '| Where-Object { $_.CreationDate.ToUniversalTime() -ge $since -and $_.CreationDate.ToUniversalTime() -le $until } '
      + '| Select-Object -ExpandProperty ProcessId',
    ], { encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] })
    return output.split(/\s+/).map(Number).filter(value => Number.isSafeInteger(value) && value > 0)
  }
  const output = execFileSync('ps', ['-A', '-o', 'pid=,ppid='], {
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const children = new Map<number, number[]>()
  for (const line of output.trim().split(/\r?\n/)) {
    const [child, parent] = line.trim().split(/\s+/).map(Number)
    if (child && parent) {
      const siblings = children.get(parent) ?? []
      siblings.push(child)
      children.set(parent, siblings)
    }
  }
  const descendants: number[] = []
  const visit = (parent: number) => {
    for (const child of children.get(parent) ?? []) {
      visit(child)
      descendants.push(child)
    }
  }
  visit(pid)
  return descendants
}

function killPid(pid: number): void {
  try {
    process.kill(pid, 'SIGKILL')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error
    }
  }
}

/** POSIX 使用独立进程组；已退出的根进程不再授权向其正 PID 发信号。 */
export function terminateUploadProcess(pid: number, options?: { processGroup?: boolean, exited?: boolean, lifetime?: ProcessLifetime }): void {
  if (process.platform === 'win32') {
    if (options?.exited) {
      // ParentProcessId 会残留；限定已知生命周期，不能把历史同号进程的后代纳入清理。
      if (!options.lifetime) {
        throw new Error('缺少已退出进程的生命周期，无法确认子进程归属。')
      }
      for (const child of childPids(pid, options.lifetime)) {
        terminateUploadProcess(child)
      }
      return
    }
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        timeout: 5000,
        stdio: 'ignore',
      })
    }
    catch (error) {
      // 根进程消失不代表树已清空：恢复仍指向该 ParentProcessId 的子树。
      try {
        process.kill(pid, 0)
      }
      catch (probeError) {
        if ((probeError as NodeJS.ErrnoException).code === 'ESRCH') {
          if (!options?.lifetime) {
            throw new Error('根进程已消失，无法确认子进程归属。')
          }
          for (const child of childPids(pid, options.lifetime)) {
            terminateUploadProcess(child)
          }
          return
        }
      }
      throw error
    }
    return
  }
  if (options?.processGroup) {
    try {
      process.kill(-pid, 'SIGKILL')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
        throw error
      }
      if (!options.exited) {
        killPid(pid)
      }
    }
    return
  }
  if (!options?.exited) {
    killPid(pid)
  }
}

/** 只终止当前 worker 所属的本地子进程，不推断远端任务状态。 */
export function terminateUploadDescendants(pid: number): void {
  for (const child of childPids(pid)) {
    terminateUploadProcess(child)
  }
}
