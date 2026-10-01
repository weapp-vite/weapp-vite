import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { hash, stateRoot } from '@weapp-agent/core/project'
import { afterEach, expect, it, vi } from 'vitest'
import { AcceptanceService } from '../src/acceptance'

const cleanup = vi.hoisted(() => ({
  beforeRemove: undefined as undefined | ((file: string) => Promise<void>),
  beforeRename: undefined as undefined | ((from: string, to: string) => Promise<void>),
}))
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return {
    ...fs,
    rm: async (...args: Parameters<typeof fs.rm>) => {
      await cleanup.beforeRemove?.(String(args[0]))
      return fs.rm(...args)
    },
    rename: async (...args: Parameters<typeof fs.rename>) => {
      await cleanup.beforeRename?.(String(args[0]), String(args[1]))
      return fs.rename(...args)
    },
  }
})

const roots: string[] = []
afterEach(async () => {
  cleanup.beforeRemove = undefined
  cleanup.beforeRename = undefined
  vi.unstubAllEnvs()
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

async function fixture(exitCode = 0) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'acceptance-completion-')))
  const state = await mkdtemp(path.join(tmpdir(), 'acceptance-state-'))
  roots.push(root, state)
  vi.stubEnv('WEAPP_AGENT_STATE_DIR', state)
  await mkdir(path.join(root, 'src'))
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'weapp-vite': '7.4.0' } }))
  await writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
  await writeFile(path.join(root, 'weapp-acceptance.config.json'), JSON.stringify({
    verification: [{ kind: 'build', command: process.execPath, args: ['-e', `process.exit(${exitCode})`] }],
    acceptance: { requiredChecks: ['build'] },
  }))
  const service = await AcceptanceService.create(root, { trust: true })
  const observer = await AcceptanceService.create(root)
  const directory = path.join(stateRoot(), 'acceptance', hash(root))
  return { service, observer, directory }
}

it.each([0, 1])('publishes exit %i only after releasing project ownership', async (exitCode) => {
  const { service, observer, directory } = await fixture(exitCode)
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  cleanup.beforeRemove = async (file) => {
    if (file === path.join(directory, 'lock')) {
      entered.resolve()
      await release.promise
    }
  }
  try {
    const started = await service.start()
    await entered.promise
    expect(await service.report(started.jobId)).toMatchObject({ status: 'running', passed: false })
    expect(await observer.report(started.jobId)).toMatchObject({ status: 'running', passed: false })
    const persisted: unknown = JSON.parse(await readFile(path.join(directory, started.jobId, 'report.json'), 'utf8'))
    expect(persisted).toMatchObject({ status: 'running', passed: false })
    expect(await observer.start()).toMatchObject({ status: 'action_required', passed: false })
    release.resolve()
    const status = exitCode === 0 ? 'passed' : 'failed'
    expect(await service.wait(started.jobId)).toMatchObject({ status, passed: exitCode === 0 })
    const next = await observer.start()
    expect(next.status).toBe('running')
    expect(await observer.wait(next.jobId)).toMatchObject({ status, passed: exitCode === 0 })
  }
  finally {
    release.resolve()
    await service.close()
    await observer.close()
  }
})

it('retains ownership and reports failure when lock cleanup fails', async () => {
  const { service, observer, directory } = await fixture()
  cleanup.beforeRemove = async (file) => {
    if (file === path.join(directory, 'lock')) {
      throw new Error('injected lock cleanup failure')
    }
  }
  try {
    const started = await service.start()
    expect(await service.wait(started.jobId)).toMatchObject({ status: 'failed', passed: false })
    expect(await observer.report(started.jobId)).toMatchObject({ status: 'failed', passed: false })
    expect(await observer.start()).toMatchObject({ status: 'action_required' })
    const owner: unknown = JSON.parse(await readFile(path.join(directory, 'lock/owner.json'), 'utf8'))
    expect(owner).toMatchObject({ jobId: started.jobId })
  }
  finally {
    cleanup.beforeRemove = undefined
    await service.close()
    await observer.close()
  }
})

it('retains a failed live report if terminal persistence fails after release', async () => {
  const { service, observer } = await fixture()
  cleanup.beforeRename = async (from, to) => {
    if (path.basename(to) === 'report.json') {
      const report = JSON.parse(await readFile(from, 'utf8')) as { status: string }
      if (report.status !== 'running') {
        throw new Error('injected report persistence failure')
      }
    }
  }
  try {
    const started = await service.start()
    expect(await service.wait(started.jobId)).toMatchObject({
      status: 'failed',
      passed: false,
      reason: expect.stringContaining('injected report persistence failure'),
    })
    cleanup.beforeRename = undefined
    const next = await observer.start()
    expect(next.status).toBe('running')
    expect(await observer.wait(next.jobId)).toMatchObject({ status: 'passed', passed: true })
  }
  finally {
    cleanup.beforeRename = undefined
    await service.close()
    await observer.close()
  }
})
