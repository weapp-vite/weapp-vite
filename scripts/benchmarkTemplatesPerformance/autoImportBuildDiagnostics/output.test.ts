import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { parseCliBuildMs } from '../cliTiming'
import { AUTO_IMPORT_BUILD_HOOK_PREFIX } from './hooks'
import { readBuildHookEvidence, readBuildTimingEvidence, saveAutoImportBuildDiagnostics } from './output'

const started = { id: 1, pluginIndex: 0, pluginName: 'publication', hookName: 'generateBundle', status: 'started', timeOrigin: 1_000, startedAtMs: 10 }
const completed = { ...started, status: 'completed', endedAtMs: 30, elapsedMs: 20 }
const terminal = { kind: 'producer-end', schemaVersion: 2, lastAssignedId: 1, pendingIds: [], timeOrigin: 1_000, endedAtMs: 30, drained: true, finalCloseHook: true }
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
  expect(readBuildHookEvidence([line(started), line(completed), line(terminal)].join('\r\n'))).toEqual({ events: [started, completed], terminal, errors: [] })
  expect(readBuildHookEvidence(line(started)).errors).toContain('Incomplete hook boundary: 1')
  expect(readBuildHookEvidence(line(completed)).errors).toContain('Missing build hook boundaries')
  expect(readBuildHookEvidence(`${AUTO_IMPORT_BUILD_HOOK_PREFIX}not-json`).errors).toContain('Malformed build hook diagnostic line')
  expect(readBuildHookEvidence([line(started), line({ ...completed, elapsedMs: null })].join('\n')).errors).toContain('Incomplete hook boundary: 1')
})

