import type { BigIntStats, Stats } from 'node:fs'
import { Buffer } from 'node:buffer'
import { renameSync, writeFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureActiveLogCursor, captureLogCursors, consumeFreshLogLines, recoverLogCursors } from './logCursor'

const firstInode = BigInt(Number.MAX_SAFE_INTEGER) + 1n
const secondInode = firstInode + 1n
const version = '2.02.2608070'
const initial = `[timestamp][INFO][${version}][MAIN] initial\n`
let directory: string
let filename: string
let device: bigint
let pathInode: bigint
let sizeOverride: bigint | undefined
let replaceBeforeOpen: boolean

/** 保留真实 stat 的文件类型和真实读写，只模拟宿主可能返回的大整数元数据。 */
function withIdentity<T extends Stats | BigIntStats>(stat: T, inode: bigint): T {
  return Object.assign(stat, {
    ino: typeof stat.ino === 'bigint' ? inode : Number(inode),
    ...(sizeOverride === undefined ? {} : { size: typeof stat.size === 'bigint' ? sizeOverride : Number(sizeOverride) }),
  })
}

function active(inode = pathInode) {
  return { name: path.basename(filename), identity: `${device}:${inode}` }
}

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'window-log-identity-'))
  filename = path.join(directory, 'current.log')
  await fs.writeFile(filename, initial)
  device = (await fs.stat(filename, { bigint: true })).dev
  pathInode = firstInode
  sizeOverride = undefined
  replaceBeforeOpen = false

  const lstat = fs.lstat.bind(fs)
  vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => withIdentity(await lstat(...args), pathInode))
  const open = fs.open.bind(fs)
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    if (replaceBeforeOpen) {
      replaceBeforeOpen = false
      await fs.rename(filename, `${filename}.old`)
      await fs.writeFile(filename, initial)
      pathInode = secondInode
    }
    const file = await open(...args)
    const inode = pathInode
    const stat = file.stat.bind(file)
    vi.spyOn(file, 'stat').mockImplementation(async (...options) => withIdentity(await stat(...options), inode))
    return file
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

describe('window-close log identity precision', () => {
  it.each([firstInode, secondInode])('captures and consumes the same file with exact inode %s', async (inode) => {
    expect(firstInode).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER))
    expect(Number(firstInode)).toBe(Number(secondInode))
    pathInode = inode
    const cursors = await captureActiveLogCursor(directory, active())
    expect(cursors).toMatchObject([{ identity: `${device}:${inode}`, offset: Buffer.byteLength(initial) }])
    await fs.appendFile(filename, 'native-window-closed\n')
    const consume = vi.fn()
    await expect(consumeFreshLogLines(directory, cursors, consume)).resolves.toBe(true)
    expect(consume).toHaveBeenCalledExactlyOnceWith({ fileIdentity: `${device}:${inode}`, line: 'native-window-closed' })
    expect(cursors[0]?.offset).toBe(Buffer.byteLength(`${initial}native-window-closed\n`))
  })

  it('preserves the exact identity through MAIN selection and legacy inventory recovery', async () => {
    pathInode = secondInode
    const cursors = await captureLogCursors(directory, version)
    expect(cursors[0]?.identity).toBe(`${device}:${secondInode}`)
    await expect(recoverLogCursors(directory, cursors, version)).resolves.toEqual(cursors)
    await fs.appendFile(filename, 'webcontents-destroyed\n')
    const consume = vi.fn()
    await expect(consumeFreshLogLines(directory, cursors, consume)).resolves.toBe(true)
    expect(consume).toHaveBeenCalledExactlyOnceWith({ fileIdentity: `${device}:${secondInode}`, line: 'webcontents-destroyed' })
  })

  it('rejects a different inode with the same Number value when the file changes during opening', async () => {
    replaceBeforeOpen = true
    await expect(captureActiveLogCursor(directory, active(firstInode))).rejects.toThrow('changed while opening its evidence stream')
  })

  it('rejects a different inode with the same Number value when the path changes after reading', async () => {
    const cursors = await captureActiveLogCursor(directory, active())
    await fs.appendFile(filename, 'native-window-closed\n')
    await expect(consumeFreshLogLines(directory, cursors, () => {
      // 文件句柄仍指向原流，真实替换路径以触发读取后的 lstat 身份复核。
      renameSync(filename, `${filename}.old`)
      writeFileSync(filename, `${initial}native-window-closed\n`)
      pathInode = secondInode
    })).rejects.toThrow('changed while reading its evidence stream')
  })

  it('rejects a rounded legacy cursor instead of accepting it as the current exact identity', async () => {
    pathInode = secondInode
    const cursors = await captureLogCursors(directory, version)
    cursors[0]!.identity = `${device}:${Number(secondInode)}`
    const consume = vi.fn()
    await expect(consumeFreshLogLines(directory, cursors, consume)).rejects.toThrow('replaced, truncated, or rewritten')
    expect(consume).not.toHaveBeenCalled()
  })

  it.each(['active', 'main'] as const)('rejects unsafe file sizes before %s cursor capture', async (mode) => {
    sizeOverride = BigInt(Number.MAX_SAFE_INTEGER) + 1n
    await expect(mode === 'active' ? captureActiveLogCursor(directory, active()) : captureLogCursors(directory, version)).rejects.toThrow('size exceeds the supported safe integer range')
  })

  it('rejects unsafe file sizes before consuming evidence', async () => {
    const cursors = await captureActiveLogCursor(directory, active())
    sizeOverride = BigInt(Number.MAX_SAFE_INTEGER) + 1n
    const consume = vi.fn()
    await expect(consumeFreshLogLines(directory, cursors, consume)).rejects.toThrow('size exceeds the supported safe integer range')
    expect(consume).not.toHaveBeenCalled()
  })

  it('rejects unsafe persisted cursor offsets before consuming evidence', async () => {
    const cursors = await captureActiveLogCursor(directory, active())
    cursors[0]!.offset = Number.MAX_SAFE_INTEGER + 1
    const consume = vi.fn()
    await expect(consumeFreshLogLines(directory, cursors, consume)).rejects.toThrow('offset exceeds the supported safe integer range')
    expect(consume).not.toHaveBeenCalled()
  })
})
