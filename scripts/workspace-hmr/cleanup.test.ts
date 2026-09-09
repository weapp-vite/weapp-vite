import { describe, expect, it } from 'vitest'
import { collectWorkspaceHmrCleanupErrors, isWorkspaceHmrScenarioRetryable } from './cleanup'

describe('workspace HMR cleanup', () => {
  it('preserves failed source restoration and still checks emitted output', async () => {
    const operations: string[] = []
    const errors = await collectWorkspaceHmrCleanupErrors([
      {
        label: 'source',
        run: async () => {
          operations.push('source')
          throw new Error('write denied')
        },
      },
      {
        label: 'output',
        run: async () => {
          operations.push('output')
          throw new Error('stale marker')
        },
      },
      { label: 'settle', run: async () => { operations.push('settle') } },
    ])
    expect(operations).toEqual(['source', 'output', 'settle'])
    expect(errors).toEqual(['source: write denied', 'output: stale marker'])
    expect(isWorkspaceHmrScenarioRetryable({ error: errors.join('\n'), cleanupErrors: errors })).toBe(false)
  })

  it('retains publication failure even when the emitted marker has disappeared', async () => {
    const errors = await collectWorkspaceHmrCleanupErrors([
      { label: 'publication', run: async () => { throw new Error('batch not acknowledged') } },
      { label: 'output', run: async () => {} },
    ])
    expect(errors).toEqual(['publication: batch not acknowledged'])
    expect(isWorkspaceHmrScenarioRetryable({ error: 'publication failed', cleanupErrors: errors })).toBe(false)
  })

  it('permits a failed measurement to retry only after successful cleanup', async () => {
    const cleanupErrors = await collectWorkspaceHmrCleanupErrors([{ label: 'source', run: async () => {} }])
    expect(isWorkspaceHmrScenarioRetryable({ error: 'measurement timeout', cleanupErrors })).toBe(true)
    expect(isWorkspaceHmrScenarioRetryable({ cleanupErrors })).toBe(false)
  })
})