it('requires a drained producer terminal and detects missing middle or trailing invocation pairs', () => {
  const records = [line(started), line(completed)]
  expect(readBuildHookEvidence(records.join('\n')).errors).toContain('Missing producer terminal record')
  const third = [{ ...started, id: 3 }, { ...completed, id: 3 }].map(line)
  expect(readBuildHookEvidence([...records, ...third, line({ ...terminal, lastAssignedId: 3 })].join('\n')).errors).toContain('Missing hook invocation IDs: 2-2')
  expect(readBuildHookEvidence([...records, line({ ...terminal, lastAssignedId: 3 })].join('\n')).errors).toContain('Missing hook invocation IDs: 2-3')
  for (const change of [{ drained: false }, { finalCloseHook: false }, { pendingIds: [1] }, { timeOrigin: 2_000 }, { endedAtMs: 29 }, { lastAssignedId: 0 }]) {
    expect(readBuildHookEvidence([...records, line({ ...terminal, ...change })].join('\n')).errors).toContain('Incomplete producer terminal boundary')
  }
  expect(readBuildHookEvidence([...records, line(terminal), line(terminal)].join('\n')).errors).toContain('Duplicate producer terminal record')
  expect(readBuildHookEvidence([...records, line(terminal), line({ ...started, id: 2 })].join('\n')).errors).toContain('Hook event follows producer terminal: 2')
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
  const stdout = ['/checkout/project/src/index.ts', line(started), line(completed), line(terminal), 'built in 541ms'].join('\n')
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

it('round-trips serialized virtual IDs and escapes while redacting only known checkout roots', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-diagnostic-escaped-output-'))
  const root = 'C:\\checkout\\project'
  const forwardRoot = 'C:/checkout/project'
  const moduleIds = ['\0weapp:entry?x=1', 'virtual:literal\\n\\u0000\\path?quote="value"&line=\nnext']
  const events = moduleIds.flatMap((moduleId, index) => {
    const start = { ...started, id: index + 1, moduleId, pluginName: 'compiler:"quoted"\\helper\nline' }
    return [start, { ...start, status: 'completed', endedAtMs: 30, elapsedMs: 20 }]
  })
  const end = { ...terminal, lastAssignedId: moduleIds.length }
  const stdout = [`${root}\\src\\index.ts`, `${forwardRoot}/src/index.ts`, ...events.map(line), line(end), 'built in 541ms', ''].join('\r\n')
  const warning = { path: `${root}\\src\\index.ts`, note: 'literal\\n\\u0000\\path\n"quoted"' }
  const stderr = `${JSON.stringify(warning)}\n`
  try {
    await saveAutoImportBuildDiagnostics(directory, { status: 'completed', stdout, stderr, durationMs: 1_459 }, [{ path: root, label: '<project>' }])
    const savedStdout = await readFile(path.join(directory, 'stdout.log'), 'utf8')
    const savedStderr = await readFile(path.join(directory, 'stderr.log'), 'utf8')
    expect(savedStdout).toBe(stdout.replaceAll(root, '<project>').replaceAll(forwardRoot, '<project>'))
    expect(savedStderr).toBe(`${JSON.stringify({ ...warning, path: '<project>\\src\\index.ts' })}\n`)
    expect(savedStdout.split('\r\n').filter(record => record.startsWith(AUTO_IMPORT_BUILD_HOOK_PREFIX))).toEqual([...events.map(line), line(end)])
    const captured = readBuildHookEvidence(stdout)
    const saved = readBuildHookEvidence(savedStdout)
    const report = JSON.parse(await readFile(path.join(directory, 'diagnostic.json'), 'utf8')) as { hooks: ReturnType<typeof readBuildHookEvidence>, timing: ReturnType<typeof readBuildTimingEvidence> }
    expect(captured.errors).toEqual([])
    expect(saved).toEqual(captured)
    expect(saved.events).toEqual(events)
    expect(report.hooks).toEqual(captured)
    expect(report.timing).toEqual(readBuildTimingEvidence(stdout, stderr))
    expect(stdout).toContain(root)
    expect(stderr).toBe(`${JSON.stringify(warning)}\n`)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it.each(['windows', 'posix'] as const)('keeps saved logs and structured evidence equally private for %s roots in legal string fields', async (platform) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-diagnostic-private-fields-'))
  const checkout = platform === 'windows' ? 'C:\\checkout' : '/checkout'
  const separator = platform === 'windows' ? '\\' : '/'
  const project = `${checkout}${separator}project`
  const start = { ...started, pluginName: `owner:"${project}"\\config\nline`, moduleId: `\0virtual:${project}${separator}entry?literal=\\n&quote="value"` }
  const finish = { ...start, status: 'failed', endedAtMs: 30, elapsedMs: 20, errorName: `failure:${checkout}\\custom\n"quoted"` }
  const stdout = [`${project}${separator}src${separator}index.ts`, line(start), line(finish), line(terminal), 'built in 541ms', ''].join('\r\n')
  const stderr = [`warning:${project}`, JSON.stringify({ path: project, note: 'literal\\u0000\n"quoted"' }), ''].join('\n')
  const output = { status: 'completed' as const, stdout, stderr, durationMs: 1_459 }
  const original = structuredClone(output)
  try {
    await saveAutoImportBuildDiagnostics(directory, output, [{ path: checkout, label: '<checkout>' }, { path: project, label: '<project>' }])
    const savedStdout = await readFile(path.join(directory, 'stdout.log'), 'utf8')
    const savedStderr = await readFile(path.join(directory, 'stderr.log'), 'utf8')
    const reportText = await readFile(path.join(directory, 'diagnostic.json'), 'utf8')
    const report = JSON.parse(reportText) as { hooks: ReturnType<typeof readBuildHookEvidence>, timing: ReturnType<typeof readBuildTimingEvidence> }
    const saved = readBuildHookEvidence(savedStdout)
    expect(saved.errors).toEqual([])
    expect(report.hooks).toEqual(saved)
    expect(saved.events).toEqual([
      { ...start, pluginName: 'owner:"<project>"\\config\nline', moduleId: `\0virtual:<project>${separator}entry?literal=\\n&quote="value"` },
      { ...finish, pluginName: 'owner:"<project>"\\config\nline', moduleId: `\0virtual:<project>${separator}entry?literal=\\n&quote="value"`, errorName: 'failure:<checkout>\\custom\n"quoted"' },
    ])
    for (const text of [savedStdout, savedStderr, reportText]) {
      for (const root of [checkout, project]) {
        expect(text).not.toContain(root)
        expect(text).not.toContain(JSON.stringify(root).slice(1, -1))
      }
    }
    expect(report.timing).toEqual(readBuildTimingEvidence(stdout, stderr))
    expect(output).toEqual(original)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it.each(['windows', 'posix'] as const)('redacts the registered %s root in a failed capture error name without changing input or timing', async (platform) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-diagnostic-failed-private-'))
  const root = platform === 'windows' ? 'C:\\checkout\\project' : '/checkout/project'
  const separator = platform === 'windows' ? '\\' : '/'
  const errorName = `CustomBuild:${root}${separator}config\n"quoted"\\literal\\u0000\0`
  const stderr = `failure:${root}${separator}config\nbuilt in 541ms\n`
  const output = { status: 'failed' as const, stdout: '', stderr, errorName }
  const original = structuredClone(output)
  try {
    await saveAutoImportBuildDiagnostics(directory, output, [{ path: root, label: '<project>' }])
    const savedStdout = await readFile(path.join(directory, 'stdout.log'), 'utf8')
    const savedStderr = await readFile(path.join(directory, 'stderr.log'), 'utf8')
    const reportText = await readFile(path.join(directory, 'diagnostic.json'), 'utf8')
    const report = JSON.parse(reportText) as { status: string, errorName: string, hooks: ReturnType<typeof readBuildHookEvidence>, timing: ReturnType<typeof readBuildTimingEvidence> }
    expect(report.errorName).toBe(errorName.replaceAll(root, '<project>'))
    expect(report.status).toBe('failed')
    expect(report.hooks).toEqual(readBuildHookEvidence(savedStdout))
    expect(report.timing).toEqual(readBuildTimingEvidence(output.stdout, stderr))
    for (const text of [savedStdout, savedStderr, reportText]) {
      expect(text).not.toContain(root)
      expect(text).not.toContain(JSON.stringify(root).slice(1, -1))
    }
    expect(output).toEqual(original)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it.each(['windows', 'posix'].flatMap(platform => ['component', 'uri'].map(encoding => ({ platform, encoding }))))('round-trips $platform $encoding encoded roots in captured logs and structured evidence', async ({ platform, encoding }) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-diagnostic-uri-private-'))
  const checkout = platform === 'windows' ? 'C:\\checkout space\\工程' : '/checkout space/工程'
  const separator = platform === 'windows' ? '\\' : '/'
  const project = `${checkout}${separator}project`
  const forwardProject = project.replaceAll('\\', '/')
  const encode = encoding === 'component' ? encodeURIComponent : encodeURI
  const literal = 'literal=\\u0000&escape=%2Fnot-known%5Cu0000&line=\n"quoted"'
  const moduleId = `\0virtual:${encode(`${project}${separator}entry`)}?owner=${encode(forwardProject)}&${literal}`
  const start = { ...started, pluginName: `owner:${encode(project)}\\config\nline`, moduleId }
  const finish = { ...start, status: 'failed', endedAtMs: 30, elapsedMs: 20, errorName: `failure:${encode(checkout)}\\custom\n"quoted"` }
  const stdout = [`forward:${encode(forwardProject)}/src`, line(start), line(finish), line(terminal), 'built in 541ms', ''].join('\r\n')
  const warning = { path: encode(project), note: 'literal\\u0000\n"quoted"', unregistered: encode('/unregistered space/工程') }
  const stderr = `${JSON.stringify(warning)}\n`
  const errorName = `CustomBuild:${encode(project)}\\literal\\u0000\0`
  const output = { status: 'failed' as const, stdout, stderr, errorName }
  const original = structuredClone(output)
  try {
    await saveAutoImportBuildDiagnostics(directory, output, [{ path: checkout, label: '<checkout>' }, { path: project, label: '<project>' }])
    const savedStdout = await readFile(path.join(directory, 'stdout.log'), 'utf8')
    const savedStderr = await readFile(path.join(directory, 'stderr.log'), 'utf8')
    const reportText = await readFile(path.join(directory, 'diagnostic.json'), 'utf8')
    const report = JSON.parse(reportText) as { errorName: string, hooks: ReturnType<typeof readBuildHookEvidence>, timing: ReturnType<typeof readBuildTimingEvidence> }
    const saved = readBuildHookEvidence(savedStdout)
    const expectedModuleId = `\0virtual:<project>${encode(`${separator}entry`)}?owner=<project>&${literal}`
    expect(saved.errors).toEqual([])
    expect(saved.events).toEqual([
      { ...start, pluginName: 'owner:<project>\\config\nline', moduleId: expectedModuleId },
      { ...finish, pluginName: 'owner:<project>\\config\nline', moduleId: expectedModuleId, errorName: 'failure:<checkout>\\custom\n"quoted"' },
    ])
    expect(report.hooks).toEqual(saved)
    expect(report.errorName).toBe('CustomBuild:<project>\\literal\\u0000\0')
    expect(savedStdout).toContain('forward:<project>/src\r\n')
    expect(savedStderr).toBe(`${JSON.stringify({ ...warning, path: '<project>' })}\n`)
    for (const text of [savedStdout, savedStderr, reportText]) {
      for (const root of [checkout, project, checkout.replaceAll('\\', '/'), forwardProject]) {
        expect(text).not.toContain(encode(root))
      }
    }
    expect(report.timing).toEqual(readBuildTimingEvidence(stdout, stderr))
    expect(output).toEqual(original)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
