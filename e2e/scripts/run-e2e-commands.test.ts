import type { MachineE2ELease, MachineE2ELeaseOptions } from '../../packages/devtools-runtime/src/lease/machine'
import type { IsolatedMachineLease } from '../utils/testSupport/machineLease'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createIsolatedMachineLease } from '../utils/testSupport/machineLease'
import { runE2ECommands } from './run-e2e-commands'

const fixture = vi.hoisted(() => ({ machine: undefined as IsolatedMachineLease | undefined }))
vi.mock('../../packages/devtools-runtime/src/lease/machine', async (original) => {
  const actual = await original<typeof import('../../packages/devtools-runtime/src/lease/machine')>()
  return {
    ...actual,
    withMachineE2ELease: <T>(run: (lease: MachineE2ELease) => Promise<T>, options?: MachineE2ELeaseOptions) => {
      if (!fixture.machine) {
        throw new Error('Command tests require an isolated machine lease.')
      }
      return actual.withMachineE2ELease(run, { ...options, stateDirectory: fixture.machine.stateDirectory })
    },
  }
})

beforeEach(async () => {
  fixture.machine = await createIsolatedMachineLease()
  for (const [key, value] of Object.entries(fixture.machine.environment)) {
    vi.stubEnv(key, value)
  }
})

afterEach(async () => {
  try {
    await fixture.machine?.dispose()
  }
  finally {
    fixture.machine = undefined
    vi.unstubAllEnvs()
  }
})

it('passes machine ownership to commands and stops a sequence after the first failure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'e2e-commands-'))
  const first = path.join(root, 'first')
  const last = path.join(root, 'last')
  const writeMarker = 'require("node:fs").writeFileSync(process.argv[1], String(Boolean(process.env.WEAPP_VITE_E2E_MACHINE_LEASE)))'
  try {
    const code = await runE2ECommands([
      process.execPath,
      '-e',
      writeMarker,
      first,
      '--next',
      process.execPath,
      '-e',
      'process.exit(7)',
      '--next',
      process.execPath,
      '-e',
      writeMarker,
      last,
    ])
    expect(code).toBe(7)
    expect(await readFile(first, 'utf8')).toBe('true')
    await expect(readFile(last, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await runE2ECommands([process.execPath, '-e', 'process.exit(0)'])).toBe(0)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects incomplete sequences before launching a child', async () => {
  await expect(runE2ECommands([])).rejects.toThrow('empty command')
  await expect(runE2ECommands(['--next', 'node'])).rejects.toThrow('empty command')
  await expect(runE2ECommands(['node', '--next'])).rejects.toThrow('empty command')
})

it('waits for cancellation cleanup before releasing the lease and starting another sequence', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'e2e-command-cancel-'))
  const marker = path.join(root, 'child')
  const nextMarker = path.join(root, 'next')
  const controller = new AbortController()
  const running = runE2ECommands([
    process.execPath,
    '-e',
    'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)',
    marker,
    '--next',
    process.execPath,
    '-e',
    'require("node:fs").writeFileSync(process.argv[1], "must-not-run")',
    nextMarker,
  ], controller.signal)
  try {
    await vi.waitFor(async () => {
      expect(await readFile(marker, 'utf8')).toMatch(/^\d+$/)
    }, { timeout: 5_000 })
    const childPid = Number(await readFile(marker, 'utf8'))
    controller.abort()
    expect(await running).not.toBe(0)
    expect(() => process.kill(childPid, 0)).toThrow()
    await expect(readFile(nextMarker, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await runE2ECommands([process.execPath, '-e', 'process.exit(0)'])).toBe(0)
  }
  finally {
    controller.abort()
    try {
      await running
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  }
})
