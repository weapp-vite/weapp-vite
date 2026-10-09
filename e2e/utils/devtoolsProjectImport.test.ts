import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from 'weapp-ide-cli'
import { importManagedDevtoolsProject, resolveProjectImportCli } from './devtoolsProjectImport'

const { run, lease } = vi.hoisted(() => ({ run: vi.fn(), lease: vi.fn(async (callback: () => Promise<unknown>) => callback()) }))
vi.mock('execa', () => ({ execa: run }))
vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: lease }))

describe('official managed project initialization', () => {
  const directories: string[] = []
  const projectPath = path.resolve('fixtures/new project')
  const options = () => ({ cliPath: path.resolve('installation/cli'), projectPath, trusted: true, timeout: 12_345, signal: new AbortController().signal })
  const receipt = (result: Record<string, unknown>) => JSON.stringify({ ok: true, tool: 'project_import', clientName: 'weapp-vite-e2e', result })

  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(run).toHaveBeenCalledExactlyOnceWith(resolveProjectImportCli(selected.cliPath), ['-c', 'weapp-vite-e2e', 'project_import', '--project', projectPath], {
      timeout: selected.timeout,
      cancelSignal: selected.signal,
      killDescendants: false,
    })
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
    expect(run).not.toHaveBeenCalled()
  })

  it('checks cancellation before and after the official call', async () => {
    const controller = new AbortController()
    const failure = new Error('cancelled')
    controller.abort(failure)
    await expect(importManagedDevtoolsProject({ ...options(), signal: controller.signal })).rejects.toBe(failure)
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

  it.each([false, true])('restores authored conditions and SDK bytes when import fails=%s', async (fails) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ide-project-import-'))
    directories.push(directory)
    const file = path.join(directory, 'project.private.config.json')
    const original = '{"libVersion":"configured-sdk","condition":{"miniprogram":{"list":[{"pathName":"pages/start/index"}]}}}\r\n'
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
