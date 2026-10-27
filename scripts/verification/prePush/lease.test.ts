import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { withPushLease } from './lease.ts'

const roots = new Set<string>()
afterEach(async () => {
  await Promise.all([...roots].map(async (root) => {
    await rm(root, { recursive: true, force: true })
    roots.delete(root)
  }))
})

async function directory() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'push-lease-'))
  roots.add(root)
  return root
}

it('serializes pushes and releases only its own lease after failure', async () => {
  const root = await directory()
  await expect(withPushLease(root, async () => {
    await expect(withPushLease(root, async () => {})).rejects.toThrow('已有 pre-push')
    throw new Error('verification failed')
  })).rejects.toThrow('verification failed')
  await expect(withPushLease(root, async () => 'retry')).resolves.toBe('retry')
})

it('preserves a lease whose owner changed instead of deleting another task record', async () => {
  const root = await directory()
  const owner = path.join(root, '.tmp/verification/pre-push/active/owner.json')
  await expect(withPushLease(root, async () => writeFile(owner, 'other-owner'))).rejects.toThrow('所有权已变化')
  expect(await readFile(owner, 'utf8')).toBe('other-owner')
})
