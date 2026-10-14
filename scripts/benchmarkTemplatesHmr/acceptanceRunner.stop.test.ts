import type { AcceptanceOptions } from './acceptanceContract'
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { CollectorStopError } from '../performanceGate/collectorStop'
import { HMR_INPUTS } from './acceptanceContract'
import { collectAcceptanceRun } from './acceptanceRunner'

const mocks = vi.hoisted(() => ({ collect: vi.fn(), archiveFailure: false }))
vi.mock('../performanceGate/process', () => ({ runCollector: mocks.collect }))
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
    if (mocks.archiveFailure && String(args[0]).endsWith('profile.raw.jsonl')) {
      throw new Error('Diagnostic archive unavailable')
    }
    return actual.writeFile(...args)
  } }
})
const directories: string[] = []
const input = HMR_INPUTS[1]

afterEach(async () => {
  vi.resetAllMocks()
  mocks.archiveFailure = false
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function options(): Promise<AcceptanceOptions> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-acceptance-fixture-stop-'))
  directories.push(root)
  const config: AcceptanceOptions = { baseline: path.join(root, 'baseline'), candidate: path.join(root, 'candidate'), candidateSha: 'a'.repeat(40), runtime: 'classic', output: path.join(root, 'report') }
  const source = path.join(config.candidate, input.source)
  const packageRoot = path.join(config.baseline, 'packages/weapp-vite')
  const modules = path.join(config.baseline, input.dependencies, 'node_modules')
  await Promise.all([mkdir(source, { recursive: true }), mkdir(packageRoot, { recursive: true }), mkdir(modules, { recursive: true })])
  await Promise.all([writeFile(path.join(source, 'package.json'), '{"name":"input"}'), writeFile(path.join(source, 'source.ts'), 'source evidence'), writeFile(path.join(packageRoot, 'package.json'), '{"name":"weapp-vite"}')])
  await symlink(packageRoot, path.join(modules, 'weapp-vite'), 'junction')
  return config
}

it.each(['cleanup-unconfirmed', 'cancelled', 'ordinary'] as const)('retains staged source only when resource cleanup is unconfirmed: %s', async (reason) => {
  const config = await options()
  let ownedRoot = ''
  mocks.collect.mockImplementation(async (_command, _args, collector) => {
    ownedRoot = path.dirname(collector.env.TEMPLATES_HMR_WORKSPACE_ROOT)
    const profile = path.join(collector.env.TEMPLATES_HMR_WORKSPACE_ROOT, input.id, '.weapp-vite/hmr-profile.jsonl')
    await mkdir(path.dirname(profile), { recursive: true })
    await writeFile(profile, '{"totalMs":12.5}\n')
    throw reason === 'ordinary' ? new Error('Original collector failure') : new CollectorStopError(new Error('Original collector failure'), reason === 'cleanup-unconfirmed' ? { error: new Error('Identity unavailable') } : undefined, reason === 'cancelled')
  })
  const result = await collectAcceptanceRun(config, 'baseline', input, 0, 'primary', Date.now() + 60_000)
  expect(mocks.collect).toHaveBeenCalledTimes(1)
  expect(result.error).toContain('Original collector failure')
  if (reason === 'cleanup-unconfirmed') {
    expect(result.stop).toMatchObject({ reason, resourcesReleased: false })
    expect(result.retainedInput).toEqual({ checkout: 'baseline', relativePath: path.relative(config.baseline, ownedRoot).replaceAll('\\', '/') })
    expect(await readFile(path.join(ownedRoot, 'input', input.id, 'source.ts'), 'utf8')).toBe('source evidence')
    expect(JSON.stringify(result)).not.toContain(path.dirname(config.baseline))
  }
  else {
    await expect(access(ownedRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(result.retainedInput).toBeUndefined()
    expect(result.stop?.reason).toBe(reason === 'cancelled' ? 'cancelled' : undefined)
  }
  expect(await readFile(path.join(config.output, 'primary', input.id, '0/baseline/profile.raw.jsonl'), 'utf8')).toBe('{"totalMs":12.5}\n')
})

it('preserves unconfirmed ownership and the original failure when diagnostic archiving also fails', async () => {
  const config = await options()
  const stopped = new CollectorStopError(new Error('Original collector failure'), { error: new Error('Identity unavailable') }, false)
  let ownedRoot = ''
  mocks.collect.mockImplementation(async (_command, _args, collector) => {
    ownedRoot = path.dirname(collector.env.TEMPLATES_HMR_WORKSPACE_ROOT)
    const profile = path.join(collector.env.TEMPLATES_HMR_WORKSPACE_ROOT, input.id, '.weapp-vite/hmr-profile.jsonl')
    await mkdir(path.dirname(profile), { recursive: true })
    await writeFile(profile, 'original raw source')
    mocks.archiveFailure = true
    throw stopped
  })
  const result = await collectAcceptanceRun(config, 'baseline', input, 0, 'primary', Date.now() + 60_000)
  expect(result.stop).toEqual(stopped.stop)
  expect(result.error).toContain('Original collector failure')
  expect(result.error).toContain('Diagnostic archive unavailable')
  expect(await readFile(path.join(ownedRoot, 'workspace', input.id, '.weapp-vite/hmr-profile.jsonl'), 'utf8')).toBe('original raw source')
})
