import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptDigest } from '../identity'
import { scriptBaselineSources } from '../installHelpers/source'
import { SCRIPT_VARIANTS } from '../types'
import { runScriptTiming } from './run'

const { createProcess, identity } = vi.hoisted(() => ({ createProcess: vi.fn(), identity: vi.fn() }))
vi.mock('./process', () => ({ createScriptTimingProcess: createProcess }))
vi.mock('../identity', async importOriginal => ({ ...await importOriginal<object>(), scriptSourceIdentity: identity }))

const hashes = Object.fromEntries(scriptBaselineSources.map(file => [file, scriptDigest(file)]))
const directories: string[] = []
beforeEach(() => {
  createProcess.mockReset()
  identity.mockReset().mockResolvedValue(hashes)
})
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function outputDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'script-timing-run-'))
  directories.push(directory)
  return path.join(directory, 'new-result')
}

describe('one script timing run', () => {
  it.each(['none', 'error', 'input', 'output'] as const)('checks every call and preserves failures after initial correctness (%s)', async (fault) => {
    const output = await outputDirectory()
    const closed: string[] = []
    let requests = 0
    createProcess.mockImplementation(async (variant: string) => {
      let calls = 0
      return {
        ready: { sourceHashes: variant === 'baseline' ? {} : hashes },
        compile: async (scenario: unknown) => {
          calls++
          requests++
          const failing = variant === 'optimized' && calls === 2 && fault !== 'none'
          return {
            output: failing && fault !== 'input' ? JSON.stringify({ error: { code: 'WV1002', message: 'preserve this failure' } }) : '{"value":"stable"}',
            inputSha256: scriptDigest(failing && fault === 'input' ? 'changed input' : JSON.stringify(scenario)),
            failed: failing && fault === 'error',
            metrics: variant === 'baseline' ? {} : { activeCompiles: 0, pendingTransfers: 0, astAlreadyConsumed: 0 },
            wallMs: 1,
            cpuMicroseconds: 0,
            rssAfterBytes: 1024,
          }
        },
        close: async () => { closed.push(variant) },
      }
    })
    const result = await runScriptTiming({ output, iterations: 14, batch: 1, scenario: 'sfc-pressure' })
    expect(closed).toEqual([...SCRIPT_VARIANTS].reverse())
    expect(result.cleanupErrors).toEqual([])
    expect(result.passed).toBe(fault === 'none')
    if (fault === 'none') {
      expect(requests).toBe(7 * (1 + 14 + 14))
      expect(result.completedPairs).toBe(14)
      expect(result.warmupRounds).toBe(14)
    }
    else {
      expect(result.completedPairs).toBe(0)
      const artifact = JSON.parse(await readFile(path.join(output, 'optimized-mismatch.json'), 'utf8')) as { actual: { output: string, inputSha256: string }, expectedInputSha256: string, expectedOutput: string }
      expect(artifact.expectedOutput).toBe('{"value":"stable"}')
      if (fault === 'input') {
        expect(artifact.actual.inputSha256).not.toBe(artifact.expectedInputSha256)
      }
      else {
        expect(artifact.actual.output).toContain('preserve this failure')
      }
    }
  })
})
