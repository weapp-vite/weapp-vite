import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDoctorSessionCacheOwner } from './doctorSessionCache'

describe('Doctor fixture session cache ownership', () => {
  let directory: string
  let filePath: string
  let identity: Parameters<typeof createDoctorSessionCacheOwner>[1]

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'doctor-session-cache-'))
    filePath = path.join(directory, 'sessions', 'owned.json')
    identity = {
      installationId: 'selected-installation',
      projectPath: path.join(directory, 'fixture'),
      port: 19620,
      wsEndpoint: 'ws://127.0.0.1:19620',
    }
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const payload = (value: typeof identity) => JSON.stringify({ ...value, updatedAt: '2026-01-01T00:00:00.000Z' })

  async function persistOwned() {
    const owner = createDoctorSessionCacheOwner(filePath, identity)
    const write = vi.fn(async () => {
      await fs.writeFile(filePath, payload(identity))
    })
    await owner.persist(write)
    return { owner, write }
  }

  it('reserves a new file before persistence and removes only that file after cleanup', async () => {
    const owner = createDoctorSessionCacheOwner(filePath, identity)
    const write = vi.fn(async () => {
      expect((await fs.lstat(filePath)).isFile()).toBe(true)
      expect(await fs.readFile(filePath, 'utf8')).toBe('')
      await fs.writeFile(filePath, payload(identity))
    })
    await owner.persist(write)
    expect(write).toHaveBeenCalledOnce()
    expect(await fs.readFile(filePath, 'utf8')).toBe(payload(identity))
    await owner.cleanup()
    await expect(fs.lstat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reuses an existing matching record without rewriting or deleting it', async () => {
    await fs.mkdir(path.dirname(filePath))
    const original = payload(identity)
    await fs.writeFile(filePath, original)
    const before = await fs.lstat(filePath, { bigint: true })
    const owner = createDoctorSessionCacheOwner(filePath, identity)
    const write = vi.fn(async () => {})
    await owner.persist(write)
    await owner.cleanup()
    expect(write).not.toHaveBeenCalled()
    expect(await fs.readFile(filePath, 'utf8')).toBe(original)
    const after = await fs.lstat(filePath, { bigint: true })
    expect([after.dev, after.ino, after.ctimeNs, after.mtimeNs]).toEqual([before.dev, before.ino, before.ctimeNs, before.mtimeNs])
  })

  it.each(['installationId', 'projectPath', 'wsEndpoint'] as const)('preserves a conflicting existing %s without calling persist', async (key) => {
    await fs.mkdir(path.dirname(filePath))
    const foreign = payload({ ...identity, [key]: 'another-owner' })
    await fs.writeFile(filePath, foreign)
    const owner = createDoctorSessionCacheOwner(filePath, identity)
    const write = vi.fn(async () => {})
    await expect(owner.persist(write)).rejects.toThrow('unowned identity')
    await owner.cleanup()
    expect(write).not.toHaveBeenCalled()
    expect(await fs.readFile(filePath, 'utf8')).toBe(foreign)
  })

  it('preserves records for other installations and projects beside the owned cache', async () => {
    const { owner } = await persistOwned()
    const foreignRecords = [
      ['another-installation.json', { ...identity, installationId: 'another-installation' }],
      ['another-project.json', { ...identity, projectPath: path.join(directory, 'other-fixture') }],
    ] as const
    for (const [name, session] of foreignRecords) {
      await fs.writeFile(path.join(path.dirname(filePath), name), payload(session))
    }
    await owner.cleanup()
    await expect(fs.lstat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
    for (const [name, session] of foreignRecords) {
      expect(await fs.readFile(path.join(path.dirname(filePath), name), 'utf8')).toBe(payload(session))
    }
  })

  it('preserves a replacement inode even when its bytes match the original record', async () => {
    const { owner } = await persistOwned()
    const original = await fs.lstat(filePath, { bigint: true })
    const replacement = path.join(directory, 'replacement.json')
    await fs.writeFile(replacement, payload(identity))
    expect((await fs.lstat(replacement, { bigint: true })).ino).not.toBe(original.ino)
    await fs.rename(replacement, filePath)
    await owner.cleanup()
    expect(await fs.readFile(filePath, 'utf8')).toBe(payload(identity))
  })

  it('preserves the same inode after its content or metadata changes', async () => {
    const changed = await persistOwned()
    const foreign = payload({ ...identity, wsEndpoint: 'ws://127.0.0.1:19621' })
    await fs.writeFile(filePath, foreign)
    await changed.owner.cleanup()
    expect(await fs.readFile(filePath, 'utf8')).toBe(foreign)

    const otherFile = path.join(directory, 'metadata.json')
    const otherOwner = createDoctorSessionCacheOwner(otherFile, identity)
    await otherOwner.persist(async () => {
      await fs.writeFile(otherFile, payload(identity))
    })
    const before = await fs.lstat(otherFile)
    await fs.utimes(otherFile, before.atime, new Date(before.mtimeMs + 10_000))
    await otherOwner.cleanup()
    expect(await fs.readFile(otherFile, 'utf8')).toBe(payload(identity))
  })

  it('preserves non-file replacements', async () => {
    const { owner } = await persistOwned()
    await fs.unlink(filePath)
    await fs.mkdir(filePath)
    await owner.cleanup()
    expect((await fs.lstat(filePath)).isDirectory()).toBe(true)
  })

  it('retries a failed deletion and remains idempotent after successful cleanup', async () => {
    const { owner } = await persistOwned()
    const failure = Object.assign(new Error('file busy'), { code: 'EPERM' })
    const unlink = vi.spyOn(fs, 'unlink').mockRejectedValueOnce(failure)
    await expect(owner.cleanup()).rejects.toBe(failure)
    expect(await fs.readFile(filePath, 'utf8')).toBe(payload(identity))
    await owner.cleanup()
    expect(unlink).toHaveBeenCalledTimes(2)
    await fs.writeFile(filePath, 'new owner after successful cleanup')
    await owner.cleanup()
    expect(unlink).toHaveBeenCalledTimes(2)
    expect(await fs.readFile(filePath, 'utf8')).toBe('new owner after successful cleanup')
  })

  it('shares concurrent cleanup and waits for the same deletion', async () => {
    const { owner } = await persistOwned()
    const barrier = Promise.withResolvers<void>()
    const originalUnlink = fs.unlink.bind(fs)
    const unlink = vi.spyOn(fs, 'unlink').mockImplementation(async (target) => {
      await barrier.promise
      await originalUnlink(target)
    })
    const first = owner.cleanup()
    const second = owner.cleanup()
    expect(second).toBe(first)
    await vi.waitFor(() => expect(unlink).toHaveBeenCalledOnce())
    expect((await fs.lstat(filePath)).isFile()).toBe(true)
    barrier.resolve()
    await Promise.all([first, second])
    await expect(fs.lstat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('releases its new reservation after persistence fails before writing', async () => {
    const owner = createDoctorSessionCacheOwner(filePath, identity)
    const failure = new Error('live port identity rejected')
    await expect(owner.persist(async () => {
      throw failure
    })).rejects.toBe(failure)
    await owner.cleanup()
    await expect(fs.lstat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves a record replaced while the public persist operation is running', async () => {
    const owner = createDoctorSessionCacheOwner(filePath, identity)
    await expect(owner.persist(async () => {
      const replacement = path.join(directory, 'concurrent-owner.json')
      await fs.writeFile(replacement, payload(identity))
      await fs.rename(replacement, filePath)
    })).rejects.toThrow('replaced')
    await owner.cleanup()
    expect(await fs.readFile(filePath, 'utf8')).toBe(payload(identity))
  })

  it('waits for an ongoing persist before cleanup and rejects later registrations', async () => {
    const owner = createDoctorSessionCacheOwner(filePath, identity)
    const barrier = Promise.withResolvers<void>()
    const write = vi.fn(async () => {
      await barrier.promise
      await fs.writeFile(filePath, payload(identity))
    })
    const pending = owner.persist(write)
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce())
    const cleanup = owner.cleanup()
    barrier.resolve()
    await Promise.all([pending, cleanup])
    await expect(fs.lstat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(owner.persist(write)).rejects.toThrow('cleanup has already started')
    expect(write).toHaveBeenCalledOnce()
  })
})
