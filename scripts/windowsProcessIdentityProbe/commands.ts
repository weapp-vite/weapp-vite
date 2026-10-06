export function cimCommand(pid: number) {
  return `$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object ProcessId,ExecutablePath,@{Name='Started';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress`
}

/** 候选仅供对照；只有初始 lookup 的明确缺失返回空输出，字段读取异常仍失败。 */
export function candidateCommand(pid: number) {
  return `
$ErrorActionPreference='Stop'
$target=$null
$second=$null
try {
  try { $target=[System.Diagnostics.Process]::GetProcessById(${pid}) }
  catch {
    if ($_.Exception.GetBaseException() -is [System.ArgumentException]) { exit 0 }
    throw
  }
  $before=$target.StartTime.ToUniversalTime()
  $executable=$target.MainModule.FileName
  $second=[System.Diagnostics.Process]::GetProcessById(${pid})
  $after=$second.StartTime.ToUniversalTime()
  if ($target.Id -ne ${pid} -or $second.Id -ne ${pid} -or [string]::IsNullOrWhiteSpace($executable) -or $before.Ticks -ne $after.Ticks) {
    throw [System.InvalidOperationException]::new('Incomplete or changed process identity')
  }
  [pscustomobject]@{
    ProcessId=$target.Id
    ExecutablePath=$executable
    Started=$before.ToString('o')
    StartedAfter=$after.ToString('o')
    TicksBefore=$before.Ticks.ToString()
    TicksAfter=$after.Ticks.ToString()
    GenerationStable=($before.Ticks -eq $after.Ticks)
    HasExited=$target.HasExited
  } | ConvertTo-Json -Compress
}
catch {
  [pscustomobject]@{ErrorType=$_.Exception.GetBaseException().GetType().FullName; HResult=$_.Exception.GetBaseException().HResult} | ConvertTo-Json -Compress
  exit 1
}
finally {
  if ($null -ne $second) { $second.Dispose() }
  if ($null -ne $target) { $target.Dispose() }
}`
}
