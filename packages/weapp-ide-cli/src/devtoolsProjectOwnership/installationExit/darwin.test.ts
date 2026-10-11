import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readDarwinKernelPaths, readDarwinProcessStates, readDarwinTextImages } from './darwin'

const command = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: command }))
beforeEach(() => vi.resetAllMocks())

const success = (stdout: string) => ({ stdout, exitCode: 0, stderr: '' })

describe('macOS read-only kernel inventory primitives', () => {
  it('reads only PID, start time and zombie status from ps, never command titles', async () => {
    command.mockResolvedValue(success(' 21 S Mon Oct  5 12:30:01 2026\r\n22 Z+ Mon Oct 5 12:30:02 2026\n'))
    expect(await readDarwinProcessStates()).toEqual([{ pid: 21, started: 'Mon Oct 5 12:30:01 2026', zombie: false }, { pid: 22, started: 'Mon Oct 5 12:30:02 2026', zombie: true }])
    expect(command).toHaveBeenCalledWith('/bin/ps', ['-axo', 'pid=,stat=,lstart='], expect.any(Object))
  })

  it.each(['', '21 malformed', '21 S Mon Oct 5 12:30:01 2026\n21 S Mon Oct 5 12:30:01 2026'])('rejects incomplete PID inventories %j', async (stdout) => {
    command.mockResolvedValue(success(stdout))
    await expect(readDarwinProcessStates()).rejects.toThrow()
  })

  it('excludes only the exact system ps process launched by this inspection', async () => {
    command.mockReturnValue(Object.assign(Promise.resolve(success('21 S Mon Oct 5 12:30:01 2026\n22 S Mon Oct 5 12:30:02 2026')), { pid: 22 }))
    expect(await readDarwinProcessStates()).toEqual([{ pid: 21, started: 'Mon Oct 5 12:30:01 2026', zombie: false }])
  })

  it('reads one kernel path result per requested PID through system JXA without UI automation', async () => {
    command.mockResolvedValue(success(JSON.stringify([{ pid: 21, executable: '/kernel/path' }, { pid: 22, executable: null }])))
    expect(await readDarwinKernelPaths([21, 22])).toEqual(new Map([[21, '/kernel/path'], [22, null]]))
    expect(command).toHaveBeenCalledWith('/usr/bin/osascript', ['-l', 'JavaScript', '-e', expect.stringContaining('proc_pidpath'), '[21,22]'], expect.any(Object))
  })

  it.each(['invalid', '[]', '[{"pid":21,"executable":null},{"pid":21,"executable":null}]', '[{"pid":22,"executable":null}]'])('rejects incomplete kernel paths %j', async (stdout) => {
    command.mockResolvedValue(success(stdout))
    await expect(readDarwinKernelPaths([21])).rejects.toThrow('incomplete kernel')
  })

  it('reads all regular program text mappings and preserves their paths', async () => {
    command.mockResolvedValue(success('p21\0\nftxt\0tREG\0n/old executable\0\nftxt\0tREG\0n/another mapping\0\n'))
    expect(await readDarwinTextImages(21)).toEqual(['/old executable', '/another mapping'])
    expect(command).toHaveBeenCalledWith('/usr/sbin/lsof', ['-nP', '-a', '-p', '21', '-d', 'txt', '-F0pftn'], expect.any(Object))
  })

  it.each(['', 'p21\0\n', 'p22\0\nftxt\0tREG\0n/path\0\n', 'p21\0\nftxt\0n/path\0\n', 'p21\0\nfmem\0tREG\0n/path\0\n'])('rejects incomplete or foreign text inventories %j', async (stdout) => {
    command.mockResolvedValue(success(stdout))
    await expect(readDarwinTextImages(21)).rejects.toThrow()
  })

  it.each([readDarwinProcessStates, () => readDarwinKernelPaths([21]), () => readDarwinTextImages(21)])('rejects warning or permission failures instead of accepting partial inventories', async (inspect) => {
    command.mockResolvedValue({ ...success('p21\0\nftxt\0tREG\0n/path\0\n'), stderr: 'Permission denied' })
    await expect(inspect()).rejects.toThrow()
    command.mockResolvedValue({ ...success(''), exitCode: 1 })
    await expect(inspect()).rejects.toThrow()
  })
})
