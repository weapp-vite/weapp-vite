import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { compareIdentities, ENTRY_MARKER, legacyStartedText, readIdentity, readTimingMarker, redact, summarizeIdentity, TIMING_MARKER } from './identity'
import { observeProbePhases } from './phases'

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

  it('compares the reported legacy value exactly while retaining the raw 100ns mismatch', () => {
    const candidate = { ...cim, Started: '2026-10-07T01:02:03.1234567Z', LegacyStarted: cim.Started, StartedAfter: '2026-10-07T01:02:03.1234567Z', TicksBefore: '639269317231234567', TicksAfter: '639269317231234567', GenerationStable: true, HasExited: false }
    expect(compareIdentities(cim, candidate)).toMatchObject({ startedExactEqual: false, legacyStartedExactEqual: true, legacyStartedMatchesRaw: true, candidateContractAgrees: true })
    expect(compareIdentities(cim, { ...candidate, LegacyStarted: '2026-10-07T01:02:03.1234570Z' })).toMatchObject({ legacyStartedExactEqual: false, legacyStartedMatchesRaw: false })
    expect(compareIdentities(cim, { ...candidate, TicksAfter: '639269317231234568' }).candidateContractAgrees).toBe(false)
    expect(compareIdentities(cim, { ...candidate, HasExited: true }).candidateContractAgrees).toBe(false)
    expect(compareIdentities(cim, { ...candidate, ExecutablePath: executable.toLowerCase() }).candidateContractAgrees).toBe(false)
    expect(legacyStartedText('2026-10-07T01:02:03.9999999Z')).toBe('2026-10-07T01:02:03.9999990Z')
    expect(legacyStartedText('2026-10-07T01:02:03.123Z')).toBeUndefined()
    expect(legacyStartedText('2026-10-07T01:02:03.1234567+00:00')).toBeUndefined()
  })

  it('accepts only finite nonnegative phase timings from the diagnostic marker', () => {
    expect(readTimingMarker(`${TIMING_MARKER}{"queryMs":6012.25,"serializationMs":2.5}`)).toEqual({ queryMs: 6012.25, serializationMs: 2.5 })
    for (const line of ['unrelated stderr', `${TIMING_MARKER}not-json`, `${TIMING_MARKER}{"queryMs":-1,"serializationMs":0}`, `${TIMING_MARKER}{"queryMs":"12","serializationMs":0}`, `${TIMING_MARKER}{"queryMs":1e999,"serializationMs":0}`, `${TIMING_MARKER}{"queryMs":1}`]) {
      expect(readTimingMarker(line)).toBeUndefined()
    }
  })

  it('preserves partial phase evidence and handles split markers and final lines', () => {
    const stream = new PassThrough()
    const updates: Record<string, unknown>[] = []
    let elapsedMs = 0
    const phases = observeProbePhases(stream, () => elapsedMs, fields => updates.push(fields))
    stream.write(ENTRY_MARKER.slice(0, 10))
    expect(updates).toEqual([])
    elapsedMs = 21
    stream.write(`${ENTRY_MARKER.slice(10)}\r\n`)
    expect(updates).toEqual([expect.objectContaining({ scriptEntryMs: 21, phaseEvidenceComplete: false })])
    stream.write(`${TIMING_MARKER}{"queryMs":6000,"serializationMs":2}`)
    expect(phases.finish()).toMatchObject({ scriptEntryMs: 21, queryBodyMs: 6000, serializationMs: 2, phaseEvidenceComplete: true })
    stream.write(`${ENTRY_MARKER}\n`)
    expect(updates).toHaveLength(2)
    stream.destroy()
  })

  it('does not mark duplicate or invalid phase markers as complete evidence', () => {
    const valid = `${TIMING_MARKER}{"queryMs":2,"serializationMs":0}`
    for (const lines of [[valid, valid], [`${TIMING_MARKER}invalid`], [`${TIMING_MARKER}invalid`, valid]]) {
      const stream = new PassThrough()
      const phases = observeProbePhases(stream, () => 1, () => {})
      stream.write(`${[ENTRY_MARKER, ...lines].join('\n')}\n`)
      expect(phases.finish()).toMatchObject({ timingMarkerCount: lines.length, phaseEvidenceComplete: false })
      stream.destroy()
    }
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
