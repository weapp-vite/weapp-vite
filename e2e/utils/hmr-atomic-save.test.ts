import nodeFs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { replaceFileByRename } from './hmr-helpers'

let root: string
let target: string
const oldContent = 'export const value = "complete old source"\n'
const newContent = 'export const value = "complete new source"\n'
const nativeRename = nodeFs.rename

beforeEach(async () => {
  root = await nodeFs.mkdtemp(path.join(os.tmpdir(), 'hmr-atomic-save-'))
  target = path.join(root, 'index.ts')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await nodeFs.rm(root, { recursive: true, force: true })
})

async function readTarget() {
  try {
    return await nodeFs.readFile(target, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

describe('HMR atomic rename save', () => {
  it('keeps the complete old target visible while the replacement is only partially written', async () => {
    await nodeFs.writeFile(target, oldContent)
    const writing = Promise.withResolvers<string>()
    const resume = Promise.withResolvers<void>()
    vi.spyOn(fs, 'writeFile').mockImplementationOnce(async (file) => {
      await nodeFs.writeFile(file, newContent.slice(0, 7))
      writing.resolve(String(file))
      await resume.promise
      await nodeFs.writeFile(file, newContent)
    })
    const pending = replaceFileByRename(target, newContent)
    const temporary = await writing.promise
    let duringWrite: string | undefined
    try {
      duringWrite = await readTarget()
    }
    finally {
      resume.resolve()
      await pending
    }
    expect(duringWrite).toBe(oldContent)
    expect(temporary).not.toBe(target)
    expect(path.resolve(path.dirname(temporary))).toBe(path.resolve(root))
    expect(await readTarget()).toBe(newContent)
    expect(await nodeFs.readdir(root)).toEqual(['index.ts'])
  })

  it('preserves the old target and removes a partially written temporary file after write failure', async () => {
    await nodeFs.writeFile(target, oldContent)
    const failure = new Error('simulated write failure')
    vi.spyOn(fs, 'writeFile').mockImplementationOnce(async (file) => {
      await nodeFs.writeFile(file, 'partial')
      throw failure
    })
    await expect(replaceFileByRename(target, newContent)).rejects.toBe(failure)
    expect(await readTarget()).toBe(oldContent)
    expect(await nodeFs.readdir(root)).toEqual(['index.ts'])
  })

  it('preserves the old target and cleans the complete temporary file when publication fails', async () => {
    await nodeFs.writeFile(target, oldContent)
    const failure = Object.assign(new Error('simulated rename failure'), { code: 'EPERM' })
    const rename = vi.spyOn(nodeFs, 'rename').mockRejectedValueOnce(failure)
    await expect(replaceFileByRename(target, newContent)).rejects.toBe(failure)
    expect(rename).toHaveBeenCalledOnce()
    expect(await readTarget()).toBe(oldContent)
    expect(await nodeFs.readdir(root)).toEqual(['index.ts'])
  })

  it('publishes a previously absent target only after its complete contents have been written', async () => {
    const rename = vi.spyOn(nodeFs, 'rename').mockImplementationOnce(async (source, destination) => {
      expect(await readTarget()).toBeUndefined()
      expect(await nodeFs.readFile(source, 'utf8')).toBe(newContent)
      await nativeRename(source, destination)
    })
    await replaceFileByRename(target, newContent)
    expect(rename).toHaveBeenCalledOnce()
    expect(await readTarget()).toBe(newContent)
    expect(await nodeFs.readdir(root)).toEqual(['index.ts'])
  })
})
