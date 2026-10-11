import type { SessionSummary } from '@weapp-agent/core'
import { appendFile, mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Session } from '@weapp-agent/core'
import { Command } from 'commander'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerSessionCommands } from '../src/commands/session.js'

let root: string
let previousExitCode: typeof process.exitCode

beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-agent-session-cli-')))
  vi.stubEnv('WEAPP_AGENT_STATE_DIR', path.join(root, 'state'))
  previousExitCode = process.exitCode
  process.exitCode = undefined
})

afterEach(async () => {
  process.exitCode = previousExitCode
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

async function command(args: string[]) {
  const values: Array<{ value: unknown, json: boolean }> = []
  const program = new Command()
    .exitOverride()
    .option('-C, --cwd <directory>', 'project directory', root)
    .option('--json', 'JSON output')
  registerSessionCommands(program, (value, json) => values.push({ value, json }))
  await program.parseAsync(args, { from: 'user' })
  expect(values).toHaveLength(1)
  return values[0]!
}

async function completedSession() {
  const session = new Session(root)
  await session.open()
  try {
    await session.append('run.started', { root, model: 'fixture', resumed: false })
    await session.append('message', { message: { role: 'user', text: 'Inspect the counter page' } })
    await session.append('step.started', { step: 1 })
    await session.append('usage', { inputTokens: 20, outputTokens: 8 })
    await session.append('run.completed', { status: 'completed', text: 'Inspected' })
  }
  finally {
    await session.close()
  }
  return session
}

it('preserves the existing sessions JSON array without model configuration', async () => {
  const session = await completedSession()
  expect(await command(['sessions', '--json'])).toEqual({ value: [session.id], json: true })
})

it('returns details and inspects the same saved session without taking its lock', async () => {
  const session = await completedSession()
  const writer = new Session(root, session.id)
  await writer.open(true)
  try {
    const before = await readFile(session.filename, 'utf8')
    const listing = await command(['--json', 'sessions', '--details'])
    const detail = await command(['session', session.id, '--json'])
    expect(listing.value).toEqual([detail.value])
    expect(detail).toMatchObject({
      json: true,
      value: {
        sessionId: session.id,
        prompt: 'Inspect the counter page',
        status: 'completed',
        steps: 1,
        usage: { inputTokens: 20, outputTokens: 8 },
        pendingCalls: [],
      },
    })
    expect(await readFile(session.filename, 'utf8')).toBe(before)
    expect(process.exitCode).toBeUndefined()
  }
  finally {
    await writer.close()
  }
})

it('reports a damaged journal separately while keeping other sessions discoverable', async () => {
  const valid = await completedSession()
  const damaged = await completedSession()
  await appendFile(damaged.filename, 'invalid JSON\n')
  const listing = await command(['sessions', '--details', '--json'])
  expect((listing.value as SessionSummary[]).map(summary => [summary.sessionId, summary.status])).toEqual(expect.arrayContaining([
    [valid.id, 'completed'],
    [damaged.id, 'invalid'],
  ]))
  expect(process.exitCode).toBeUndefined()
  expect((await command(['session', damaged.id, '--json'])).value).toMatchObject({ status: 'invalid' })
  expect(process.exitCode).toBe(1)
})
