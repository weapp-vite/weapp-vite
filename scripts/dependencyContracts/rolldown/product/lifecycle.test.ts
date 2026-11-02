import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { inflightError } from './lifecycle.mjs'

it('observes the original generate error and native close before releasing a late sibling callback', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rolldown-public-lifecycle-'))
  let siblingCompleted = false
  const closeObservations: boolean[] = []
  const bundle = {
    closed: false,
    generate: vi.fn(),
    close: vi.fn(async () => {
      closeObservations.push(siblingCompleted)
      bundle.closed = true
    }),
  }
  const rolldown = vi.fn(async (options: {
    plugins: Array<{ renderChunk: (code: string, chunk: { name: string }, output: { format: string }) => Promise<string> }>
  }) => {
    const plugin = options.plugins[0]!
    bundle.generate.mockImplementationOnce(async () => {
      const alpha = plugin.renderChunk('export const result = 42', { name: 'alpha' }, { format: 'es' })
      const beta = plugin.renderChunk('export const result = 7', { name: 'beta' }, { format: 'es' }).then((value) => {
        siblingCompleted = true
        return value
      })
      await Promise.all([alpha, beta])
    })
    return bundle
  })
  try {
    const observation = await inflightError(rolldown, root)
    expect(observation.failure).toMatchObject({ status: 'rejected', error: { message: 'snapshot-contract-render-failure' } })
    expect(observation.outcomes).toEqual([
      { name: 'alpha', status: 'rejected', error: expect.objectContaining({ message: 'snapshot-contract-render-failure' }) },
      { name: 'beta', status: 'fulfilled' },
    ])
    expect(observation.events.slice(2)).toEqual(['generate:rejected', 'close:resolved', 'callback:released', 'finish:beta'])
    expect(bundle.generate).toHaveBeenCalledExactlyOnceWith({ format: 'es' })
    expect(closeObservations).toEqual([false, true])
    expect(siblingCompleted).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
