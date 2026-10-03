import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import { withAnalyzeOutput } from './output'

describe('machine readable analyze output', () => {
  it('keeps config, build and cleanup logs off the JSON stream', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      await withAnalyzeOutput(true, async (writeJson) => {
        process.stdout.write('plugin build log\n')
        writeJson({ schemaVersion: 2, budgetChecks: [{ status: 'exceeded' }] })
        process.stdout.write('cleanup log\n')
      })
      expect(stdout).toHaveBeenCalledTimes(1)
      expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toHaveProperty('schemaVersion', 2)
      expect(stderr.mock.calls.map(call => call[0])).toEqual(['plugin build log\n', 'cleanup log\n'])
      expect(process.stdout.write).toBe(stdout)
    }
    finally {
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })

  it('restores stdout after a failed analysis', async () => {
    const original = process.stdout.write
    await expect(withAnalyzeOutput(true, async () => {
      throw new Error('build failed')
    })).rejects.toThrow('build failed')
    expect(process.stdout.write).toBe(original)
  })
})
