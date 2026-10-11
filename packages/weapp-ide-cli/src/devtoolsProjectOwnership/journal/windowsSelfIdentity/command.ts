import { SELF_IDENTITY_WIRE } from './wire'

/** 当前 writer 的 PID 由 Node 进程提供；脚本只读查询，不执行任何进程或 IDE 清理。 */
export function windowsSelfIdentityCommand(pid: number) {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new TypeError('A positive writer PID is required.')
  }
  return `
$ErrorActionPreference='Stop'
$writerFirst=$null
$writerSecond=$null
$writerExitCode=0
try {
  $writerFirst=[System.Diagnostics.Process]::GetProcessById(${pid})
  $writerBefore=$writerFirst.StartTime.ToUniversalTime()
  $writerExecutable=$writerFirst.MainModule.FileName
  $writerSecond=[System.Diagnostics.Process]::GetProcessById(${pid})
  $writerAfter=$writerSecond.StartTime.ToUniversalTime()
  if ($writerFirst.Id -ne ${pid} -or $writerSecond.Id -ne ${pid} -or [string]::IsNullOrWhiteSpace($writerExecutable) -or $writerBefore.Ticks -ne $writerAfter.Ticks) {
    throw [System.InvalidOperationException]::new('Incomplete or changed writer identity')
  }
  if ($writerFirst.HasExited -or $writerSecond.HasExited) {
    throw [System.InvalidOperationException]::new('Writer exited during identity inspection')
  }
  $writerLegacyTicks=[long]($writerBefore.Ticks - ($writerBefore.Ticks % 10))
  $writerStarted=[DateTime]::new($writerLegacyTicks,[DateTimeKind]::Utc).ToString('o',[Globalization.CultureInfo]::InvariantCulture)
  $writerPath=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($writerExecutable))
  $writerFields=@('${SELF_IDENTITY_WIRE}','present','${pid}',$writerBefore.Ticks.ToString([Globalization.CultureInfo]::InvariantCulture),$writerAfter.Ticks.ToString([Globalization.CultureInfo]::InvariantCulture),'false',$writerStarted,$writerPath)
  [Console]::Out.WriteLine([string]::Join([string][char]9,[string[]]$writerFields))
  [Console]::Out.Flush()
}
catch {
  $writerExitCode=1
  $writerError=$_.Exception.GetBaseException()
  [Console]::Error.WriteLine('${SELF_IDENTITY_WIRE}:error:'+ $writerError.GetType().FullName + ':' + $writerError.HResult.ToString([Globalization.CultureInfo]::InvariantCulture))
}
finally {
  if ($null -ne $writerSecond) { $writerSecond.Dispose() }
  if ($null -ne $writerFirst) { $writerFirst.Dispose() }
}
exit $writerExitCode
`
}
