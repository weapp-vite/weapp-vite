import { describe, expect, it } from 'vitest'
import { collectWorkspaceHmrCleanupErrors, isWorkspaceHmrScenarioRetryable, readWorkspaceHmrScenarioRetries } from './cleanup'

describe('workspace HMR cleanup', () => {
  it('defaults to a single attempt and accepts an explicit zero retry budget', () => {
    expect(readWorkspaceHmrScenarioRetries(undefined)).toBe(0)
    expect(readWorkspaceHmrScenarioRetries('')).toBe(0)
    expect(readWorkspaceHmrScenarioRetries('  ')).toBe(0)
    expect(readWorkspaceHmrScenarioRetries('0')).toBe(0)
    expect(readWorkspaceHmrScenarioRetries(' 2 ')).toBe(2)
  })

  it.each(['-1', '0.5', '1tail', 'Infinity', '0x2', '1e2', '9007199254740992'])('rejects an invalid retry budget %s', (raw) => {
    expect(() => readWorkspaceHmrScenarioRetries(raw)).toThrow('Invalid WORKSPACE_HMR_SCENARIO_RETRIES')
  })

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
