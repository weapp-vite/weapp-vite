import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowsProcessQueryCommand, parseWindowsQueryTrace, reportWindowsQueryTrace } from './windowsQueryTrace'

const begin = 'WEAPP_DEV_QUERY_V1|script|begin|0.000|'
const queryBegin = 'WEAPP_DEV_QUERY_V1|query|begin|1.250|'
const queryEnd = 'WEAPP_DEV_QUERY_V1|query|end|20.125|'
const serializeBegin = 'WEAPP_DEV_QUERY_V1|serialize|begin|20.500|'
const serializeEnd = 'WEAPP_DEV_QUERY_V1|serialize|end|25.000|'
const end = 'WEAPP_DEV_QUERY_V1|script|end|25.125|'

afterEach(() => vi.restoreAllMocks())

describe('Windows dev process query diagnostic', () => {
  it('preserves the uninstrumented query when the explicit trace is off', () => {
    expect(createWindowsProcessQueryCommand(' -Filter \'ProcessId > 0\'', false)).toBe('$ErrorActionPreference=\'Stop\'; @(Get-CimInstance Win32_Process -Filter \'ProcessId > 0\' | Select-Object ProcessId,ParentProcessId,ExecutablePath,@{Name=\'Started\';Expression={if ($null -ne $_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString(\'o\')} else {$null}}}) | ConvertTo-Json -Compress')
  })

  it('places CIM and serialization between their own markers without serializing diagnostics', () => {
    const command = createWindowsProcessQueryCommand(' -Filter \'ProcessId=61 OR ProcessId=62\'', true)
    expect(command.match(/Get-CimInstance/g)).toHaveLength(1)
    expect(command.match(/ConvertTo-Json/g)).toHaveLength(1)
    expect(command).toContain('-Filter \'ProcessId=61 OR ProcessId=62\'')
    expect(command.indexOf('|script|begin|')).toBeLessThan(command.indexOf('[System.Diagnostics.Stopwatch]::StartNew()'))
    expect(command.indexOf('|query|begin|')).toBeLessThan(command.indexOf('Get-CimInstance'))
    expect(command.indexOf('Get-CimInstance')).toBeLessThan(command.indexOf('|query|end|'))
    expect(command.indexOf('|serialize|begin|')).toBeLessThan(command.indexOf('ConvertTo-Json'))
    expect(command.indexOf('ConvertTo-Json')).toBeLessThan(command.indexOf('|serialize|end|'))
    expect(command).toContain('[Console]::Error.WriteLine')
    expect(command).toContain('ToString(\'F3\',[Globalization.CultureInfo]::InvariantCulture)')
  })

  it('retains complete CRLF markers received before a query timeout', () => {
    expect(parseWindowsQueryTrace(`${begin}\r\n${queryBegin}\r\n`)).toEqual([
      { stage: 'script', event: 'begin', elapsedMs: 0 },
      { stage: 'query', event: 'begin', elapsedMs: 1.25 },
    ])
  })

  it('accepts a final marker after the subprocess strips its final newline', () => {
    expect(parseWindowsQueryTrace([begin, queryBegin, queryEnd, serializeBegin, serializeEnd, end].join('\n'))).toEqual([
      { stage: 'script', event: 'begin', elapsedMs: 0 },
      { stage: 'query', event: 'begin', elapsedMs: 1.25 },
      { stage: 'query', event: 'end', elapsedMs: 20.125 },
      { stage: 'serialize', event: 'begin', elapsedMs: 20.5 },
      { stage: 'serialize', event: 'end', elapsedMs: 25 },
      { stage: 'script', event: 'end', elapsedMs: 25.125 },
    ])
  })

  it('rejects truncated, unknown, nonnumeric and out-of-order marker text', () => {
    const stderr = [
      'private error text',
      queryBegin,
      begin,
      'WEAPP_DEV_QUERY_V1|query|begin|NaN|',
      'WEAPP_DEV_QUERY_V1|query|begin|-1|',
      'WEAPP_DEV_QUERY_V1|query|begin|1.250',
      'WEAPP_DEV_QUERY_V1|unknown|begin|1.250|',
      queryBegin,
      'WEAPP_DEV_QUERY_V1|query|end|0.250|',
      queryEnd,
    ].join('\n')
    expect(parseWindowsQueryTrace(stderr)).toHaveLength(3)
    expect(parseWindowsQueryTrace()).toEqual([])
    expect(parseWindowsQueryTrace('private error only')).toEqual([])
  })

  it('bounds parsing and reports no fabricated completion stages', () => {
    expect(parseWindowsQueryTrace(`${'x'.repeat(16_384)}\n${begin}`)).toEqual([])
    expect(parseWindowsQueryTrace([begin, queryBegin, queryEnd, serializeBegin].join('\n')).at(-1)).toEqual({ stage: 'serialize', event: 'begin', elapsedMs: 20.5 })
  })

  it('reports only accepted markers and numeric process status on failure', () => {
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    reportWindowsQueryTrace('snapshot', { stderr: `${begin}\n${queryBegin}\nprivate error text`, timedOut: true })
    expect(output).toHaveBeenCalledOnce()
    const line = String(output.mock.calls[0]![0])
    expect(line).not.toContain('private error text')
    expect(JSON.parse(line.slice('[e2e-cleanup-query] '.length)) as unknown).toEqual({
      query: 'snapshot',
      exitCode: null,
      timedOut: true,
      stdoutCharacters: 0,
      stderrCharacters: `${begin}\n${queryBegin}\nprivate error text`.length,
      stderrTruncated: false,
      rawMarkerCount: 2,
      scriptBeginReceived: true,
      markers: [{ stage: 'script', event: 'begin', elapsedMs: 0 }, { stage: 'query', event: 'begin', elapsedMs: 1.25 }],
    })
  })

  it('distinguishes absent stderr from received markers with an invalid framing', () => {
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const stderr = `\uFEFF${begin}\r\n${queryBegin}`
    reportWindowsQueryTrace('snapshot', { timedOut: true })
    reportWindowsQueryTrace('snapshot', { stdout: 'partial', stderr, timedOut: true })
    const reports = output.mock.calls.map(([line]) => JSON.parse(String(line).slice('[e2e-cleanup-query] '.length)) as unknown)
    expect(reports[0]).toMatchObject({ stdoutCharacters: 0, stderrCharacters: 0, rawMarkerCount: 0, scriptBeginReceived: false, markers: [] })
    expect(reports[1]).toMatchObject({ stdoutCharacters: 7, stderrCharacters: stderr.length, rawMarkerCount: 2, scriptBeginReceived: true, markers: [] })
    expect(String(output.mock.calls[1]![0])).not.toContain(begin)
  })

  it('does not replace a query result when diagnostic output fails', () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw new Error('diagnostic stream closed')
    })
    expect(() => reportWindowsQueryTrace('identities', { stderr: begin, exitCode: 1 })).not.toThrow()
  })
})
