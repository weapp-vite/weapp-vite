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
    expect(command.mock.calls[0]![2]).toMatchObject({ timeout: 10_000 })
  })

  it('accepts a smaller remaining deadline without expanding the recovery default', async () => {
    command.mockResolvedValue(success('[{"pid":21,"executable":"/kernel/path"}]'))
    await readDarwinKernelPaths([21], 750)
    expect(command.mock.calls[0]![2]).toMatchObject({ timeout: 750 })
    await readDarwinKernelPaths([21], 20_000)
    expect(command.mock.calls[1]![2]).toMatchObject({ timeout: 10_000 })
    await expect(readDarwinKernelPaths([21], 0)).rejects.toThrow('cannot inspect')
    expect(command).toHaveBeenCalledTimes(2)
  })

  it.each(['invalid', '[]', '[{"pid":21,"executable":null},{"pid":21,"executable":null}]', '[{"pid":22,"executable":null}]'])('rejects incomplete kernel paths %j', async (stdout) => {
    command.mockResolvedValue(success(stdout))
    await expect(readDarwinKernelPaths([21])).rejects.toThrow('incomplete kernel')
  })

  it('reads all regular program text mappings and preserves their paths', async () => {
    command.mockResolvedValue(success('p21\0\nftxt\0tREG\0n/old executable\0\nftxt\0tREG\0n/another mapping\0\n'))
    expect(await readDarwinTextImages(21)).toEqual(['/old executable', '/another mapping'])
    expect(command).toHaveBeenCalledWith('/usr/sbin/lsof', ['-nP', '-a', '-p', '21', '-d', 'txt', '-F0pftn'], expect.any(Object))
    expect(command.mock.calls[0]![2]).toMatchObject({ timeout: 10_000 })
  })

  it('caps text-image inspection at the remaining budget and rejects an exhausted budget before dispatch', async () => {
    command.mockResolvedValue(success('p21\0\nftxt\0tREG\0n/path\0\n'))
    await readDarwinTextImages(21, 750)
    expect(command.mock.calls[0]![2]).toMatchObject({ timeout: 750 })
    await readDarwinTextImages(21, 20_000)
    expect(command.mock.calls[1]![2]).toMatchObject({ timeout: 10_000 })
    for (const timeout of [0, -1, Number.NaN, 0.5]) {
      await expect(readDarwinTextImages(21, timeout)).rejects.toThrow('positive timeout')
    }
    expect(command).toHaveBeenCalledTimes(2)
  })

  it.each([{ timedOut: true }, { signal: 'SIGTERM' }])('rejects interrupted text-image inspection despite a complete-looking result (%j)', async (interrupted) => {
    command.mockResolvedValue({ ...success('p21\0\nftxt\0tREG\0n/path\0\n'), ...interrupted })
    await expect(readDarwinTextImages(21, 750)).rejects.toThrow('cannot inspect all executable text images')
  })

  // macOS 的 LC_ALL=C、-F0pftn 实测：中文按 UTF-8 字节转义，字面反斜杠翻倍。
  it.each([
    [String.raw`/fixture/\xe5\xbe\xae\xe4\xbf\xa1.app/image`, '/fixture/微信.app/image'],
    [String.raw`/fixture/selected\\literal.app/image`, String.raw`/fixture/selected\literal.app/image`],
    [String.raw`/fixture/selected\\xe5\\xBE.app/image`, String.raw`/fixture/selected\xe5\xBE.app/image`],
    ['/fixture/selected^H^I^J^L^M^?^a^1.app/image', '/fixture/selected^H^I^J^L^M^?^a^1.app/image'],
  ])('decodes native lsof wire path %s without reinterpreting literal escapes', async (wire, image) => {
    command.mockResolvedValue(success(`p21\0\nftxt\0tREG\0n${wire}\0\n`))
    expect(await readDarwinTextImages(21)).toEqual([image])
  })

  it.each([
    '/fixture/selected^A.app/image',
    '/fixture/selected^K.app/image',
    '/fixture/selected^[.app/image',
    String.raw`/fixture/selected^\.app/image`,
    '/fixture/selected^^.app/image',
    '/fixture/selected^_.app/image',
    String.raw`/fixture/selected\t\n\r\b\f.app/image`,
    String.raw`/fixture/selected\x7f.app/image`,
    String.raw`/fixture/selected\x.app/image`,
    String.raw`/fixture/selected\xe.app/image`,
    String.raw`/fixture/selected\xgg.app/image`,
    String.raw`/fixture/selected\q.app/image`,
    '/fixture/trailing\\',
    String.raw`/fixture/invalid\xe5.app/image`,
    String.raw`/fixture/invalid\xc0\xaf.app/image`,
    String.raw`/fixture/invalid\xed\xa0\x80.app/image`,
    String.raw`/fixture/invalid\x00.app/image`,
    '/fixture/raw\tcontrol.app/image',
    'relative-image',
  ])('rejects ambiguous, control or malformed wire path %s', async (wire) => {
    command.mockResolvedValue(success(`p21\0\nftxt\0tREG\0n${wire}\0\n`))
    await expect(readDarwinTextImages(21)).rejects.toThrow()
  })

  it('rejects a text inventory whose final path field has no NUL terminator', async () => {
    command.mockResolvedValue(success('p21\0\nftxt\0tREG\0n/truncated'))
    await expect(readDarwinTextImages(21)).rejects.toThrow('incomplete')
  })

  it.each(['', 'p21\0\n', 'p22\0\nftxt\0tREG\0n/path\0\n', 'p21\0\nftxt\0n/path\0\n', 'p21\0\nfmem\0tREG\0n/path\0\n'])('rejects incomplete or foreign text inventories %j', async (stdout) => {
    command.mockResolvedValue(success(stdout))
    await expect(readDarwinTextImages(21)).rejects.toThrow()
  })

  it('retains the sampled PID, exit status and stderr when image inventory fails', async () => {
    command.mockResolvedValue({ stdout: '', stderr: 'Permission denied', exitCode: 1 })
    await expect(readDarwinTextImages(21)).rejects.toMatchObject({
      message: expect.stringContaining('PID 21'),
      cause: { exitCode: 1, stderr: 'Permission denied' },
    })
  })

  it.each([readDarwinProcessStates, () => readDarwinKernelPaths([21]), () => readDarwinTextImages(21)])('rejects warning or permission failures instead of accepting partial inventories', async (inspect) => {
    command.mockResolvedValue({ ...success('p21\0\nftxt\0tREG\0n/path\0\n'), stderr: 'Permission denied' })
    await expect(inspect()).rejects.toThrow()
    command.mockResolvedValue({ ...success(''), exitCode: 1 })
    await expect(inspect()).rejects.toThrow()
  })
})
