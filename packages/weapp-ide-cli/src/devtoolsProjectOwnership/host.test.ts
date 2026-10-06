import type { Server } from 'node:net'
import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertManagedInstallation, inspectManagedProjectHost, isManagedPortClosed, readManagedProcessIdentity, sameManagedProcess, waitForManagedPortClosed } from './host'

const inspect = vi.hoisted(() => vi.fn())
const targetChecks = vi.hoisted(() => ({ port: vi.fn(), resolve: vi.fn() }))
vi.mock('execa', () => ({ execa: inspect }))
vi.mock('../devtoolsTarget', () => ({ assertWechatDevtoolsPort: targetChecks.port, resolveWechatDevtoolsTarget: targetChecks.resolve }))
const servers = new Set<Server>()

beforeEach(() => vi.resetAllMocks())
afterEach(async () => {
  vi.restoreAllMocks()
  for (const server of servers) {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
  servers.clear()
})

describe('managed host startup identities', () => {
  it('parses macOS identity with a spaced executable and stable locale', async () => {
    const executable = path.resolve('fixture with spaces', 'host')
    inspect.mockResolvedValue({ exitCode: 0, stdout: `Mon Oct  5 12:30:01 2026 ${executable}\r\n` })
    expect(await readManagedProcessIdentity(123, 'darwin')).toEqual({ pid: 123, executable, started: 'Mon Oct 5 12:30:01 2026' })
    expect(inspect).toHaveBeenCalledWith('ps', ['-p', '123', '-o', 'lstart=', '-o', 'comm='], expect.objectContaining({ env: { LC_ALL: 'C' }, reject: false }))
  })

  it('distinguishes an exited host from a failed process inspection', async () => {
    inspect.mockResolvedValueOnce({ exitCode: 1, stdout: '' })
    expect(await readManagedProcessIdentity(123, 'darwin')).toBeUndefined()
    inspect.mockResolvedValueOnce({ exitCode: 2, stdout: '' })
    await expect(readManagedProcessIdentity(123, 'darwin')).rejects.toThrow('could not be verified')
    inspect.mockResolvedValueOnce({ exitCode: 0, stdout: 'unreadable process' })
    await expect(readManagedProcessIdentity(123, 'darwin')).rejects.toThrow('could not be verified')
  })

  it('uses Windows creation time and rejects incomplete executable metadata', async () => {
    const executable = path.resolve('windows-fixture', 'host.exe')
    inspect.mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify({ ProcessId: 123, ExecutablePath: executable, Started: '2026-10-05T01:02:03.456Z' }) })
    expect(await readManagedProcessIdentity(123, 'win32')).toEqual({ pid: 123, executable, started: '2026-10-05T01:02:03.456Z' })
    inspect.mockResolvedValueOnce({ exitCode: 0, stdout: '' })
    expect(await readManagedProcessIdentity(123, 'win32')).toBeUndefined()
    inspect.mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify({ ProcessId: 123, Started: 'same-time' }) })
    await expect(readManagedProcessIdentity(123, 'win32')).rejects.toThrow('could not be verified')
  })

  it('combines Linux boot identity and process start ticks even when comm contains spaces and parentheses', async () => {
    const executable = path.resolve('linux-fixture', 'host')
    vi.spyOn(fs, 'readlink').mockResolvedValue(executable)
    vi.spyOn(fs, 'readFile').mockImplementation(async (file) => {
      if (String(file).endsWith('/stat')) {
        return `123 (host (with spaces)) ${[...Array.from({ length: 19 }).fill('0'), '987654'].join(' ')}`
      }
      return 'boot-token\n'
    })
    expect(await readManagedProcessIdentity(123, 'linux')).toEqual({ pid: 123, executable, started: 'boot-token:987654' })
    expect(sameManagedProcess({ pid: 123, executable, started: 'boot-token:987654' }, { pid: 123, executable, started: 'next-boot:987654' })).toBe(false)
  })

  it('does not treat unavailable Linux boot identity as proof the host exited', async () => {
    vi.spyOn(fs, 'readlink').mockResolvedValue(path.resolve('host'))
    vi.spyOn(fs, 'readFile').mockImplementation(async (file) => {
      if (String(file).endsWith('/stat')) {
        return `123 (host) ${Array.from({ length: 20 }).fill('1').join(' ')}`
      }
      throw Object.assign(new Error('missing boot identity'), { code: 'ENOENT' })
    })
    await expect(readManagedProcessIdentity(123, 'linux')).rejects.toThrow('could not be verified')
  })

  it('requires every component of the identity to match', () => {
    const host = { pid: 123, executable: path.resolve('host'), started: 'first' }
    expect(sameManagedProcess(host, { ...host })).toBe(true)
    expect(sameManagedProcess(host, { ...host, pid: 124 })).toBe(false)
    expect(sameManagedProcess(host, { ...host, started: 'second' })).toBe(false)
    expect(sameManagedProcess(host, { ...host, executable: path.resolve('another-installation') })).toBe(false)
  })

  it('checks the selected installation before recording the exact listener process', async () => {
    const target = { cliPath: path.resolve('cli'), appPath: path.resolve('app'), profileDir: path.resolve('profile'), installationId: 'selected' }
    const executable = path.resolve('host')
    inspect.mockResolvedValueOnce({ exitCode: 0, stdout: 'p123\r\np123\r\n' })
    inspect.mockResolvedValueOnce({ exitCode: 0, stdout: `Mon Oct 5 12:30:01 2026 ${executable}\n` })
    expect(await inspectManagedProjectHost(target, 19001, 'darwin')).toEqual({ pid: 123, executable, started: 'Mon Oct 5 12:30:01 2026' })
    expect(targetChecks.port).toHaveBeenCalledExactlyOnceWith(target, 19001, { platform: 'darwin' })
    inspect.mockResolvedValueOnce({ exitCode: 0, stdout: 'p123\np124\n' })
    await expect(inspectManagedProjectHost(target, 19001, 'darwin')).rejects.toThrow('could not be verified')
    targetChecks.port.mockRejectedValueOnce(new Error('foreign installation'))
    await expect(inspectManagedProjectHost(target, 19001, 'darwin')).rejects.toThrow('foreign installation')
  })

  it('verifies Windows listener ownership without relying on a Unix launcher', async () => {
    const target = { cliPath: path.resolve('cli'), appPath: path.resolve('app'), profileDir: path.resolve('profile'), installationId: 'selected' }
    const executable = path.resolve('host.exe')
    inspect.mockResolvedValueOnce({ exitCode: 0, stdout: '[123]' })
    inspect.mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify({ ProcessId: 123, ExecutablePath: executable, Started: '2026-10-05T01:02:03.456Z' }) })
    expect(await inspectManagedProjectHost(target, 19001, 'win32')).toEqual({ pid: 123, executable, started: '2026-10-05T01:02:03.456Z' })
    expect(inspect.mock.calls.every(([command]) => command === 'powershell.exe')).toBe(true)
  })

  it('rejects a replaced installation even when its path and PID could remain the same', async () => {
    const target = { cliPath: path.resolve('cli'), appPath: path.resolve('app'), profileDir: path.resolve('profile'), installationId: 'selected', version: '1.0.0' }
    targetChecks.resolve.mockResolvedValueOnce({ ...target })
    await expect(assertManagedInstallation(target)).resolves.toBeUndefined()
    targetChecks.resolve.mockResolvedValueOnce({ ...target, version: '2.0.0' })
    await expect(assertManagedInstallation(target)).rejects.toThrow('installation changed')
    targetChecks.resolve.mockResolvedValueOnce({ ...target, profileDir: path.resolve('another-profile') })
    await expect(assertManagedInstallation(target)).rejects.toThrow('installation changed')
  })
})

it('requires a real loopback listener to disappear before port cleanup is successful', async () => {
  const server = net.createServer(socket => socket.destroy())
  servers.add(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP listener')
  }
  expect(await isManagedPortClosed(address.port)).toBe(false)
  await expect(waitForManagedPortClosed(address.port, 1)).rejects.toThrow('remained open')
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  servers.delete(server)
  expect(await isManagedPortClosed(address.port)).toBe(true)
  await expect(waitForManagedPortClosed(address.port)).resolves.toBeUndefined()
})
