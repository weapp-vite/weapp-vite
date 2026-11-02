import { Buffer } from 'node:buffer'
import { ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { readWindowsKernelInspector, WINDOWS_KERNEL_COMPILE_TIMEOUT_MS, WINDOWS_KERNEL_TOOL_ROOT } from '../../e2e/utils/devProcessCleanup/windowsKernelArtifact'
import { createWindowsKernelArtifactFixture, KERNEL_FIXTURE_COMMIT } from '../../e2e/utils/testSupport/windowsKernelArtifact'
import { buildWindowsKernelInspector } from './build'

const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))
const directories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  execute.mockReset()
  await Promise.all(directories.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await fs.mkdtemp(join(tmpdir(), 'explicit-kernel-build-'))
  directories.push(root)
  await createWindowsKernelArtifactFixture(root)
  const system = join(root, 'system')
  const compiler = join(system, 'Microsoft.NET', process.arch === 'ia32' ? 'Framework' : 'Framework64', 'v4.0.30319', 'csc.exe')
  await fs.mkdir(dirname(compiler), { recursive: true })
  await fs.writeFile(compiler, 'compiler fixture')
  const temporary = join(root, 'temp')
  await fs.mkdir(temporary)
  for (const key of ['TMPDIR', 'TMP', 'TEMP']) {
    vi.stubEnv(key, temporary)
  }
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  const env = { sYsTeMrOoT: system, BUILD_ARTIFACT_EXPECTED_COMMIT: KERNEL_FIXTURE_COMMIT, GITHUB_RUN_ID: '23', GITHUB_RUN_ATTEMPT: '1' }
  return { root, env, temporary }
}

function successfulCompiler() {
  execute.mockImplementation((_command: string, args: string[]) => {
    const child = new ChildProcess()
    const result = Promise.resolve().then(async () => {
      const output = args.find(argument => argument.startsWith('/out:'))!.slice(5)
      await fs.writeFile(output, 'MZ explicitly compiled fixture')
      child.emit('exit', 0, null)
      child.emit('close', 0, null)
      return { exitCode: 0, stdout: '', stderr: '' }
    })
    return Object.assign(result, { nodeChildProcess: child })
  })
}

it('builds explicitly on every invocation and verifies the resulting immutable inputs and provenance', async () => {
  const { root, env, temporary } = await fixture()
  successfulCompiler()
  await buildWindowsKernelInspector(root, env)
  expect(Buffer.from(readWindowsKernelInspector(root, env)).toString()).toBe('MZ explicitly compiled fixture')
  await buildWindowsKernelInspector(root, env)
  expect(execute).toHaveBeenCalledTimes(2)
  for (const call of execute.mock.calls) {
    expect(call[2].timeout).toBe(WINDOWS_KERNEL_COMPILE_TIMEOUT_MS)
  }
  expect(await fs.readdir(temporary)).toEqual([])
  expect((await fs.readdir(join(root, WINDOWS_KERNEL_TOOL_ROOT))).sort()).toEqual(['manifest.json', 'snapshot.exe'])
})

it('rejects an escaping output ancestor before opening locks or touching an external manifest', async () => {
  const { root, env } = await fixture()
  const other = await fs.mkdtemp(join(dirname(root), 'kernel-external-sentinel-'))
  directories.push(other)
  const target = join(other, 'e2e-native/windows-kernel-inspector')
  await fs.mkdir(target, { recursive: true })
  await fs.writeFile(join(target, 'manifest.json'), 'external sentinel')
  await fs.rm(join(root, '.cache'), { recursive: true, force: true })
  await fs.symlink(other, join(root, '.cache'), 'junction')
  await expect(buildWindowsKernelInspector(root, env)).rejects.toThrow(/escapes/)
  expect(execute).not.toHaveBeenCalled()
  expect(await fs.readFile(join(target, 'manifest.json'), 'utf8')).toBe('external sentinel')
  expect(await fs.readdir(target)).toEqual(['manifest.json'])
})

it('preserves a competing build lock and allows a later explicit build after that owner releases it', async () => {
  const { root, env } = await fixture()
  const lock = join(root, WINDOWS_KERNEL_TOOL_ROOT, 'build.lock')
  const before = await fs.readFile(join(root, WINDOWS_KERNEL_TOOL_ROOT, 'manifest.json'), 'utf8')
  await fs.writeFile(lock, 'other build owner')
  await expect(buildWindowsKernelInspector(root, env)).rejects.toMatchObject({ code: 'EEXIST' })
  expect(await fs.readFile(lock, 'utf8')).toBe('other build owner')
  expect(await fs.readFile(join(root, WINDOWS_KERNEL_TOOL_ROOT, 'manifest.json'), 'utf8')).toBe(before)
  expect(execute).not.toHaveBeenCalled()
  await fs.rm(lock)
  successfulCompiler()
  await buildWindowsKernelInspector(root, env)
})

