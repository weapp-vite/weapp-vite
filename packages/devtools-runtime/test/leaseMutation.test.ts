import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mutateLease } from '../src/index'

let directory: string

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lease-mutation-'))
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

it('permits a longer bounded wait without entering another mutation', async () => {
  const lock = path.join(directory, 'lock')
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const first = mutateLease(lock, async () => {
    entered.resolve()
    await release.promise
  })
  await entered.promise
  const run = vi.fn(async () => 'second')
  const second = mutateLease(lock, run, { timeoutMs: 2_000 })
  try {
    // 超过默认等待期限，确认显式等待仍未绕过当前持有者。
    await setTimeout(300)
    expect(run).not.toHaveBeenCalled()
  }
  finally {
    release.resolve()
    await first
  }
  expect(await second).toBe('second')
  expect(run).toHaveBeenCalledOnce()
  await expect(fs.access(`${lock}.recovery`)).rejects.toThrow()
})

it('leaves an unknown recovery guard intact on timeout', async () => {
  const lock = path.join(directory, 'lock')
  const guard = `${lock}.recovery`
  await fs.mkdir(guard)
  const run = vi.fn(async () => undefined)
  await expect(mutateLease(lock, run, { timeoutMs: 0 })).rejects.toThrow('recovery is in progress')
  expect(run).not.toHaveBeenCalled()
  expect((await fs.stat(guard)).isDirectory()).toBe(true)
})

it('releases only its guard when the mutation fails', async () => {
  const lock = path.join(directory, 'lock')
  const other = path.join(directory, 'other.recovery')
  await fs.mkdir(other)
  const failure = new Error('mutation failed')
  await expect(mutateLease(lock, async () => {
    throw failure
  })).rejects.toBe(failure)
  await expect(fs.access(`${lock}.recovery`)).rejects.toThrow()
  expect((await fs.stat(other)).isDirectory()).toBe(true)
  expect(await mutateLease(lock, async () => 'retry')).toBe('retry')
})

it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects an unbounded or negative timeout: %s', async (timeoutMs) => {
  const run = vi.fn(async () => undefined)
  await expect(mutateLease(path.join(directory, 'lock'), run, { timeoutMs })).rejects.toThrow('finite non-negative')
  expect(run).not.toHaveBeenCalled()
})
