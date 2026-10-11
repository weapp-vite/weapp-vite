import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { parseCliBuildMs } from '../cliTiming'
import { AUTO_IMPORT_BUILD_HOOK_PREFIX } from './hooks'
import { readBuildHookEvidence, readBuildTimingEvidence, saveAutoImportBuildDiagnostics } from './output'

const started = { id: 1, pluginIndex: 0, pluginName: 'publication', hookName: 'generateBundle', status: 'started', timeOrigin: 1_000, startedAtMs: 10 }
const completed = { ...started, status: 'completed', endedAtMs: 30, elapsedMs: 20 }
const line = (event: object) => `${AUTO_IMPORT_BUILD_HOOK_PREFIX}${JSON.stringify(event)}`

it('retains the original first match and all subsequent CLI timing texts without changing parsing', () => {
  const stdout = 'vite building...\r\n✓ built in 541ms.\r\n小程序构建完成，耗时：0.772 s\r\n'
  const stderr = 'other output'
  expect(readBuildTimingEvidence(stdout, stderr)).toEqual({
    cliBuildMs: parseCliBuildMs(`${stdout}\n${stderr}`),
    matchedText: 'built in 541ms',
    matches: [
      { text: 'built in 541ms', index: stdout.indexOf('built in'), milliseconds: 541 },
      { text: '耗时：0.772 s', index: stdout.indexOf('耗时：'), milliseconds: 772 },
    ],
  })
  expect(readBuildTimingEvidence('no timing', '')).toEqual({ cliBuildMs: null, matchedText: null, matches: [] })
})

it('keeps unknown finishes, clock gaps and malformed diagnostic lines incomplete', () => {
  expect(readBuildHookEvidence([line(started), line(completed)].join('\r\n'))).toEqual({ events: [started, completed], errors: [] })
  expect(readBuildHookEvidence(line(started)).errors).toContain('Incomplete hook boundary: 1')
  expect(readBuildHookEvidence(line(completed)).errors).toContain('Missing build hook boundaries')
  expect(readBuildHookEvidence(`${AUTO_IMPORT_BUILD_HOOK_PREFIX}not-json`).errors).toContain('Malformed build hook diagnostic line')
  expect(readBuildHookEvidence([line(started), line({ ...completed, elapsedMs: null })].join('\n')).errors).toContain('Incomplete hook boundary: 1')
})

it('rejects duplicate starts, finishes before starts and drifting boundary identity or clocks', () => {
  expect(readBuildHookEvidence([line(started), line(started), line(completed)].join('\n')).errors).toContain('Duplicate hook start: 1')
  expect(readBuildHookEvidence([line(completed), line(started)].join('\n')).errors).toContain('Hook finish precedes start: 1')
  for (const change of [{ pluginIndex: 1 }, { timeOrigin: 2_000 }, { startedAtMs: 11 }, { moduleId: 'virtual:changed' }, { endedAtMs: 9 }, { elapsedMs: 19 }, { status: 'failed' }]) {
    expect(readBuildHookEvidence([line(started), line({ ...completed, ...change })].join('\n')).errors).toContain('Incomplete hook boundary: 1')
  }
  for (const change of [{ pluginIndex: -1 }, { id: 0 }, { hookName: 'unknownHook' }, { moduleId: {} }]) {
    expect(readBuildHookEvidence(line({ ...started, ...change })).errors).toContain('Malformed build hook diagnostic line')
  }
})

it('persists separate captured streams, source timing text and raw hook records after measurement', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-diagnostic-output-'))
  const stdout = ['/checkout/project/src/index.ts', line(started), line(completed), 'built in 541ms'].join('\n')
  try {
    await saveAutoImportBuildDiagnostics(directory, { status: 'completed', stdout, stderr: 'warning', durationMs: 1_459 }, [{ path: '/checkout/project', label: '<project>' }])
    expect(await readFile(path.join(directory, 'stdout.log'), 'utf8')).toBe(stdout.replace('/checkout/project', '<project>'))
    expect(await readFile(path.join(directory, 'stderr.log'), 'utf8')).toBe('warning')
    const report = JSON.parse(await readFile(path.join(directory, 'diagnostic.json'), 'utf8')) as { durationMs: number, timing: { cliBuildMs: number, matchedText: string }, hooks: { events: unknown[], errors: string[] } }
    expect(report).toMatchObject({ durationMs: 1_459, timing: { cliBuildMs: 541, matchedText: 'built in 541ms' }, hooks: { events: [started, completed], errors: [] } })
    expect(report).not.toHaveProperty('stdout')
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
