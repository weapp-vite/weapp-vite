import type { BenchmarkOutputChanges } from './outputChanges'
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { waitForBenchmarkOutput } from './emittedOutput'
import { createBenchmarkOutputChanges } from './outputChanges'

describe('event assisted complete output observation', () => {
  let root: string
  const observers: BenchmarkOutputChanges[] = []

  function observe(directory = root) {
    const observer = createBenchmarkOutputChanges(directory)
    observers.push(observer)
    return observer
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hmr-output-hints-'))
  })

  afterEach(async () => {
    for (const observer of observers.splice(0)) {
      observer.close()
    }
    await rm(root, { recursive: true, force: true })
  })

  it('wakes for atomic replacement without waiting for the polling interval', async () => {
    const file = path.join(root, 'index.wxml')
    const temporary = path.join(root, 'replacement.wxml')
    await writeFile(file, '<view>old</view>')
    await writeFile(temporary, '<view>target</view>')
    const changes = observe()
    let firstRead = true
    const result = waitForBenchmarkOutput(async () => {
      const content = await readFile(file, 'utf8')
      if (firstRead) {
        firstRead = false
        await rename(temporary, file)
      }
      return content
    }, 'target', { timeoutMs: 2_000, intervalMs: 60_000, changes })
    await expect(result).resolves.toBe('<view>target</view>')
  })

  it('retains a hint received while an asynchronous read was in flight', async () => {
    const changes = observe()
    let firstRead = true
    await expect(waitForBenchmarkOutput(async () => {
      if (!firstRead) {
        return '<view>target</view>'
      }
      firstRead = false
      const before = changes.revision
      const event = changes.wait(before, 2_000)
      await writeFile(path.join(root, 'index.wxml'), '<view>target</view>')
      await event
      expect(changes.revision).toBeGreaterThan(before)
      return '<view>old</view>'
    }, 'target', { timeoutMs: 3_000, intervalMs: 60_000, changes }))
      .resolves
      .toBe('<view>target</view>')
  })

  it('does not accept a partial restore or an unrelated event as success', async () => {
    const changes = observe()
    let reads = 0
    await expect(waitForBenchmarkOutput(async () => {
      reads += 1
      await writeFile(path.join(root, 'unrelated'), String(reads))
      return reads === 1 ? '' : reads === 2 ? '<view>partial' : '<view>original</view>'
    }, 'target', { absent: true, expectedContent: '<view>original</view>', timeoutMs: 2_000, changes }))
      .resolves
      .toBe('<view>original</view>')
    expect(reads).toBe(3)
  })

  it('keeps polling when watching fails or a change hint is unavailable', async () => {
    const changes = observe(path.join(root, 'missing-directory'))
    let reads = 0
    await expect(waitForBenchmarkOutput(async () => ++reads === 1 ? 'old' : 'target', 'target', {
      timeoutMs: 100,
      intervalMs: 1,
      changes,
    })).resolves.toBe('target')
  })

  it('cancels a pending wait and permits idempotent targeted close', async () => {
    const changes = observe()
    const cancellation = new AbortController()
    const failure = new Error('consumer stopped')
    const wait = changes.wait(changes.revision, 60_000, cancellation.signal)
    cancellation.abort(failure)
    await expect(wait).rejects.toBe(failure)
    const closing = changes.wait(changes.revision, 60_000)
    changes.close()
    changes.close()
    await expect(closing).resolves.toBeUndefined()
    await expect(changes.wait(changes.revision, 1)).resolves.toBeUndefined()
  })
})
