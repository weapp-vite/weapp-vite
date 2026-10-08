import process from 'node:process'

const wirePrefix = 'WEAPP_DEV_QUERY_V1'
const maxStderrCharacters = 16_384
const stages = ['script:begin', 'query:begin', 'query:end', 'serialize:begin', 'serialize:end', 'script:end'] as const

interface WindowsQueryMarker {
  stage: 'script' | 'query' | 'serialize'
  event: 'begin' | 'end'
  elapsedMs: number
}

/** 默认命令保持不变；显式诊断只在 stderr 写固定 ASCII 阶段与耗时。 */
export function createWindowsProcessQueryCommand(filter: string, trace: boolean) {
  const query = `@(Get-CimInstance Win32_Process${filter} | Select-Object ProcessId,ParentProcessId,ExecutablePath,@{Name='Started';Expression={if ($null -ne $_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString('o')} else {$null}}})`
  if (!trace) {
    return `$ErrorActionPreference='Stop'; ${query} | ConvertTo-Json -Compress`
  }
  const marker = (stage: typeof stages[number]) => `[Console]::Error.WriteLine('${wirePrefix}|${stage.replace(':', '|')}|'+$weappQueryClock.Elapsed.TotalMilliseconds.ToString('F3',[Globalization.CultureInfo]::InvariantCulture)+'|')`
  return [
    `$ErrorActionPreference='Stop'`,
    `[Console]::Error.WriteLine('${wirePrefix}|script|begin|0.000|')`,
    '$weappQueryClock=[System.Diagnostics.Stopwatch]::StartNew()',
    marker('query:begin'),
    `$weappQueryRows=${query}`,
    marker('query:end'),
    marker('serialize:begin'),
    '@($weappQueryRows) | ConvertTo-Json -Compress',
    marker('serialize:end'),
    marker('script:end'),
  ].join('; ')
}

/** 只接受完整且按顺序到达的有限阶段；原始 stderr 不进入报告。 */
export function parseWindowsQueryTrace(stderr = ''): WindowsQueryMarker[] {
  const markers: WindowsQueryMarker[] = []
  for (const line of stderr.slice(0, maxStderrCharacters).split(/\r?\n/)) {
    const match = /^WEAPP_DEV_QUERY_V1\|(script|query|serialize)\|(begin|end)\|(\d+(?:\.\d{1,3})?)\|$/.exec(line)
    if (!match || `${match[1]}:${match[2]}` !== stages[markers.length]) {
      continue
    }
    const elapsedMs = Number(match[3])
    if (!Number.isFinite(elapsedMs) || elapsedMs < (markers.at(-1)?.elapsedMs ?? 0)) {
      continue
    }
    markers.push({ stage: match[1] as WindowsQueryMarker['stage'], event: match[2] as WindowsQueryMarker['event'], elapsedMs })
    if (markers.length === stages.length) {
      break
    }
  }
  return markers
}

/** 查询失败仍报告已收到的阶段；诊断写入失败不覆盖正式查询结果。 */
export function reportWindowsQueryTrace(query: 'snapshot' | 'identities', result: { stdout?: string, stderr?: string, exitCode?: number, timedOut?: boolean }) {
  try {
    const stderr = result.stderr ?? ''
    const boundedStderr = stderr.slice(0, maxStderrCharacters)
    process.stdout.write(`[e2e-cleanup-query] ${JSON.stringify({
      query,
      exitCode: result.exitCode ?? null,
      timedOut: result.timedOut === true,
      stdoutCharacters: result.stdout?.length ?? 0,
      stderrCharacters: stderr.length,
      stderrTruncated: stderr.length > maxStderrCharacters,
      rawMarkerCount: boundedStderr.split(`${wirePrefix}|`).length - 1,
      scriptBeginReceived: boundedStderr.includes(`${wirePrefix}|script|begin|0.000|`),
      markers: parseWindowsQueryTrace(stderr),
    })}\n`)
  }
  catch {
    // 只忽略诊断输出自身的错误；调用方仍处理原查询退出状态和正文。
  }
}
