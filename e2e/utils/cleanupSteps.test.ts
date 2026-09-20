import { expect, it, vi } from 'vitest'
import { runCleanupSteps } from './cleanupSteps'

it('restores files and environment after release failure and preserves all failures', async () => {
  const events: string[] = []
  const stopError = new Error('stop failed')
  const restoreError = new Error('restore failed')
  const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  try {
    const cleanup = runCleanupSteps([
      { label: 'stop', run: async () => {
        events.push('stop')
        throw stopError
      } },
      { label: 'restore', run: async () => {
        events.push('restore')
        throw restoreError
      } },
      { label: 'environment', run: () => { events.push('environment') } },
    ])
    await expect(cleanup).rejects.toMatchObject({
      errors: [expect.objectContaining({ cause: stopError }), expect.objectContaining({ cause: restoreError })],
    })
    expect(events).toEqual(['stop', 'restore', 'environment'])
    expect(output).toHaveBeenLastCalledWith(expect.stringContaining('environment status=passed'))
  }
  finally {
    output.mockRestore()
  }
})
