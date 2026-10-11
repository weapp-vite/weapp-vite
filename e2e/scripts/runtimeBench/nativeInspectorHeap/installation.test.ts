import { mkdirSync, writeFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout } from 'node:timers'
import { afterEach, expect, it, vi } from 'vitest'
import { createNativeInspectorHeapCollector } from './index'
import { prepareNativeInspectorBench, readNativeInspectorTarget } from './installation'
import { testInspectorIdentity } from './testHelpers'

vi.mock('./index', async (importOriginal) => {
  const original = await importOriginal<typeof import('./index')>()
  return { ...original, createNativeInspectorHeapCollector: vi.fn(original.createNativeInspectorHeapCollector) }
})

vi.mock('node:timers', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:timers')>()
  return { ...original, setTimeout: vi.fn(original.setTimeout) }
})

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

async function input() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-inspector-install-'))
  roots.push(root)
  return path.join(root, 'target.json')
}

it('accepts one atomic operator input for the current session', async () => {
  const filePath = await input()
  const result = readNativeInspectorTarget(filePath, 'current-session')
  const targetUrl = 'http://127.0.0.1:4567/appservice/s0/_sessionId/simulator-app-session-s0/mainframe'
  await fs.writeFile(`${filePath}.tmp`, JSON.stringify({ sessionId: 'current-session', targetUrl }))
  await fs.rename(`${filePath}.tmp`, filePath)
  await expect(result).resolves.toBe(targetUrl)
})

it.each([
  ['previous session', JSON.stringify({ sessionId: 'previous-session', targetUrl: 'old-target' })],
  ['invalid JSON', '{'],
  ['missing target', JSON.stringify({ sessionId: 'current-session' })],
  ['oversized input', ' '.repeat(65_537)],
])('rejects %s without replacing it with a later input', async (_label, text) => {
  const filePath = await input()
  await fs.writeFile(filePath, text)
  await expect(readNativeInspectorTarget(filePath, 'current-session')).rejects.toThrow()
})

it('closes the watcher when installation input times out', async () => {
  const filePath = await input()
  await expect(readNativeInspectorTarget(filePath, 'current-session', 10)).rejects.toThrow('installation input timed out')
  await fs.writeFile(filePath, JSON.stringify({ sessionId: 'current-session', targetUrl: 'late-target' }))
})

async function installationOptions(inputText: string) {
  const filePath = await input()
  const directory = path.join(path.dirname(filePath), 'installation')
  const identity = testInspectorIdentity()
  return {
    directory,
    identity,
    preset: 'normal',
    resource: { projectPath: '<fixture>', wsEndpoint: 'ws://127.0.0.1', port: 0 },
    log(message: string) {
      if (message.startsWith('native Inspector target required:')) {
        writeFileSync(path.join(directory, 'target.json'), inputText)
      }
    },
  }
}

async function failureRecord(directory: string) {
  return {
    raw: JSON.parse(await fs.readFile(path.join(directory, 'raw.json'), 'utf8')) as { state: unknown, installationError: string | null, records: unknown[], rawResponses: unknown[] },
    control: JSON.parse(await fs.readFile(path.join(directory, 'request.json'), 'utf8')) as { phase: string, rawSaved: boolean },
  }
}

function collectorFixture(identity: ReturnType<typeof testInspectorIdentity>) {
  const state = { ready: true, polling: false, pending: false, closed: false, failure: null }
  const collector: Awaited<ReturnType<typeof createNativeInspectorHeapCollector>> = {
    identity,
    endpoint: 'http://127.0.0.1',
    token: 'test-only-token',
    consoleExpression: 'test-only-expression',
    ready: Promise.resolve(),
    records: [],
    rawResponses: [],
    state,
    read: async () => { throw new Error('No sampling belongs to an installation unit test') },
    close: vi.fn(async () => { state.closed = true }),
  }
  return collector
}

it.each([
  ['malformed JSON', '{invalid'],
  ['another session', JSON.stringify({ sessionId: 'another-session', targetUrl: 'http://127.0.0.1' })],
  ['invalid target URL', JSON.stringify({ sessionId: 'test-owned-session', targetUrl: 'https://example.com/another-target' })],
])('archives %s failure before a collector has been acquired', async (_label, inputText) => {
  const options = await installationOptions(inputText)
  const error: unknown = await prepareNativeInspectorBench(options).catch(cause => cause)
  expect(error).toBeInstanceOf(Error)
  expect(error).not.toBeInstanceOf(AggregateError)
  const { raw, control } = await failureRecord(options.directory)
  expect(control).toMatchObject({ phase: 'failed', rawSaved: true })
  expect(raw).toEqual(expect.objectContaining({ state: null, installationError: (error as Error).message, records: [], rawResponses: [] }))
})

it('preserves a collector startup rejection and records no unacquired listener', async () => {
  const options = await installationOptions(JSON.stringify({ sessionId: 'test-owned-session', targetUrl: testInspectorIdentity().targetUrl }))
  const original = new Error('original collector startup failure')
  vi.mocked(createNativeInspectorHeapCollector).mockRejectedValueOnce(original)
  await expect(prepareNativeInspectorBench(options)).rejects.toBe(original)
  const { raw, control } = await failureRecord(options.directory)
  expect(control.phase).toBe('failed')
  expect(raw.state).toBeNull()
  expect(raw.installationError).toBe(original.message)
})

