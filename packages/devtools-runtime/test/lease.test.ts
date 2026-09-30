import { mkdtemp, rm } from 'node:fs/promises'

import { tmpdir } from 'node:os'

import path from 'node:path'

import { afterEach, expect, it } from 'vitest'

import { acquireRuntimeLease, runWithRuntimeLease, withRuntimeLease } from '../src/lease'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'runtime-lease-'))

  roots.push(root)

  return root
}

it('excludes competing operations and permits nested operations owned by a task', async () => {
  const root = await fixture()

  const lease = await acquireRuntimeLease(root)

  try {
    await expect(withRuntimeLease(root, async () => true)).rejects.toThrow('Runtime busy')

    expect(await runWithRuntimeLease(lease, () => withRuntimeLease(root, async () => 'owned'))).toBe('owned')
  }
  finally {
    await lease.release()
  }

  expect(await withRuntimeLease(root, async () => 'released')).toBe('released')
})

it('allows separate projects and releases after a failure', async () => {
  const first = await fixture()

  const second = await fixture()

  const lease = await acquireRuntimeLease(first)

  try {
    expect(await withRuntimeLease(second, async () => true)).toBe(true)
  }
  finally {
    await lease.release()
  }

  await expect(withRuntimeLease(first, async () => {
    throw new Error('injected')
  })).rejects.toThrow('injected')

  expect(await withRuntimeLease(first, async () => true)).toBe(true)
})
