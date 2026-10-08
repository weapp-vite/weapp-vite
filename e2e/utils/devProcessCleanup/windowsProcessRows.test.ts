import { Buffer } from 'node:buffer'
import { expect, it } from 'vitest'
import { parseWindowsProcessRows, serializeWindowsProcessRows } from './windowsProcessRows'

const header = 'WEAPP_DEV_PROCESS_ROWS_V1'
const started = '2026-10-08T00:00:00.1234560Z'

it.each(['\n', '\r\n'])('preserves paths, parent generations and missing identity through %j framing', (newline) => {
  const executable = '工具 folder/quote"tab\tline\n😀\uD800.exe'
  const encoded = Buffer.from(executable, 'utf16le').toString('base64')
  const output = [header, `61\t1\t${encoded}\t${started}`, '62\t61\t\t', `${header}|2`].join(newline)
  expect(parseWindowsProcessRows(output)).toEqual([
    { ProcessId: 61, ParentProcessId: 1, ExecutablePath: executable, Started: started },
    { ProcessId: 62, ParentProcessId: 61, ExecutablePath: null, Started: null },
  ])
  expect(parseWindowsProcessRows(`${output}${newline}`)).toEqual(parseWindowsProcessRows(output))
})

it('requires an explicit empty envelope rather than treating absent output as no process', () => {
  expect(parseWindowsProcessRows(`${header}\n${header}|0`)).toEqual([])
  expect(() => parseWindowsProcessRows('')).toThrow('envelope')
})

it.each([
  `${header}\n61\t1\t\t${started}`,
  `${header}\n61\t1\t\t${started}\n${header}|2`,
  `${header}\n61\t1\t\t${started}\n${header}|1\nextra`,
  `${header}\n61\t1\t!\t${started}\n${header}|1`,
  `${header}\n61\t1\tYQ==\t${started}\n${header}|1`,
  `${header}\n61\t1\tYR==\t${started}\n${header}|1`,
  `${header}\n61\t1\t\t${started}\textra\n${header}|1`,
  `${header}\n61\t-1\t\t${started}\n${header}|1`,
])('rejects incomplete or invalid rows before identity validation: %j', (output) => {
  expect(() => parseWindowsProcessRows(output)).toThrow()
})

it('serializes the same selected fields without a generic JSON serializer', () => {
  const script = serializeWindowsProcessRows()
  expect(script).not.toContain('ConvertTo-Json')
  expect(script).not.toContain('Get-CimInstance')
  expect(script).toContain('[Text.Encoding]::Unicode.GetBytes')
  for (const field of ['ProcessId', 'ParentProcessId', 'ExecutablePath', 'Started']) {
    expect(script).toContain(`$weappRow.${field}`)
  }
  expect(script).toContain('$weappQueryRows.Count')
})
