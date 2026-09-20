import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { runRssSamplingCommand } from './rssCommand'

describe('RSS sampling subprocess bounds', () => {
  it('terminates a non-exiting probe and preserves an unavailable result', async () => {
    expect(await runRssSamplingCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], 100)).toBeNull()
  })

  it('rejects failed command output as evidence while retaining successful output', async () => {
    expect(await runRssSamplingCommand(process.execPath, ['-e', 'process.stdout.write("partial"); process.exitCode = 1'])).toBeNull()
    expect(await runRssSamplingCommand(process.execPath, ['-e', 'process.stdout.write("observed")'])).toBe('observed')
  })
})
