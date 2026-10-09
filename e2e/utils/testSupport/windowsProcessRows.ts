import { Buffer } from 'node:buffer'

interface FixtureProcessRow {
  ProcessId: number
  ParentProcessId: number
  ExecutablePath: string | null
  Started: string | null
}

/** 模拟 PowerShell 固定行输出，保留未知身份与完整 UTF-16 路径。 */
export function fixtureWindowsProcessRows(entries: FixtureProcessRow[]) {
  return [
    'WEAPP_DEV_PROCESS_ROWS_V1',
    ...entries.map(entry => [entry.ProcessId, entry.ParentProcessId, Buffer.from(entry.ExecutablePath ?? '', 'utf16le').toString('base64'), entry.Started ?? ''].join('\t')),
    `WEAPP_DEV_PROCESS_ROWS_V1|${entries.length}`,
  ].join('\n')
}