it('replaces only its own old image link without overwriting the external target', async (context) => {
  const { root, env } = await fixture()
  const external = join(root, 'external-sentinel.exe')
  await fs.writeFile(external, 'external image sentinel')
  const image = join(root, WINDOWS_KERNEL_TOOL_ROOT, 'snapshot.exe')
  await fs.rm(image)
  try {
    await fs.symlink(external, image)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      context.skip('This runner does not grant file symlink creation')
      return
    }
    throw error
  }
  successfulCompiler()
  await buildWindowsKernelInspector(root, env)
  expect(await fs.readFile(external, 'utf8')).toBe('external image sentinel')
  expect((await fs.lstat(image)).isSymbolicLink()).toBe(false)
  expect(Buffer.from(readWindowsKernelInspector(root, env)).toString()).toBe('MZ explicitly compiled fixture')
})

it('does nothing on Unix and never probes or compiles a Windows executable', async () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
  await buildWindowsKernelInspector()
  expect(execute).not.toHaveBeenCalled()
})

it('cancels its exact compiler but keeps the build lock and temporary source until native close', async () => {
  const { root, env, temporary } = await fixture()
  const controller = new AbortController()
  const child = new ChildProcess()
  const original = Object.assign(new Error('original compiler cancellation'), { isCanceled: true })
  execute.mockImplementation((_command: string, _args: string[], options: { cancelSignal: AbortSignal }) => {
    const pending = new Promise((_resolve, reject) => {
      options.cancelSignal.addEventListener('abort', () => {
        child.emit('exit', null, 'SIGTERM')
        reject(original)
      }, { once: true })
    })
    return Object.assign(pending, { nodeChildProcess: child })
  })
  let finished = false
  const pending = buildWindowsKernelInspector(root, env, controller.signal).catch((error: unknown) => error).finally(() => finished = true)
  try {
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
    controller.abort(new Error('Build owner cancelled'))
    await Promise.resolve()
    expect(finished).toBe(false)
    expect(await fs.readdir(temporary)).toHaveLength(1)
    expect(await fs.readdir(join(root, WINDOWS_KERNEL_TOOL_ROOT))).toContain('build.lock')
    await expect(buildWindowsKernelInspector(root, env)).rejects.toMatchObject({ code: 'EEXIST' })
    child.emit('close', null, 'SIGTERM')
    const failure = await pending as Error
    expect(failure.cause).toBe(original)
    expect(await fs.readdir(temporary)).toEqual([])
    expect(await fs.readdir(join(root, WINDOWS_KERNEL_TOOL_ROOT))).toEqual(['snapshot.exe'])
  }
  finally {
    child.emit('close', null, 'SIGTERM')
    await pending
  }
})

it('retains compilation, lock-close and lock-removal failures while trying both cleanup phases', async () => {
  const { root, env } = await fixture()
  const original = Object.assign(new Error('original compilation failure'), { exitCode: 1, stdout: '', stderr: '' })
  const closeFailure = new Error('lock close failed')
  const removeFailure = new Error('lock removal failed')
  const lockPath = join(await fs.realpath(root), WINDOWS_KERNEL_TOOL_ROOT, 'build.lock')
  const open = fs.open
  const remove = fs.rm
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const held = await open(...args)
    const close = held.close.bind(held)
    vi.spyOn(held, 'close').mockImplementation(async () => {
      await close()
      throw closeFailure
    })
    return held
  })
  const removal = vi.spyOn(fs, 'rm').mockImplementation(async (...args) => {
    if (String(args[0]) === lockPath) {
      throw removeFailure
    }
    return remove(...args)
  })
  execute.mockImplementation(() => {
    const child = new ChildProcess()
    const pending = Promise.resolve().then(() => {
      child.emit('close', 1, null)
      return original
    })
    return Object.assign(pending, { nodeChildProcess: child })
  })
  const failure = await buildWindowsKernelInspector(root, env).catch((error: unknown) => error) as AggregateError
  expect(failure).toBeInstanceOf(AggregateError)
  expect(failure.cause).toBe(failure.errors[0])
  expect((failure.errors[0] as Error).cause).toBe(original)
  expect((failure.errors[1] as AggregateError).errors).toEqual([closeFailure, removeFailure])
  expect(removal).toHaveBeenCalledWith(lockPath, { force: true })
})
