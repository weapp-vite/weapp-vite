import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../devtoolsProjectOwnership'
import { importManagedDevtoolsProject, resolveProjectImportCli } from './projectImport'

const { run, checkStatus, lease } = vi.hoisted(() => ({
  run: vi.fn(),
  checkStatus: vi.fn(),
  lease: vi.fn(async (callback: () => Promise<unknown>) => callback()),
}))
vi.mock('execa', () => ({
  execa: (cli: string, args: string[], options: unknown) => (args[2] === 'check_wechatide_status' ? checkStatus : run)(cli, args, options),
}))
vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: lease }))

describe('official managed project initialization', () => {
  const directories: string[] = []
  const projectPath = path.resolve('fixtures/new project')
  const options = () => ({ cliPath: path.resolve('installation/cli'), projectPath, trusted: true, timeout: 12_345, signal: new AbortController().signal })
  const receipt = (result: Record<string, unknown>) => JSON.stringify({ ok: true, tool: 'project_import', clientName: 'weapp-vite-e2e', result })
  const statusReceipt = (result: Record<string, unknown>) => JSON.stringify({ ok: true, tool: 'check_wechatide_status', clientName: 'weapp-vite-e2e', result })

  beforeEach(() => {
    vi.resetAllMocks()
    checkStatus.mockResolvedValue({ stdout: statusReceipt({ success: true, loginExpired: false }) })
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, 'task-journal')
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })))
  })

  it.each([false, true])('accepts a completed import, alreadyImported=%s', async (alreadyImported) => {
    run.mockResolvedValue({ stdout: receipt({ success: true, projectPath, alreadyImported }) })
    const selected = options()
    await importManagedDevtoolsProject(selected)
    expect(lease).toHaveBeenCalledOnce()
    expect(checkStatus).toHaveBeenCalledExactlyOnceWith(resolveProjectImportCli(selected.cliPath), ['-c', 'weapp-vite-e2e', 'check_wechatide_status', '--skill-version', '0.3.11'], {
      timeout: expect.any(Number),
      cancelSignal: selected.signal,
      killDescendants: false,
    })
    expect(checkStatus).toHaveBeenCalledBefore(run)
    expect(run).toHaveBeenCalledExactlyOnceWith(resolveProjectImportCli(selected.cliPath), ['-c', 'weapp-vite-e2e', 'project_import', '--project', projectPath], {
      timeout: expect.any(Number),
      cancelSignal: selected.signal,
      killDescendants: false,
    })
  })

  it('does not import when the official status check fails', async () => {
    const failure = new Error('status check timed out')
    checkStatus.mockRejectedValueOnce(failure)
    await expect(importManagedDevtoolsProject(options())).rejects.toBe(failure)
    checkStatus.mockResolvedValueOnce({ stdout: statusReceipt({ success: true }) })
    await expect(importManagedDevtoolsProject(options())).rejects.toThrow('DEVTOOLS_PROJECT_STATUS_UNAVAILABLE')
    expect(run).not.toHaveBeenCalled()
  })

  it('reports an expired login before importing the project', async () => {
    checkStatus.mockResolvedValue({ stdout: statusReceipt({ success: true, loginExpired: true }) })
    await expect(importManagedDevtoolsProject(options())).rejects.toThrow('DEVTOOLS_LOGIN_REQUIRED')
    expect(run).not.toHaveBeenCalled()
  })

  it('shares the initialization deadline across both commands', async () => {
    vi.useFakeTimers({ toFake: ['performance'] })
    try {
      checkStatus.mockImplementation(async () => {
        vi.advanceTimersByTime(700)
        return { stdout: statusReceipt({ success: true, loginExpired: false }) }
      })
      run.mockResolvedValue({ stdout: receipt({ success: true, projectPath, alreadyImported: false }) })
      await importManagedDevtoolsProject({ ...options(), timeout: 1000 })
      expect(run).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ timeout: 300 }))
      run.mockClear()
      await expect(importManagedDevtoolsProject({ ...options(), timeout: 700 })).rejects.toThrow('DEVTOOLS_PROJECT_IMPORT_TIMEOUT')
      expect(run).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it.each([
    { success: true, status: 'pending', taskId: 'authorization-task' },
    { success: true, status: 'cancelled', error: 'Client not authorized' },
    { success: false, projectPath, alreadyImported: false },
    { success: true, projectPath: path.resolve('fixtures/other'), alreadyImported: false },
    { success: true, projectPath },
    { success: true, projectPath, alreadyImported: false, status: 'pending' },
  ])('rejects an incomplete or unrelated result: %j', async (result) => {
    run.mockResolvedValue({ stdout: receipt(result) })
    await expect(importManagedDevtoolsProject(options())).rejects.toThrow('DEVTOOLS_PROJECT_IMPORT_INCOMPLETE')
    expect(run).toHaveBeenCalledOnce()
  })

  it('retains official failure codes without logging project paths', async () => {
    run.mockResolvedValue({ stdout: JSON.stringify({
      ok: false,
      tool: 'project_import',
      clientName: 'weapp-vite-e2e',
      error: { code: 'APPID_ERROR', message: `Project is unavailable: ${projectPath}` },
    }) })
    await expect(
      importManagedDevtoolsProject(options()),
    ).rejects.toThrow('receipt={"responseKeys":["clientName","error","ok","tool"],"resultKeys":[],"code":"APPID_ERROR","projectPathMatches":false,"alreadyImportedType":"undefined"}')
    expect(run).toHaveBeenCalledOnce()
  })

  it('preserves command failures without retrying or opening a window', async () => {
    const failure = new Error('official import failed')
    run.mockRejectedValue(failure)
    await expect(importManagedDevtoolsProject(options())).rejects.toBe(failure)
    expect(run).toHaveBeenCalledOnce()
  })

  it('does not import an untrusted or unmanaged project', async () => {
    await importManagedDevtoolsProject({ ...options(), trusted: false })
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, '')
    await importManagedDevtoolsProject(options())
    expect(lease).not.toHaveBeenCalled()
    expect(checkStatus).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('checks cancellation before and after the official call', async () => {
    const controller = new AbortController()
    const failure = new Error('cancelled')
    controller.abort(failure)
    await expect(importManagedDevtoolsProject({ ...options(), signal: controller.signal })).rejects.toBe(failure)
    expect(checkStatus).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
    const next = new AbortController()
    run.mockImplementation(async () => {
      next.abort(failure)
      return { stdout: receipt({ success: true, projectPath, alreadyImported: false }) }
    })
    await expect(importManagedDevtoolsProject({ ...options(), signal: next.signal })).rejects.toBe(failure)
    expect(run).toHaveBeenCalledOnce()
  })

  it('resolves the selected installation on macOS and Windows without using PATH', () => {
    expect(resolveProjectImportCli('/opt/Dev Tools/Contents/MacOS/cli', 'darwin')).toBe('/opt/Dev Tools/Contents/MacOS/wechatide')
    expect(resolveProjectImportCli('C:\\Dev Tools\\cli.bat', 'win32')).toBe('C:\\Dev Tools\\wechatide.cmd')
  })

  it.each([
    ['project.config.json', false],
    ['project.config.json', true],
    ['project.private.config.json', false],
    ['project.private.config.json', true],
  ] as const)('restores authored %s bytes when import fails=%s', async (fileName, fails) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ide-project-import-'))
    directories.push(directory)
    const file = path.join(directory, fileName)
    const original = '{"miniprogramRoot":"dist","libVersion":"configured-sdk","condition":{"miniprogram":{"list":[{"pathName":"pages/start/index"}]}}}\r\n'
    await fs.writeFile(file, original)
    const failure = new Error('import failed')
    run.mockImplementation(async () => {
      await fs.writeFile(file, '{"libVersion":"default-sdk","condition":{}}')
      if (fails) {
        throw failure
      }
      return { stdout: receipt({ success: true, projectPath: directory, alreadyImported: false }) }
    })
    const importing = importManagedDevtoolsProject({ ...options(), projectPath: directory })
    if (fails) {
      await expect(importing).rejects.toBe(failure)
    }
    else {
      await importing
    }
    expect(await fs.readFile(file, 'utf8')).toBe(original)
  })

  it('removes only the private config generated by import when the fixture has none', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ide-project-import-'))
    directories.push(directory)
    const file = path.join(directory, 'project.private.config.json')
    run.mockImplementation(async () => {
      await fs.writeFile(file, '{}')
      return { stdout: receipt({ success: true, projectPath: directory, alreadyImported: false }) }
    })
    await importManagedDevtoolsProject({ ...options(), projectPath: directory })
    await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
