import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProtectedImageVerifier } from './textImageIdentity'

const command = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: command }))
let directory: string
let bundle: string
let selected: string

function inventory(file: string, device: bigint, inode: bigint) {
  return { stdout: `p21\0\nftxt\0tREG\0D0x${device.toString(16)}\0i${inode}\0n${file}\0\n`, stderr: '', exitCode: 0 }
}

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'protected-image-test-'))
  bundle = path.join(directory, 'selected.app')
  await fs.mkdir(bundle)
  bundle = await fs.realpath(bundle)
  selected = path.join(bundle, 'helper')
  await fs.writeFile(selected, '')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

describe('protected text image identity', () => {
  it('verifies unrelated mapped files using device and inode without reading their protected paths', async () => {
    const unrelated = path.join(directory, 'protected-data')
    await fs.writeFile(unrelated, '')
    const stat = await fs.stat(unrelated, { bigint: true })
    command.mockResolvedValue(inventory(unrelated, stat.dev, stat.ino))
    const verify = createProtectedImageVerifier(await fs.realpath(bundle))
    await verify(21, unrelated)
    await verify(21, unrelated)
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('rejects an installation image hidden behind an inaccessible alias', async () => {
    const stat = await fs.stat(selected, { bigint: true })
    const alias = path.join(directory, 'protected-alias')
    command.mockResolvedValue(inventory(alias, stat.dev, stat.ino))
    await expect(createProtectedImageVerifier(await fs.realpath(bundle))(21, alias)).rejects.toThrow('still has a live process')
  })

  it('does not follow installation symlinks into an unrelated bundle', async () => {
    const unrelated = path.join(directory, 'other-helper')
    await fs.writeFile(unrelated, '')
    await fs.symlink(unrelated, path.join(bundle, 'external'), 'file')
    const stat = await fs.stat(unrelated, { bigint: true })
    command.mockResolvedValue(inventory(unrelated, stat.dev, stat.ino))
    await createProtectedImageVerifier(await fs.realpath(bundle))(21, unrelated)
  })

  it('preserves failure when the selected installation cannot be fully inspected', async () => {
    command.mockResolvedValue(inventory('/protected/image', 1n, 2n))
    vi.spyOn(fs, 'readdir').mockRejectedValue(Object.assign(new Error('installation denied'), { code: 'EACCES' }))
    await expect(createProtectedImageVerifier(bundle)(21, '/protected/image')).rejects.toThrow('installation denied')
  })

  it.each([
    { stdout: '', stderr: '', exitCode: 0 },
    { stdout: 'p22\0\nftxt\0tREG\0D0x1\0i2\0n/protected/image\0\n', stderr: '', exitCode: 0 },
    { stdout: 'p21\0\nftxt\0tREG\0n/protected/image\0\n', stderr: '', exitCode: 0 },
    { stdout: 'p21\0\nftxt\0tREG\0D0x1\0i2\0n/other/image\0\n', stderr: '', exitCode: 0 },
    { stdout: '', stderr: 'permission denied', exitCode: 1 },
  ])('refuses partial, foreign or missing image identities %#', async (result) => {
    command.mockResolvedValue(result)
    await expect(createProtectedImageVerifier(bundle)(21, '/protected/image')).rejects.toThrow()
  })
})
