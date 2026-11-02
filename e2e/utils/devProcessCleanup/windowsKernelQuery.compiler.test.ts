import { ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { buildWindowsKernelInspector } from '../../../scripts/e2eNativeTools/build'
import { createWindowsKernelArtifactFixture, KERNEL_FIXTURE_COMMIT } from '../testSupport/windowsKernelArtifact'
import { WINDOWS_KERNEL_COMPILE_TIMEOUT_MS, WINDOWS_KERNEL_TOOL_ROOT } from './windowsKernelArtifact'

const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))

beforeEach(() => {
  execute.mockReset()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it.each(['running', 'exited-awaiting-close', 'closed', 'rejected', 'spawn-failed'] as const)('preserves the compiler %s failure and waits for its native close within the existing compiler budget', async (phase) => {
  const root = await fs.mkdtemp(join(tmpdir(), 'kernel-builder-evidence-'))
  let child: ChildProcess | undefined
  try {
    await createWindowsKernelArtifactFixture(root)
    const temporary = join(root, 'temp')
    await fs.mkdir(temporary)
    const system = join(root, 'system')
    const compiler = join(system, 'Microsoft.NET', process.arch === 'ia32' ? 'Framework' : 'Framework64', 'v4.0.30319', 'csc.exe')
    await fs.mkdir(dirname(compiler), { recursive: true })
    await fs.writeFile(compiler, 'compiler fixture')
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    for (const key of ['TMPDIR', 'TMP', 'TEMP']) {
      vi.stubEnv(key, temporary)
    }
    child = new ChildProcess()
    const original = Object.assign(new Error('original compiler failure'), {
      exitCode: undefined,
      signal: 'SIGTERM',
      timedOut: true,
      stdout: '',
      stderr: '',
    })
    execute.mockImplementation(() => Object.assign(new Promise((resolve, reject) => {
      queueMicrotask(() => {
        if (phase === 'spawn-failed') {
          child!.emit('error', original)
        }
        else {
          child!.emit('spawn')
        }
        if (phase === 'exited-awaiting-close' || phase === 'closed') {
          child!.emit('exit', null, 'SIGTERM')
        }
        if (phase === 'closed') {
          child!.emit('close', null, 'SIGTERM')
        }
        if (phase === 'rejected' || phase === 'spawn-failed') {
          reject(original)
        }
        else {
          resolve(original)
        }
      })
    }), { nodeChildProcess: child }))
    let finished = false
    const pending = buildWindowsKernelInspector(root, { sYsTeMrOoT: system, BUILD_ARTIFACT_EXPECTED_COMMIT: KERNEL_FIXTURE_COMMIT }).catch((error: unknown) => error).finally(() => finished = true)
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
    if (phase !== 'closed') {
      expect(finished).toBe(false)
      expect(await fs.readdir(temporary)).toHaveLength(1)
      child.emit('close', null, 'SIGTERM')
    }
    const failure = await pending as Error
    expect(failure).toBeInstanceOf(Error)
    expect(failure.cause).toBe(original)
    expect(failure.message).toContain(`"phase":"${phase === 'rejected' ? 'running' : phase}"`)
    expect(failure.message).toContain('"phase":"closed"')
    expect(failure.message).not.toContain('original compiler failure')
    expect(execute.mock.calls[0]![0]).toBe(compiler)
    expect(execute.mock.calls[0]![2]).toMatchObject({ timeout: WINDOWS_KERNEL_COMPILE_TIMEOUT_MS, stdin: 'ignore', reject: false, windowsHide: true })
    expect(await fs.readdir(temporary)).toEqual([])
    expect(await fs.readdir(join(root, WINDOWS_KERNEL_TOOL_ROOT))).toEqual(['snapshot.exe'])
    expect(child.eventNames()).toEqual([])
  }
  finally {
    child?.emit('close', null, 'SIGTERM')
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await fs.rm(root, { recursive: true, force: true })
  }
})