it('archives the original target-wait deadline failure without opening a listener', async () => {
  const options = await installationOptions('')
  options.log = () => {}
  const timers = await vi.importActual<typeof import('node:timers')>('node:timers')
  vi.mocked(setTimeout).mockImplementationOnce((callback, timeout, ...args) => {
    expect(timeout).toBe(120_000)
    return timers.setTimeout(callback, 0, ...args)
  })
  await expect(prepareNativeInspectorBench(options)).rejects.toThrow('installation input timed out')
  const { raw, control } = await failureRecord(options.directory)
  expect(control).toMatchObject({ phase: 'failed', rawSaved: true })
  expect(raw).toMatchObject({ state: null, installationError: 'Native Inspector Console installation input timed out' })
  expect(createNativeInspectorHeapCollector).not.toHaveBeenCalled()
})

it('keeps a target-read permission failure as the original rejection', async () => {
  const options = await installationOptions('{}')
  const permission = Object.assign(new Error('original target-read permission error'), { code: 'EACCES' })
  vi.spyOn(fs, 'readFile').mockRejectedValueOnce(permission)
  await expect(prepareNativeInspectorBench(options)).rejects.toBe(permission)
  const { raw, control } = await failureRecord(options.directory)
  expect(control.phase).toBe('failed')
  expect(raw.installationError).toBe(permission.message)
  expect(createNativeInspectorHeapCollector).not.toHaveBeenCalled()
})

it('does not overwrite or clean an installation directory that was not acquired', async () => {
  const options = await installationOptions('{}')
  await fs.mkdir(options.directory)
  const existing = path.join(options.directory, 'request.json')
  await fs.writeFile(existing, 'existing-owner-record')
  await expect(prepareNativeInspectorBench(options)).rejects.toMatchObject({ code: 'EEXIST' })
  expect(await fs.readFile(existing, 'utf8')).toBe('existing-owner-record')
  expect(createNativeInspectorHeapCollector).not.toHaveBeenCalled()
})

it('closes an acquired listener once and records its actual successful state', async () => {
  const identity = testInspectorIdentity()
  const options = await installationOptions(JSON.stringify({ sessionId: identity.sessionId, targetUrl: identity.targetUrl }))
  const collector = collectorFixture(identity)
  vi.mocked(createNativeInspectorHeapCollector).mockResolvedValueOnce(collector)
  const installation = await prepareNativeInspectorBench(options)
  const first = installation.close()
  expect(installation.close()).toBe(first)
  await first
  expect(collector.close).toHaveBeenCalledOnce()
  const { raw, control } = await failureRecord(options.directory)
  expect(control).toMatchObject({ phase: 'closed', rawSaved: true })
  expect(raw.state).toMatchObject({ closed: true })
  expect(raw.installationError).toBeNull()
})

it('retains the original install error and listener cleanup error while still saving failed control', async () => {
  const identity = testInspectorIdentity()
  const options = await installationOptions(JSON.stringify({ sessionId: identity.sessionId, targetUrl: identity.targetUrl }))
  const original = new Error('original operator log failure')
  const cleanup = new Error('original listener close failure')
  const collector = collectorFixture(identity)
  vi.mocked(collector.close).mockRejectedValueOnce(cleanup)
  vi.mocked(createNativeInspectorHeapCollector).mockResolvedValueOnce(collector)
  const log = options.log
  options.log = (message) => {
    log(message)
    if (message.startsWith('native Inspector Console expression ready:')) {
      throw original
    }
  }
  const error = await prepareNativeInspectorBench(options).catch(cause => cause) as AggregateError
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors[0]).toBe(original)
  expect((error.errors[1] as AggregateError).errors).toEqual([cleanup])
  expect(collector.close).toHaveBeenCalledOnce()
  const { raw, control } = await failureRecord(options.directory)
  expect(control.phase).toBe('failed')
  expect(raw.installationError).toBe(original.message)
})

it('still publishes failed control when the raw failure archive cannot be written', async () => {
  const options = await installationOptions('{invalid')
  const log = options.log
  options.log = (message) => {
    log(message)
    mkdirSync(path.join(options.directory, 'raw.json'))
  }
  const error = await prepareNativeInspectorBench(options).catch(cause => cause) as AggregateError
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors[0]).toBeInstanceOf(SyntaxError)
  expect((error.errors[1] as AggregateError).errors[0]).toMatchObject({ code: 'EISDIR' })
  const control: unknown = JSON.parse(await fs.readFile(path.join(options.directory, 'request.json'), 'utf8'))
  expect(control).toMatchObject({ phase: 'failed', rawSaved: false })
  expect(createNativeInspectorHeapCollector).not.toHaveBeenCalled()
})

it('retains a failed-control permission error beside the original parse error', async () => {
  const options = await installationOptions('{invalid')
  const originalRename = fs.rename
  const permission = Object.assign(new Error('original failed-control permission error'), { code: 'EACCES' })
  vi.spyOn(fs, 'rename').mockImplementationOnce(originalRename).mockRejectedValueOnce(permission)
  const error = await prepareNativeInspectorBench(options).catch(cause => cause) as AggregateError
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors[0]).toBeInstanceOf(SyntaxError)
  expect((error.errors[1] as AggregateError).errors).toEqual([permission])
  const { raw } = await failureRecord(options.directory)
  expect(raw.installationError).toBe((error.errors[0] as Error).message)
})
