/* eslint-disable e18e/ban-dependencies -- 有限只读采样使用 execa 管理本任务 PowerShell 子进程。 */
import process from 'node:process'
import { execa } from 'execa'
import { diagnosticError } from './writer'

export const WINDOWS_SAMPLE_TIMEOUT = 3000
export const WINDOWS_SAMPLE_LIMIT = 6

/** 只接受实际协议/子进程返回的 PID，脚本不按进程名称查询或释放资源。 */
export function windowsSnapshotScript(pids: number[]) {
  const selected = [...new Set(pids.filter(pid => Number.isSafeInteger(pid) && pid > 0))].slice(0, 64)
  return `
$ErrorActionPreference = 'Stop'
function Write-SampleSection($phase, $result) {
  [pscustomobject]@{ phase=$phase; capturedAt=[DateTime]::UtcNow.ToString('o'); result=$result } | ConvertTo-Json -Depth 6 -Compress
}
Write-SampleSection 'script-begin' $null
$taskProcessIds = @(${selected.join(',')})
$sampleErrors = @()
$processes = @()
foreach ($taskProcessId in $taskProcessIds) {
  try {
    $taskProcess = Get-Process -Id $taskProcessId -ErrorAction Stop
    $processes += [pscustomobject]@{ id=$taskProcess.Id; startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o'); handles=$taskProcess.HandleCount; workingSetBytes=$taskProcess.WorkingSet64; privateBytes=$taskProcess.PrivateMemorySize64 }
  } catch { $sampleErrors += [pscustomobject]@{ phase='process'; id=$taskProcessId; message=$_.Exception.Message } }
}
Write-SampleSection 'processes' ([pscustomobject]@{ items=$processes; errors=$sampleErrors })
$sampleErrors = @()
$system = $null
try { $os = Get-CimInstance Win32_OperatingSystem; $system = [pscustomobject]@{ totalPhysicalKiB=$os.TotalVisibleMemorySize; freePhysicalKiB=$os.FreePhysicalMemory; totalVirtualKiB=$os.TotalVirtualMemorySize; freeVirtualKiB=$os.FreeVirtualMemory } } catch { $sampleErrors += [pscustomobject]@{ phase='memory'; message=$_.Exception.Message } }
Write-SampleSection 'memory' ([pscustomobject]@{ system=$system; errors=$sampleErrors })
$sampleErrors = @()
$tcp = @()
try { $tcp = @(Get-NetTCPConnection -ErrorAction Stop) } catch { $sampleErrors += [pscustomobject]@{ phase='tcp'; message=$_.Exception.Message } }
Write-SampleSection 'tcp' ([pscustomobject]@{
  tcpStates=@($tcp | Group-Object State | ForEach-Object { [pscustomobject]@{ state=$_.Name; count=$_.Count } })
  taskTcp=@($tcp | Where-Object { $taskProcessIds -contains $_.OwningProcess } | Select-Object -First 200 OwningProcess,State,LocalPort,RemotePort)
  errors=$sampleErrors
})
foreach ($networkQuery in @(
  @{ phase='dynamic-ipv4'; arguments=@('int','ipv4','show','dynamicport','tcp') },
  @{ phase='dynamic-ipv6'; arguments=@('int','ipv6','show','dynamicport','tcp') },
  @{ phase='excluded-ipv4'; arguments=@('int','ipv4','show','excludedportrange','protocol=tcp') },
  @{ phase='excluded-ipv6'; arguments=@('int','ipv6','show','excludedportrange','protocol=tcp') }
)) {
  $networkArguments = $networkQuery.arguments
  $lines = @(& netsh @networkArguments)
  Write-SampleSection $networkQuery.phase ([pscustomobject]@{ lines=$lines; exitCode=$LASTEXITCODE })
}
`
}

export function parseWindowsSections(stdout: string) {
  return stdout.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map((line) => {
    try {
      return JSON.parse(line) as unknown
    }
    catch (error) {
      return { phase: 'parse-error', error: diagnosticError(error), output: line.slice(0, 2000) }
    }
  })
}

export class WindowsSnapshotError extends Error {
  constructor(message: string, readonly partial: unknown[]) {
    super(message)
    this.name = 'WindowsSnapshotError'
  }
}

export async function readWindowsSnapshot(pids: number[]) {
  const child = await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', windowsSnapshotScript(pids)], {
    timeout: WINDOWS_SAMPLE_TIMEOUT,
    maxBuffer: 256 * 1024,
    reject: false,
    killDescendants: true,
    killSignal: 'SIGKILL',
    forceKillAfterDelay: false,
    shell: false,
  })
  const sections = parseWindowsSections(child.stdout)
  if (child.failed) {
    throw new WindowsSnapshotError(`Windows diagnostic sample failed: exit=${child.exitCode}, signal=${child.signal}, timedOut=${child.timedOut}; ${child.stderr.slice(0, 2000)}`, sections)
  }
  return sections
}

/** 不等待采样再导航；最多一个采样进程，结束时只等待该进程的有限收尾。 */
export function createWindowsSampler(
  record: (event: Record<string, unknown>) => void,
  read = readWindowsSnapshot,
  platform: string = process.platform,
) {
  let pending: Promise<void> | undefined
  let count = 0
  let stopped = false
  return {
    sample(phase: string, pids: number[]) {
      if (platform !== 'win32' || stopped) {
        return
      }
      if (pending || count >= WINDOWS_SAMPLE_LIMIT) {
        record({ event: 'windows-sample-skipped', phase, reason: pending ? 'sample-in-progress' : 'sample-limit' })
        return
      }
      count++
      const requestedAt = new Date().toISOString()
      pending = Promise.resolve().then(() => read([...pids])).then(
        result => record({ event: 'windows-sample', phase, requestedAt, result }),
        error => record({ event: 'diagnostic-error', phase: `windows:${phase}`, requestedAt, error: diagnosticError(error), ...(error instanceof WindowsSnapshotError ? { partial: error.partial } : {}) }),
      ).finally(() => { pending = undefined })
    },
    async stop() {
      stopped = true
      await pending
    },
  }
}
