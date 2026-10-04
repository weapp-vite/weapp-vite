import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, it, vi } from 'vitest'
import { runE2ECommands } from './run-e2e-commands'

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
  const controller = new AbortController()
  const running = runE2ECommands([
    process.execPath,
    '-e',
    'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)',
    marker,
  ], controller.signal)
  try {
    await vi.waitFor(async () => {
      expect(await readFile(marker, 'utf8')).toMatch(/^\d+$/)
    }, { timeout: 5_000 })
    const childPid = Number(await readFile(marker, 'utf8'))
    controller.abort()
    expect(await running).not.toBe(0)
    expect(() => process.kill(childPid, 0)).toThrow()
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
