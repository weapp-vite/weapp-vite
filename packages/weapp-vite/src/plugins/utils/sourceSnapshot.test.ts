import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { captureCompilerNativeScriptInputs, getCompilerSourceSnapshot, readCompilerInput, setCompilerSourceSnapshot, withCompilerSourceSnapshot } from './sourceSnapshot'

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

it('captures the exact returned pinned and raw native inputs without retaining source text', async () => {
  const owner = {}
  const pinned = '/project/pinned.ts'
  const raw = '/project/raw.js'
  setCompilerSourceSnapshot(owner, new Map([[pinned, '']]))
  const result = await captureCompilerNativeScriptInputs(owner, async () => {
    expect(await readCompilerInput(owner, pinned)).toBe('')
    expect(await readCompilerInput(owner, raw, async () => 'Page({})')).toBe('Page({})')
    await readCompilerInput(owner, '/project/app.json', async () => '{}')
    await readCompilerInput(owner, '/project/component.vue', async () => '<template />')
    return 'compiled'
  })
  expect(result.value).toBe('compiled')
  expect([...result.versions]).toEqual([
    [pinned, createHash('sha256').update('').digest('hex')],
    [raw, createHash('sha256').update('Page({})').digest('hex')],
  ])
})

it('isolates nested collectors, unrelated owners and failed scopes', async () => {
  const owner = {}
  const script = '/project/input.js'
  const outer = await captureCompilerNativeScriptInputs(owner, async () => {
    await readCompilerInput(owner, script, async () => 'outer')
    await expect(captureCompilerNativeScriptInputs(owner, async () => {
      await readCompilerInput(owner, script, async () => 'inner')
      throw new Error('failed build')
    })).rejects.toThrow('failed build')
    await readCompilerInput({}, '/project/unrelated.js', async () => 'unrelated')
    await readCompilerInput(owner, '/project/config.js', async () => 'config')
  }, id => id === script)
  await readCompilerInput(owner, script, async () => 'outside')
  expect([...outer.versions]).toEqual([[script, createHash('sha256').update('outer').digest('hex')]])
  const next = await captureCompilerNativeScriptInputs(owner, async () => {})
  expect(next.versions.size).toBe(0)
})
