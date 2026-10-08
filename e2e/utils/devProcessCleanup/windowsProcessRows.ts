import { Buffer } from 'node:buffer'

const header = 'WEAPP_DEV_PROCESS_ROWS_V1'

/** 固定字段保留 CIM 原值；UTF-16LE 编码路径，避免分隔符与 Unicode 改变身份。 */
export function serializeWindowsProcessRows() {
  const fields = '$weappChars=([string]$weappRow.ExecutablePath).ToCharArray(); $weappBytes=[byte[]]::new($weappChars.Length*2); [Buffer]::BlockCopy($weappChars,0,$weappBytes,0,$weappBytes.Length); $weappPath=[Convert]::ToBase64String($weappBytes); [Console]::Out.WriteLine(([string]$weappRow.ProcessId)+"`t"+([string]$weappRow.ParentProcessId)+"`t"+$weappPath+"`t"+([string]$weappRow.Started))'
  return [
    `[Console]::Out.WriteLine('${header}')`,
    `foreach ($weappRow in $weappQueryRows) { ${fields} }`,
    `[Console]::Out.WriteLine('${header}|'+$weappQueryRows.Count)`,
  ].join('; ')
}

/** 完整包络、行数及规范编码均有效才交给现有身份门禁，不接受部分输出。 */
export function parseWindowsProcessRows(output: string): unknown[] {
  const lines = output.replace(/\r?\n$/, '').split(/\r?\n/)
  if (lines.shift() !== header) {
    throw new Error('Windows process row envelope is missing.')
  }
  const tail = lines.pop()
  if (tail !== `${header}|${lines.length}`) {
    throw new Error('Windows process row count is incomplete.')
  }
  return lines.map((line) => {
    const fields = line.split('\t')
    const [pid, ppid, encoded, started] = fields
    if (fields.length !== 4 || !/^[1-9]\d*$/.test(pid!) || !/^(?:0|[1-9]\d*)$/.test(ppid!)
      || !/^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i.test(encoded!)) {
      throw new Error('Windows process row fields are invalid.')
    }
    const path = Buffer.from(encoded!, 'base64')
    if (path.length % 2 !== 0 || path.toString('base64') !== encoded) {
      throw new Error('Windows process path encoding is invalid.')
    }
    return { ProcessId: Number(pid), ParentProcessId: Number(ppid), ExecutablePath: path.toString('utf16le') || null, Started: started || null }
  })
}
