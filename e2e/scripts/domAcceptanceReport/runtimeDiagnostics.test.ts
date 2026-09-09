import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { evaluateExpectedErrors } from './expectedErrors'
import { RuntimeDiagnosticJournal } from './runtimeDiagnostics'

let directory: string
let file: string

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-diagnostics-'))
  file = path.join(directory, 'events.jsonl')
})

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true })
})

function append(text: string, level = 'error') {
  fs.appendFileSync(file, `${JSON.stringify({ source: 'runtime', kind: 'message', project: 'example', level, text })}\n`)
}

describe('acceptance runtime diagnostic journal', () => {
  it('excludes prior invocations and retains startup failures before a case is ready', () => {
    append('previous run')
    const journal = new RuntimeDiagnosticJournal(file)
    append('startup failure')
    journal.collect(null)
    append('interaction failure')
    journal.collect('case-a', true)
    expect(journal.entries).toMatchObject([
      { caseId: null, phase: 'outside-case', event: { text: 'startup failure' } },
      { caseId: 'case-a', phase: 'case', event: { text: 'interaction failure' } },
    ])
    expect(evaluateExpectedErrors([], journal.entries)).toEqual([
      'Unclassified IDE runtime error outside a case: startup failure',
      'Unclassified IDE runtime error in case-a: interaction failure',
    ])
  })

  it('retains informational logs without classifying them as failures', () => {
    const journal = new RuntimeDiagnosticJournal(file)
    append('startup ready', 'info')
    journal.collect(null, true)
    expect(journal.entries).toHaveLength(1)
    expect(journal.errors).toEqual([])
  })

  it('waits for a complete record and does not duplicate captured events', () => {
    const journal = new RuntimeDiagnosticJournal(file)
    fs.writeFileSync(file, '{"source":"build","kind":"message",')
    journal.collect(null)
    expect(journal.errors).toEqual([])
    fs.appendFileSync(file, '"project":"example","level":"error","text":"compile failed"}\r\n')
    journal.collect(null)
    journal.collect(null, true)
    expect(journal.entries).toHaveLength(1)
    expect(evaluateExpectedErrors([], journal.entries)).toEqual(['Unclassified IDE build error outside a case: compile failed'])
  })

  it('rejects malformed and incomplete records instead of silently dropping errors', () => {
    const journal = new RuntimeDiagnosticJournal(file)
    fs.writeFileSync(file, '{}\n{"source":')
    journal.collect(null, true)
    expect(journal.errors).toEqual([
      'IDE diagnostic event journal contains an invalid record',
      'IDE diagnostic event journal ends with an incomplete record',
    ])
  })

  it('detects truncated and deleted evidence files', () => {
    const journal = new RuntimeDiagnosticJournal(file)
    append('retained failure')
    journal.collect('case-a')
    fs.writeFileSync(file, '')
    journal.collect(null)
    append('new failure')
    journal.collect('case-b')
    fs.unlinkSync(file)
    journal.collect(null, true)
    expect(journal.entries).toHaveLength(2)
    expect(journal.errors).toContain('IDE diagnostic event journal was truncated during acceptance')
    expect(journal.errors).toContain('IDE diagnostic event journal disappeared during acceptance')
  })

  it('associates errors with action boundaries even when they are read after the operation', () => {
    const journal = new RuntimeDiagnosticJournal(file)
    const boundary = (phase: 'start' | 'end') => fs.appendFileSync(file, `${JSON.stringify({
      source: 'runtime',
      kind: 'message',
      project: 'base',
      level: 'debug',
      acceptanceScope: { id: 'scope-a', caseId: 'case-a', checkpointId: 'reject', boundary: phase },
    })}\n`)
    boundary('start')
    append('expected failure')
    boundary('end')
    append('outside failure')
    journal.collect(null, true)
    expect(journal.entries[1]).toMatchObject({ caseId: 'case-a', scopeId: 'scope-a', checkpointId: 'reject' })
    expect(journal.entries[3]).toMatchObject({ caseId: null, scopeId: undefined })
    expect(journal.errors).toEqual([])
  })

  it('rejects overlapping or unfinished action boundaries', () => {
    const journal = new RuntimeDiagnosticJournal(file)
    for (const id of ['scope-a', 'scope-b']) {
      fs.appendFileSync(file, `${JSON.stringify({ source: 'runtime', kind: 'message', project: 'base', level: 'debug', acceptanceScope: { id, caseId: 'case-a', checkpointId: 'reject', boundary: 'start' } })}\n`)
    }
    journal.collect(null, true)
    expect(journal.errors).toContain('IDE diagnostic scopes overlap')
    expect(journal.errors).toContain('IDE diagnostic scope did not finish')
  })
})
