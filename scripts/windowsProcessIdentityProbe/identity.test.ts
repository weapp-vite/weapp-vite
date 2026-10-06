import { describe, expect, it } from 'vitest'
import { compareIdentities, readIdentity, redact, summarizeIdentity } from './identity'

const executable = 'C:\\Program Files\\nodejs\\node.exe'
const cim = { ProcessId: 42, ExecutablePath: executable, Started: '2026-10-07T01:02:03.1234560Z' }

describe('Windows identity diagnostic evidence', () => {
  it('keeps a 100ns identity mismatch visible even when microsecond text agrees', () => {
    const candidate = { ...cim, Started: '2026-10-07T01:02:03.1234567Z', StartedAfter: '2026-10-07T01:02:03.1234567Z', TicksBefore: '639269317231234567', GenerationStable: true, HasExited: false }
    expect(compareIdentities(cim, candidate)).toMatchObject({ startedExactEqual: false, startedMicrosecondTextEqual: true, candidateGenerationStable: true })
    expect(summarizeIdentity(candidate, executable)).toMatchObject({ started: candidate.Started, ticksBefore: candidate.TicksBefore, ticksModulo10: '7' })
  })

  it('does not turn path casing or different generations into exact equality', () => {
    expect(compareIdentities(cim, { ...cim, ExecutablePath: executable.toLowerCase(), Started: '2026-10-07T01:02:04.1234560Z' })).toMatchObject({
      executableExactEqual: false,
      executableCaseInsensitiveEqual: true,
      startedExactEqual: false,
      startedMicrosecondTextEqual: false,
    })
    expect(compareIdentities(cim, { ...cim, ProcessId: 43 }).pidExactEqual).toBe(false)
  })

  it('requires the requested PID and every existing production identity field', () => {
    for (const value of [undefined, null, {}, { ...cim, ProcessId: 43 }, { ...cim, ExecutablePath: '' }, { ...cim, Started: '' }]) {
      expect(readIdentity(value, 42)).toBeUndefined()
    }
    expect(readIdentity(cim, 42)).toEqual(cim)
  })

  it('redacts absolute drive and UNC paths while retaining diagnostic error categories', () => {
    const text = 'AccessDenied\r\nC:\\private\\project\\file.ts:42\r\nModuleError\n\\\\server\\share\\private\nTimeout'
    expect(redact(text)).toBe('AccessDenied\r\n<absolute-path>\r\nModuleError\n<unc-path>\nTimeout')
    const summary = summarizeIdentity(cim, executable)
    expect(JSON.stringify(summary)).not.toContain(executable)
    expect(summary.executableSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(summary.executableMatchesNodeExactly).toBe(true)
  })
})
