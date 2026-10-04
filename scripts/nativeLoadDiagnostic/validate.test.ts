import type { LoadMode } from './validate'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { MODES, PHASES, validateLoadTrace } from './validate'

function fixture(mode: LoadMode) {
  const rows: Array<Record<string, unknown>> = []
  let currentPhase = 'startup'
  const add = (kind: string, data = {}) => rows.push({ phase: currentPhase, version: 1, pid: process.pid, threadId: 0, seq: rows.length, elapsedMs: rows.length, mode, kind, ...data })
  add('started', { nativeEnabled: mode !== 'off', bindingConfigured: true })
  for (const phase of PHASES) {
    currentPhase = phase
    add('phase', { phase })
    if (phase === 'batch' && mode !== 'off') {
      add('binding-request')
      if (mode !== 'on-no-load') {
        add('load-start')
        add('load-success', { durationMs: 1, nodeModulesAdded: 1 })
      }
      if (mode !== 'actual') {
        add('fallbacks', { origin: 'channel' })
      }
    }
    if (mode === 'actual' && ['batch', 'parse-failure', 'recovery'].includes(phase)) {
      add('call', { origin: 'channel', batch: true, inputScripts: 2, inputBytes: 32 })
      add('binding-call', { method: 'analyzeScriptsNative' })
      add(phase === 'parse-failure' ? 'binding-exception' : 'binding-return', { method: 'analyzeScriptsNative', nullish: false })
      if (phase === 'parse-failure') {
        add('fallbacks', { origin: 'channel' })
      }
    }
    if (mode === 'actual' && ['cached-warning', 'repeat-last'].includes(phase)) {
      add('cacheHits', { origin: 'channel' })
    }
  }
  add('finished', { exitCode: 0, invalidEvents: 0 })
  return rows
}

const serialize = (rows: Array<Record<string, unknown>>) => rows.map(row => JSON.stringify(row)).join('\n')

describe('four-mode source evidence validation', () => {
  it.each(MODES)('accepts the complete %s trace without treating zero events as unknown process state', (mode) => {
    expect(validateLoadTrace(serialize(fixture(mode)), mode)).toMatchObject({ mode, completedProcesses: 1 })
  })

  it.each([
    ['phase disagreement', (rows: Array<Record<string, unknown>>) => { rows.find(row => row.kind === 'cacheHits')!.phase = 'batch' }],
    ['invalid call counts', (rows: Array<Record<string, unknown>>) => { rows.find(row => row.kind === 'call')!.inputBytes = -1 }],
    ['load completion out of order', (rows: Array<Record<string, unknown>>) => { rows.find(row => row.kind === 'load-start')!.kind = 'load-success' }],
    ['lost exit', (rows: Array<Record<string, unknown>>) => rows.pop()],
    ['wrong process', (rows: Array<Record<string, unknown>>) => { rows[1]!.pid = process.pid + 1 }],
    ['missing phase', (rows: Array<Record<string, unknown>>) => { rows[1]!.phase = 'unknown' }],
    ['reused binary', (rows: Array<Record<string, unknown>>) => { rows.find(row => row.kind === 'load-success')!.nodeModulesAdded = 0 }],
    ['invalid event', (rows: Array<Record<string, unknown>>) => { rows[1]!.kind = 'invalid-event' }],
    ['unobserved invalid event', (rows: Array<Record<string, unknown>>) => { rows.at(-1)!.invalidEvents = 1 }],
    ['nonzero exit', (rows: Array<Record<string, unknown>>) => { rows.at(-1)!.exitCode = 1 }],
    ['no exception', (rows: Array<Record<string, unknown>>) => { rows.find(row => row.kind === 'binding-exception')!.kind = 'binding-return' }],
    ['non-finite clock', (rows: Array<Record<string, unknown>>) => { rows[1]!.elapsedMs = Number.NaN }],
  ] as const)('rejects %s', (_label, mutate) => {
    const rows = fixture('actual')
    mutate(rows)
    expect(() => validateLoadTrace(serialize(rows), 'actual')).toThrow()
  })

  it('rejects extra native fallback on valid input even when outputs could still agree', () => {
    const rows = fixture('actual')
    const index = rows.findIndex(row => row.kind === 'phase' && row.phase === 'cached-warning')
    rows.splice(index, 0, { ...rows[index - 1], kind: 'fallbacks', origin: 'channel' })
    rows.forEach((row, index) => {
      row.seq = index
      row.elapsedMs = index
    })
    expect(() => validateLoadTrace(serialize(rows), 'actual')).toThrow('Unexpected valid-source')
  })

  it('rejects import-time native work', () => {
    const rows = fixture('actual')
    rows.find(row => row.kind === 'phase' && row.phase === 'import')!.kind = 'binding-request'
    expect(() => validateLoadTrace(serialize(rows), 'actual')).toThrow()
  })
})
