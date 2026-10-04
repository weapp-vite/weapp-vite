import { expect, it } from 'vitest'
import { getCompilerSourceSnapshot, readCompilerInput, setCompilerSourceSnapshot, withCompilerSourceSnapshot } from './sourceSnapshot'

it('restores nested source versions after success and failure without losing empty inputs', async () => {
  const owner = {}
  const original = new Map([['/project/input.ts', 'original']])
  setCompilerSourceSnapshot(owner, original)
  const outer = new Map([['/project/input.ts', '']])
  await withCompilerSourceSnapshot(owner, outer, async () => {
    expect(await readCompilerInput(owner, '/project/input.ts')).toBe('')
    await expect(withCompilerSourceSnapshot(owner, new Map([['/project/input.ts', 'inner']]), async () => {
      expect(await readCompilerInput(owner, '/project/input.ts')).toBe('inner')
      throw new Error('cancelled')
    })).rejects.toThrow('cancelled')
    expect(getCompilerSourceSnapshot(owner)).toBe(outer)
  })
  expect(getCompilerSourceSnapshot(owner)).toBe(original)
})

it('removes only the temporary snapshot when no outer version exists', async () => {
  const owner = {}
  await expect(withCompilerSourceSnapshot(owner, new Map(), async () => {
    throw new Error('failed build')
  })).rejects.toThrow('failed build')
  expect(getCompilerSourceSnapshot(owner)).toBeUndefined()
})
