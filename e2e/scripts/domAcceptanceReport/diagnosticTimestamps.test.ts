import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateDiagnosticTimestamps, RuntimeDiagnosticJournal } from './runtimeDiagnostics'

const directories: string[] = []
afterEach(() => {
  vi.useRealTimers()
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostic-time-'))
  directories.push(directory)
  return path.join(directory, 'events.jsonl')
}

describe('diagnostic event times', () => {
  it('preserves producer time when several events are collected later', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:01:00Z'))
    const file = fixture()
    const journal = new RuntimeDiagnosticJournal(file, true)
    for (const recordedAt of ['2026-09-01T00:00:01.000Z', '2026-09-01T00:00:02.000Z']) {
      fs.appendFileSync(file, `${JSON.stringify({ recordedAt, source: 'runtime', kind: 'message', project: 'fixture', level: 'info', text: 'startup' })}\n`)
    }
    journal.collect(null, true)
    expect(journal.entries.map(entry => [entry.recordedAt, entry.observedAt, entry.collectedAt])).toEqual([
      ['2026-09-01T00:00:01.000Z', '2026-09-01T00:00:01.000Z', '2026-09-01T00:01:00.000Z'],
      ['2026-09-01T00:00:02.000Z', '2026-09-01T00:00:02.000Z', '2026-09-01T00:01:00.000Z'],
    ])
    expect(journal.errors).toEqual([])
  })
  it('retains legacy events but refuses to certify their read time as their recorded time', () => {
    const file = fixture()
    const journal = new RuntimeDiagnosticJournal(file, true)
    fs.writeFileSync(file, `${JSON.stringify({ source: 'runtime', kind: 'message', project: 'fixture', level: 'error', text: 'retained failure' })}\n`)
    journal.collect(null, true)
    expect(journal.entries[0]?.recordedAt).toBeNull()
    expect(journal.entries[0]?.event.text).toBe('retained failure')
    expect(journal.errors).toHaveLength(1)
    expect(evaluateDiagnosticTimestamps(journal.entries)).toHaveLength(1)
  })
})
