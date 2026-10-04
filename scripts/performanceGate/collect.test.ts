/* eslint-disable e18e/ban-dependencies -- 测试采集器子进程边界，不启动实际基准。 */
import type { Checkout } from './collect'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execa } from 'execa'
import { afterEach, expect, it, vi } from 'vitest'
import { collectHmr } from './collect'
import { policy } from './contract.mjs'
import { PartialHmrCollectionError } from './hmrSamples'
import { hmrProfileCapability } from './profileCapability.mjs'

vi.mock('execa', () => ({ execa: vi.fn() }))
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})

it.each([
  ['baseline', policy.baselineSha, 'stateful-experimental', false],
  ['baseline', policy.baselineSha, 'classic', true],
  ['optimized', policy.baselineSha, 'stateful-experimental', true],
  ['baseline', 'a'.repeat(40), 'stateful-experimental', true],
  ['optimized', 'a'.repeat(40), 'stateful-experimental', true],
] as const)('freezes profile capability before launching %s %s %s', async (side, commit, runtime, enabled) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-capability-'))
  const checkout: Checkout = { id: side, cwd: root, commit, templates: [{ id: 'native', packageName: 'native', root }] }
  vi.stubEnv('TEMPLATES_HMR_PROFILE', enabled ? '0' : '1')
  try {
    vi.mocked(execa).mockImplementationOnce(((_command: string, _args: string[], options: { env: Record<string, string> }) => {
      expect(options.env.TEMPLATES_HMR_PROFILE).toBe(enabled ? '1' : '0')
      expect(options.env.TEMPLATES_HMR_ITERATIONS).toBe('2')
      expect(options.env.TEMPLATES_HMR_MAX_SCENARIOS_PER_TEMPLATE).toBe('4')
      expect(options.env).not.toHaveProperty('TEMPLATES_HMR_SCENARIO_FILTER')
      return (async () => {
        const capability = JSON.parse(await readFile(path.join(root, 'profile-capability.json'), 'utf8')) as unknown
        expect(capability).toEqual(hmrProfileCapability(side, commit, runtime))
        const cycle = { edit: { wallMs: 10, phase: 'edit', profileStatus: enabled ? 'missing' : 'disabled' }, restore: { wallMs: 20, phase: 'restore', profileStatus: enabled ? 'missing' : 'disabled' } }
        await writeFile(path.join(root, 'report.json'), JSON.stringify({ templates: [{ id: 'native', scenarios: [
          { id: 'template', samples: [cycle.edit, cycle.edit], cycles: [cycle, cycle] },
          { id: 'script', samples: [], error: 'Timed out waiting for a stateful HMR patch batch matching the current source mutation.' },
        ] }] }))
        return { exitCode: 0, stdout: '', stderr: '' }
      })()
    }) as never)
    let failure: unknown
    try {
      await collectHmr(checkout, root, root, runtime)
    }
    catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(PartialHmrCollectionError)
    const partial = failure as PartialHmrCollectionError
    expect(partial.message).toContain('native/script: Timed out waiting for a stateful HMR patch batch')
    expect(partial.samples).toHaveLength(4)
    expect(partial.samples.map(sample => sample.phase)).toEqual(['first:edit', 'first:restore', 'repeat:edit', 'repeat:restore'])
    expect(partial.samples.every(sample => sample.profileStatus === (enabled ? 'missing' : 'unavailable') && sample.profile === undefined)).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
