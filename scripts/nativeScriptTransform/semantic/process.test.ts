import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runSemanticProcess } from './process'

describe('semantic parent process watchdog', () => {
  it('preserves strict exit one and terminates an unresponsive child with evidence', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'semantic-watchdog-'))
    try {
      expect(await runSemanticProcess(['-e', 'process.exitCode = 1'], path.join(directory, 'strict'), 5_000)).toBe(1)
      await expect(runSemanticProcess(['-e', 'setInterval(() => {}, 1000)'], path.join(directory, 'hung'), 500)).rejects.toThrow('timed out')
      const status = JSON.parse(await readFile(path.join(directory, 'hung.process.json'), 'utf8')) as { timedOut: boolean }
      expect(status.timedOut).toBe(true)
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
