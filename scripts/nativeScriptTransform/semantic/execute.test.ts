import type { SemanticExecution, SemanticWorkerRequest } from './types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { exec } from 'tinyexec'
import { describe, expect, it } from 'vitest'

const fixtureFile = fileURLToPath(new URL('./executeFixture.ts', import.meta.url))
const source = `
import { install, register, value } from 'fixture'
install()
export const run = () => value + 1
const options = { run }
register(options)
export default options
`

async function execute(code = source, scenarioId = 'valid', timeoutMs = 1000) {
  const request: SemanticWorkerRequest = { schemaVersion: 1, scenarioId, filename: 'complete-page.mjs', code, timeoutMs }
  const child = await exec(process.execPath, ['--experimental-vm-modules', '--import', 'tsx', fixtureFile], {
    stdin: JSON.stringify(request),
    throwOnError: false,
    timeout: 10000,
  })
  const result = JSON.parse(child.stdout) as SemanticExecution
  expect(child.exitCode).toBe(result.passed ? 0 : 1)
  return result
}

describe('complete ESM semantic execution', () => {
  it('executes imports, registration, default identity and exported behavior from unchanged code', async () => {
    const result = await execute()
    expect(result.passed).toBe(true)
    expect(result.loadedCodeSha256).toBe(createHash('sha256').update(source).digest('hex'))
    expect(result.loadedCodeUtf16Length).toBe(source.length)
    expect(result.loadedCodeUtf8Bytes).toBe(Buffer.byteLength(source))
    expect(result.exports).toEqual(['default', 'run'])
    expect(result.imports).toEqual([{ specifier: 'fixture', exports: ['install', 'register', 'value'], dynamic: false }])
    expect(result.inlineInvocations).toEqual(['run'])
    expect(result.computedInvocations).toEqual([])
    expect(result.lifecycleInvocations).toEqual([])
    expect(result.cleanup).toEqual({ attempted: true, completed: true, errors: [] })
    expect(result.pending).toEqual([])
    expect(result.unhandledErrors).toEqual([])
  })

  it.each([
    ['unknown static module', `import 'unlisted';\n${source}`, 'Unknown semantic import'],
    ['missing export', `import { absent } from 'fixture';\n${source}`, 'does not provide an export'],
    ['unknown dynamic module', `${source}\nawait import('unlisted')`, 'Dynamic semantic imports are unsupported'],
    ['known dynamic module', `${source}\nawait import('fixture')`, 'Dynamic semantic imports are unsupported'],
    ['evaluation exception', `${source}\nthrow new Error('module failed')`, 'module failed'],
    ['no registration', source.replace('register(options)', ''), 'Expected values'],
    ['duplicate registration', source.replace('register(options)', 'register(options); register(options)'), 'Expected values'],
    ['no-op handler', source.replace('value + 1', 'undefined'), 'Expected values'],
    ['handler exception', source.replace('() => value + 1', '() => { throw new Error("handler failed") }'), 'handler failed'],
    ['handler rejection', source.replace('() => value + 1', 'async () => { throw new Error("handler rejected") }'), 'handler rejected'],
  ])('fails closed for %s', async (_name, code, message) => {
    const result = await execute(code)
    expect(result.passed).toBe(false)
    expect(JSON.stringify(result.failure)).toContain(message)
    expect(result.cleanup.completed).toBe(true)
  })

  it('rejects unfinished tracked work', async () => {
    const result = await execute(`${source}\ntrackPending()`)
    expect(result.passed).toBe(false)
    expect(result.pending).toEqual(['unfinished service'])
    expect(result.async).toEqual([{ id: 0, label: 'unfinished service', status: 'pending' }])
  })

  it.each([
    ['missing-inline', 'Unexecuted inline'],
    ['unknown-inline', 'Invalid inline invocation'],
    ['zero-inline', 'Invalid inline invocation'],
    ['missing-computed', 'Unexecuted computed'],
    ['unknown-computed', 'Invalid computed invocation'],
    ['zero-computed', 'Invalid computed invocation'],
    ['missing-lifecycle', 'Unexecuted lifecycle'],
    ['unknown-lifecycle', 'Invalid lifecycle invocation'],
    ['zero-lifecycle', 'Invalid lifecycle invocation'],
  ])('rejects invalid actual invocation coverage: %s', async (scenarioId, message) => {
    const result = await execute(source, scenarioId)
    expect(result.passed).toBe(false)
    expect(JSON.stringify(result.failure)).toContain(message)
  })

  it('captures detached rejection and does not accept equal failures', async () => {
    const result = await execute(`${source}\nstartDetached()`)
    expect(result.passed).toBe(false)
    expect(result.unhandledErrors).toEqual([expect.objectContaining({ type: 'error', name: 'Error', message: 'detached rejection' })])
  })

  it('does not swallow a rejected tracked promise without a consumer', async () => {
    const result = await execute(`${source}\nrejectTracked()`)
    expect(result.passed).toBe(false)
    expect(result.unhandledErrors).toEqual([expect.objectContaining({ type: 'error', message: 'tracked rejection' })])
  })

  it('rejects async work created during cleanup', async () => {
    const result = await execute(source, 'cleanup-pending')
    expect(result.passed).toBe(false)
    expect(result.pending).toEqual(['unfinished cleanup'])
  })

  it('reports final pending state while retaining failure for work settled only during cleanup', async () => {
    const result = await execute(`${source}\ntrackPending()`, 'cleanup-settle')
    expect(result.passed).toBe(false)
    expect(result.pending).toEqual([])
    expect(result.async).toEqual([{ id: 0, label: 'unfinished service', status: 'fulfilled' }])
    expect(JSON.stringify(result.failure)).toContain('Unfinished semantic async work')
    expect(result.cleanup.completed).toBe(true)
  })

  it('bounds unresolved top-level await and still records cleanup', async () => {
    const result = await execute(`${source}\nawait new Promise(() => {})`, 'valid', 50)
    expect(result.passed).toBe(false)
    expect(JSON.stringify(result.failure)).toContain('module evaluation timed out')
    expect(result.cleanup.completed).toBe(true)
  })

  it('fails when fixture cleanup fails', async () => {
    const result = await execute(source, 'throws-cleanup')
    expect(result.passed).toBe(false)
    expect(result.cleanup.completed).toBe(false)
    expect(result.cleanup.errors).toEqual([expect.objectContaining({ type: 'error', message: 'cleanup failed' })])
  })

  it('isolates repeat executions in fresh workers', async () => {
    const code = `${source}\nif (globalThis.used) throw new Error('reused context'); globalThis.used = true`
    const first = await execute(code)
    const second = await execute(code)
    expect(first.passed).toBe(true)
    expect(second).toEqual(first)
  })
})
