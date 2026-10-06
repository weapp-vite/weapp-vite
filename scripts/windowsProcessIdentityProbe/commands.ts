import { ENTRY_MARKER, TIMING_MARKER } from './identity'

export function cimCommand(pid: number) {
  return `$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object ProcessId,ExecutablePath,@{Name='Started';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress`
}

/** 脚本入口与查询分别计时；诊断不修改生产命令或其十秒预算。 */
function measuredCommand(query: string) {
  return `
[Console]::Error.WriteLine('${ENTRY_MARKER}')
[Console]::Error.Flush()
$ErrorActionPreference='Stop'
$probeFailed=$false
$probeQuery=[System.Diagnostics.Stopwatch]::StartNew()
try {
  $probePayload=& {
${query}
  }
}
catch {
  $probeFailed=$true
  $probeException=$_.Exception.GetBaseException()
  $probePayload=[pscustomobject]@{
    ErrorType=$probeException.GetType().FullName
    HResult=$probeException.HResult
    NativeErrorCode=$(if ($probeException -is [System.ComponentModel.Win32Exception]) {$probeException.NativeErrorCode} else {$null})
  }
}
finally { $probeQuery.Stop() }
$probeSerialization=[System.Diagnostics.Stopwatch]::StartNew()
if ($null -ne $probePayload) {
  [Console]::Out.Write(($probePayload | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}
$probeSerialization.Stop()
$probeTiming=[pscustomobject]@{queryMs=$probeQuery.Elapsed.TotalMilliseconds; serializationMs=$probeSerialization.Elapsed.TotalMilliseconds}
[Console]::Error.WriteLine('${TIMING_MARKER}'+($probeTiming | ConvertTo-Json -Compress))
[Console]::Error.Flush()
if ($probeFailed) { exit 1 }
`
}

export function measuredCimCommand(pid: number) {
  return measuredCommand(cimCommand(pid).replace(/^\$ErrorActionPreference='Stop'; /, '').replace(/ \| ConvertTo-Json -Compress$/, ''))
}

/** 候选仅供对照；只有初始 lookup 的明确缺失返回空输出，字段读取异常仍失败。 */
export function candidateCommand(pid: number) {
  return measuredCommand(`
$target=$null
$second=$null
try {
  try { $target=[System.Diagnostics.Process]::GetProcessById(${pid}) }
  catch {
    if ($_.Exception.GetBaseException() -is [System.ArgumentException]) { return $null }
    throw
  }
  $before=$target.StartTime.ToUniversalTime()
  $executable=$target.MainModule.FileName
  $second=[System.Diagnostics.Process]::GetProcessById(${pid})
  $after=$second.StartTime.ToUniversalTime()
  $hasExited=$target.HasExited -or $second.HasExited
  if ($target.Id -ne ${pid} -or $second.Id -ne ${pid} -or [string]::IsNullOrWhiteSpace($executable) -or $before.Ticks -ne $after.Ticks) {
    throw [System.InvalidOperationException]::new('Incomplete or changed process identity')
  }
  if ($hasExited) { throw [System.InvalidOperationException]::new('Process exited during identity inspection') }
  $legacyTicks=[long]($before.Ticks - ($before.Ticks % 10))
  $legacyStarted=[DateTime]::new($legacyTicks,[DateTimeKind]::Utc).ToString('o')
  [pscustomobject]@{
    ProcessId=$target.Id
    ExecutablePath=$executable
    Started=$before.ToString('o')
    LegacyStarted=$legacyStarted
    StartedAfter=$after.ToString('o')
    TicksBefore=$before.Ticks.ToString()
    TicksAfter=$after.Ticks.ToString()
    GenerationStable=($before.Ticks -eq $after.Ticks)
    HasExited=$hasExited
  }
}
finally {
  if ($null -ne $second) { $second.Dispose() }
  if ($null -ne $target) { $target.Dispose() }
}`)
}
