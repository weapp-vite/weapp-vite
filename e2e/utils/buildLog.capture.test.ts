import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runWeappViteBuildWithLogCapture } from './buildLog'

const execaMock = vi.hoisted(() => vi.fn())
const appendReportEventMock = vi.hoisted(() => vi.fn())

vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./ideWarningReport', () => ({
  appendIdeReportEvent: appendReportEventMock,
  resolveReportProjectPath: () => 'fixture',
}))

describe('build log capture', () => {
  let projectRoot: string
  let output: string[]

  beforeEach(() => {
    execaMock.mockReset()
    appendReportEventMock.mockReset()
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-vite-build-log-'))
    output = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output.push(String(chunk))
      return true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(projectRoot, { recursive: true, force: true })
  })

  function mockBuild(chunks: string[] = []) {
    execaMock.mockImplementationOnce(() => {
      const all = new EventEmitter()
      const result = Promise.resolve().then(() => {
        for (const chunk of chunks) {
          all.emit('data', chunk)
        }
        return { exitCode: 0 }
      })
      return Object.assign(result, { all })
    })
  }

  function build(skipNpm = false) {
    return runWeappViteBuildWithLogCapture({
      cliPath: 'fixture-cli.js',
      projectRoot,
      cwd: projectRoot,
      platform: 'weapp',
      label: 'fixture',
      skipNpm,
    })
  }

  function installPackage(name: string, miniprogram?: string) {
    const packageRoot = path.join(projectRoot, 'node_modules', name)
    fs.mkdirSync(packageRoot, { recursive: true })
    fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({
      name,
      version: '1.0.0',
      main: 'index.js',
      ...(miniprogram ? { miniprogram } : {}),
    }))
    fs.writeFileSync(path.join(packageRoot, 'index.js'), '')
  }

  it('counts bracket severity once per complete or flushed line', async () => {
    mockBuild(['[wa', 'rn] first\r', '\n[error] failed\n[warn] final'])

    expect(await build()).toEqual({ warn: 2, error: 1 })
    expect(appendReportEventMock.mock.calls.map(([event]) => event)).toEqual([
      expect.objectContaining({ kind: 'message', level: 'warn', text: '[warn] first' }),
      expect.objectContaining({ kind: 'message', level: 'error', text: '[error] failed' }),
      expect.objectContaining({ kind: 'message', level: 'warn', text: '[warn] final' }),
      expect.objectContaining({ kind: 'stats', warn: 2, error: 1, exit: 0 }),
    ])
  })

  it('counts consola severity with ANSI, chunk boundaries, CRLF, and an unterminated final line', async () => {
    const firstWarning = '\u001B[33m WARN \u001B[39m 没有找到组件'
    const error = '\u001B[31m ERROR \u001B[39m 构建失败'
    mockBuild([`${firstWarning}\r`, '\n\u001B[31m ER', 'ROR \u001B[39m 构建失败\n', ' WARN  最后一条警告'])

    expect(await build()).toEqual({ warn: 2, error: 1 })
    expect(appendReportEventMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'message',
      level: 'warn',
      text: firstWarning,
    }))
    expect(appendReportEventMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'message',
      level: 'error',
      text: error,
    }))
    expect(output.join('')).toContain(firstWarning)
    expect(output.join('')).toContain('[e2e-build-stats] label=fixture warn=2 error=1 exit=0')
  })

  it('keeps bracket severity after progress prefixes and before adjacent module tags', async () => {
    const warning = '\u001B[2K\rtransforming...[warn][vue] component warning'
    const error = '[12:34:56] [error][npm] component error'
    mockBuild(['\u001B[2K\rtransforming...[wa', 'rn][vue] component warning\n', error])

    expect(await build()).toEqual({ warn: 1, error: 1 })
    expect(appendReportEventMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'warn', text: warning }))
    expect(appendReportEventMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', text: error }))
  })

  it('does not treat severity words in ordinary messages or paths as log levels', async () => {
    mockBuild(['built pages/warn/error/index.js\n', 'The WARN and ERROR counters are ready.\n', 'WARNING counters are ready.\n'])

    expect(await build()).toEqual({ warn: 0, error: 0 })
    expect(appendReportEventMock).toHaveBeenCalledTimes(1)
    expect(appendReportEventMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'stats' }))
  })

  it.each(['tdesign-miniprogram', '@scope/miniprogram'])('prevents skipNpm for a miniprogram package declared only in devDependencies: %s', async (name) => {
    fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({
      devDependencies: { [name]: '^1.0.0' },
    }))
    installPackage(name, 'miniprogram_dist')
    mockBuild()

    await build(true)

    expect(execaMock.mock.calls.length).toBe(1)
    expect(execaMock.mock.calls[0]?.[1]).not.toContain('--skipNpm')
  })

  it('keeps the conservative skipNpm guard for declared runtime dependencies', async () => {
    fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({
      dependencies: { 'dev-only-tool': '^1.0.0' },
    }))
    installPackage('dev-only-tool')
    mockBuild()

    await build(true)

    expect(execaMock.mock.calls.length).toBe(1)
    expect(execaMock.mock.calls[0]?.[1]).not.toContain('--skipNpm')
  })

  it.each([false, true])('keeps skipNpm available without npm candidates (ordinary dev tool installed: %s)', async (hasDevTool) => {
    fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify(hasDevTool
      ? { devDependencies: { 'dev-only-tool': '^1.0.0' } }
      : {}))
    if (hasDevTool) {
      installPackage('dev-only-tool')
    }
    mockBuild()

    await build(true)

    expect(execaMock.mock.calls.length).toBe(1)
    expect(execaMock.mock.calls[0]?.[1]).toContain('--skipNpm')
  })
})
