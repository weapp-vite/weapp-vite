import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { saveSource } from './saveSource'

let root: string
let target: string
const writeFile = fs.writeFile
const original = 'export const value = "old source"\n'
const replacement = 'export const value = "new source"\n'

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'jsx-source-save-'))
  target = path.join(root, 'shared.tsx')
  await writeFile(target, original)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(root, { recursive: true, force: true })
})

it('keeps the complete source visible until its replacement is fully written', async () => {
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  vi.spyOn(fs, 'writeFile').mockImplementationOnce(async (file) => {
    await writeFile(file, replacement.slice(0, 7))
    started.resolve()
    await resume.promise
    await writeFile(file, replacement)
  })
  const saving = saveSource(target, replacement)
  await started.promise
  try {
    expect(await fs.readFile(target, 'utf8')).toBe(original)
  }
  finally {
    resume.resolve()
    await saving
  }
  expect(await fs.readFile(target, 'utf8')).toBe(replacement)
  expect(await fs.readdir(root)).toEqual(['shared.tsx'])
})

it.each(['write', 'rename'])('preserves the source and cleans the temporary file after %s failure', async (stage) => {
  const failure = new Error('source save failed')
  if (stage === 'write') {
    vi.spyOn(fs, 'writeFile').mockImplementationOnce(async (file) => {
      await writeFile(file, 'partial')
      throw failure
    })
  }
  else {
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(failure)
  }
  await expect(saveSource(target, replacement)).rejects.toBe(failure)
  expect(await fs.readFile(target, 'utf8')).toBe(original)
  expect(await fs.readdir(root)).toEqual(['shared.tsx'])
})
