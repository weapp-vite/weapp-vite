import fs, { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readManagedWechatProjectRecords } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { createManagedWechatProjectJournal } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { resolveManagedJournalScope } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/scope'
import { classifyTerminalRuntimeFailure, parseTerminalRuntimeFailureLine, TERMINAL_RUNTIME_FAILURE_MARKER } from './terminalRuntimeFailure'
import { createTerminalRuntimeLaunchGuard } from './terminalRuntimeLaunchGuard'

const bootCode = 'E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED'
const deadlineCode = 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE'

describe('terminal runtime launch guard', () => {
  let root = ''
  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'terminal-runtime-guard-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })
  const journalPath = () => createManagedWechatProjectJournal(root)

  it.each([bootCode, deadlineCode])('freezes every subsequent launch in the same managed journal after %s', async (code) => {
    const journal = await journalPath()
    const first = await createTerminalRuntimeLaunchGuard(journal)
    const error = Object.assign(new Error('first terminal failure'), { code })
    expect(await first.blockedError()).toBeUndefined()

    await first.record(error)

    const next = await createTerminalRuntimeLaunchGuard(` ${path.join(journal, 'unused', '..')} `)
    expect(await next.blockedError()).toMatchObject({
      name: 'ManagedRuntimeLaunchBlockedError',
      cause: error,
    })
    expect(classifyTerminalRuntimeFailure(await next.blockedError())?.code).toBe(code)
  })

  it('preserves the first terminal error and its cause when later failures arrive', async () => {
    const guard = await createTerminalRuntimeLaunchGuard(await journalPath())
    const terminal = Object.assign(new Error('initial simulator failure'), { code: bootCode })
    const first = new Error('initial launch failed', { cause: terminal })
    await guard.record(first)
    await guard.record(Object.assign(new Error('later subscription failure'), { code: deadlineCode }))

    expect((await guard.blockedError())?.cause).toBe(first)
    expect(classifyTerminalRuntimeFailure(await guard.blockedError())?.code).toBe(bootCode)
  })

  it('allows another journal without clearing the failed invocation', async () => {
    const journal = await journalPath()
    const failed = await createTerminalRuntimeLaunchGuard(journal)
    await failed.record(Object.assign(new Error('failed'), { code: bootCode }))

    expect(await (await createTerminalRuntimeLaunchGuard(await journalPath())).blockedError()).toBeUndefined()
    expect(await (await createTerminalRuntimeLaunchGuard(journal)).blockedError()).toBeInstanceOf(Error)
  })

  it('does not freeze ordinary assertion failures or terminal-looking messages', async () => {
    const guard = await createTerminalRuntimeLaunchGuard(await journalPath())
    await guard.record(new Error('expected page value to match'))
    await guard.record(new Error(`${bootCode}: simulator launch failed`))
    await guard.record({ code: bootCode })
    expect(await guard.blockedError()).toBeUndefined()
  })

  it.each([undefined, '', '  '])('keeps launches without a managed journal isolated (%s)', async (journal) => {
    const guard = await createTerminalRuntimeLaunchGuard(journal)
    await guard.record(Object.assign(new Error('unmanaged mock failed'), { code: bootCode }))

    expect(await guard.blockedError()).toBeUndefined()
    expect(await (await createTerminalRuntimeLaunchGuard()).blockedError()).toBeUndefined()
    expect(await (await createTerminalRuntimeLaunchGuard(await journalPath())).blockedError()).toBeUndefined()
  })

  it('rejects an unregistered journal instead of accepting an undefined ownership scope', async () => {
    await expect(createTerminalRuntimeLaunchGuard(root)).rejects.toThrow('explicitly registered journal ownership scope')
  })

  it('shares terminal evidence with registered child journals without creating window records', async () => {
    const journal = await journalPath()
    const child = await createManagedWechatProjectJournal(root, journal)
    const first = await createTerminalRuntimeLaunchGuard(child)
    await first.record(Object.assign(new Error('failed'), { code: bootCode }))

    expect(await (await createTerminalRuntimeLaunchGuard(journal)).blockedError()).toBeInstanceOf(Error)
    expect(await readManagedWechatProjectRecords(journal)).toEqual([])
  })

  it('rejects malformed persisted evidence and preserves the terminal cause when recording fails', async () => {
    const journal = await journalPath()
    const guard = await createTerminalRuntimeLaunchGuard(journal)
    await writeFile(path.join(journal, '.runtime-terminal'), 'incomplete evidence')

    await expect(guard.blockedError()).rejects.toBeInstanceOf(Error)
    const error = Object.assign(new Error('terminal failure'), { code: bootCode })
    await expect(guard.record(error)).rejects.toMatchObject({ cause: error })
  })

  it('rejects uncertain evidence paths without replacing them', async () => {
    const journal = await journalPath()
    const guard = await createTerminalRuntimeLaunchGuard(journal)
    await mkdir(path.join(journal, '.runtime-terminal'))

    await expect(guard.blockedError()).rejects.toThrow('regular file')
    const error = Object.assign(new Error('terminal failure'), { code: bootCode })
    await expect(guard.record(error)).rejects.toMatchObject({ cause: error })
  })

  it('uses the completed first writer after an EEXIST collision observed incomplete evidence', async () => {
    const journal = await journalPath()
    const guard = await createTerminalRuntimeLaunchGuard(journal)
    const file = path.join(journal, '.runtime-terminal')
    await writeFile(file, '')
    const later = Object.assign(new Error('later local simulator failure'), { code: bootCode })
    await expect(guard.record(later)).rejects.toMatchObject({ cause: later })

    const { scopeId } = await resolveManagedJournalScope(journal)
    await writeFile(file, JSON.stringify({
      schemaVersion: 1,
      scopeId,
      code: deadlineCode,
      reason: 'Runtime log subscription did not complete before the launch deadline.',
    }))

    const blocked = await (await createTerminalRuntimeLaunchGuard(journal)).blockedError()
    expect(blocked?.cause).not.toBe(later)
    expect(classifyTerminalRuntimeFailure(blocked)?.code).toBe(deadlineCode)
  })

  it('rejects recording failure before file creation and keeps the current worker frozen', async () => {
    const journal = await journalPath()
    const guard = await createTerminalRuntimeLaunchGuard(journal)
    const error = Object.assign(new Error('initial simulator failure'), { code: bootCode })
    const denied = Object.assign(new Error('terminal evidence could not be created'), { code: 'EACCES' })
    const write = vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(denied)
    try {
      await expect(guard.record(error)).rejects.toMatchObject({ cause: error, errors: [error, denied] })
    }
    finally {
      write.mockRestore()
    }

    await expect(fs.lstat(path.join(journal, '.runtime-terminal'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await (await createTerminalRuntimeLaunchGuard(journal)).blockedError())?.cause).toBe(error)
  })
})

describe('terminal runtime failure classification', () => {
  it('classifies the typed boot error without copying private error details', () => {
    const error = Object.assign(new Error('simulator launch failed token=private-value'), { code: bootCode })
    expect(classifyTerminalRuntimeFailure(error)).toEqual({
      code: bootCode,
      reason: 'WeChat DevTools simulator failed to start before webview page ready.',
    })
  })

  it('finds a typed log subscription deadline through wrapped causes', () => {
    const deadline = Object.assign(new Error('Runtime log subscription deadline exhausted'), { code: deadlineCode })
    const error = new Error('startup failed', { cause: new Error('operation failed', { cause: deadline }) })
    expect(classifyTerminalRuntimeFailure(error)).toEqual({
      code: deadlineCode,
      reason: 'Runtime log subscription did not complete before the launch deadline.',
    })
  })

  it('preserves the outer typed failure when its cause has another terminal code', () => {
    const cause = Object.assign(new Error('subscription failed'), { code: deadlineCode })
    const error = Object.assign(new Error('simulator failed', { cause }), { code: bootCode })
    expect(classifyTerminalRuntimeFailure(error)?.code).toBe(bootCode)
  })

  it('terminates circular cause chains without classifying ordinary errors', () => {
    const first = new Error('first')
    const second = new Error('second', { cause: first })
    first.cause = second
    expect(classifyTerminalRuntimeFailure(first)).toBeUndefined()
  })

  it('requires an explicit cause instead of guessing from aggregate members', () => {
    const failure = Object.assign(new Error('startup failed'), { code: bootCode })
    const cleanup = new Error('cleanup failed')
    expect(classifyTerminalRuntimeFailure(new AggregateError([failure, cleanup], 'Unclassified aggregate'))).toBeUndefined()
    expect(classifyTerminalRuntimeFailure(new AggregateError([failure, cleanup], 'cleanup failed', { cause: failure }))?.code).toBe(bootCode)
  })

  it('does not classify ordinary errors based on names, messages or non-error payloads', () => {
    const error = new Error(`${bootCode}: simulator launch failed; ${deadlineCode}`)
    error.name = 'WechatIdeSimulatorBootLogError'
    expect(classifyTerminalRuntimeFailure(error)).toBeUndefined()
    expect(classifyTerminalRuntimeFailure({ code: bootCode, message: 'simulator launch failed' })).toBeUndefined()
    expect(classifyTerminalRuntimeFailure(Object.assign(new Error('failed'), { code: 'UNKNOWN' }))).toBeUndefined()
  })
})

describe('terminal runtime failure line parsing', () => {
  it.each([bootCode, deadlineCode])('accepts the exact marker and declared code %s', (code) => {
    expect(parseTerminalRuntimeFailureLine(`${TERMINAL_RUNTIME_FAILURE_MARKER}${JSON.stringify({ code, reason: ' startup failed ' })}`))
      .toEqual({ code, reason: 'startup failed' })
  })

  it.each([
    '',
    'not-json',
    'null',
    '[]',
    'false',
    '"failure"',
    JSON.stringify({ code: 'UNKNOWN', reason: 'failed' }),
    JSON.stringify({ code: bootCode }),
    JSON.stringify({ reason: 'failed' }),
    JSON.stringify({ code: bootCode, reason: '' }),
    JSON.stringify({ code: bootCode, reason: ' \n\t ' }),
    JSON.stringify({ code: bootCode, reason: 1 }),
    JSON.stringify({ code: bootCode, reason: 'failed', extra: true }),
  ])('rejects malformed or undeclared payload %s', (payload) => {
    expect(parseTerminalRuntimeFailureLine(`${TERMINAL_RUNTIME_FAILURE_MARKER}${payload}`)).toBeUndefined()
  })

  it('does not accept markers embedded in ordinary or prefixed logs', () => {
    const line = `${TERMINAL_RUNTIME_FAILURE_MARKER}${JSON.stringify({ code: bootCode, reason: 'failed' })}`
    expect(parseTerminalRuntimeFailureLine(`prefix ${line}`)).toBeUndefined()
    expect(parseTerminalRuntimeFailureLine(` ${line}`)).toBeUndefined()
    expect(parseTerminalRuntimeFailureLine(line.replace(TERMINAL_RUNTIME_FAILURE_MARKER, '[e2e:runtime-terminal]'))).toBeUndefined()
  })
})
