import type { TerminalRuntimeFailureCode } from './terminalRuntimeFailure'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { createManagedWechatProjectJournal } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'

const executeFile = promisify(execFile)
const directories: string[] = []
const helperUrl = new URL('./terminalRuntimeLaunchGuard.ts', import.meta.url).href
const classifierUrl = new URL('./terminalRuntimeFailure.ts', import.meta.url).href
const childScript = `
const [helperUrl, classifierUrl, journalPath, operation, code] = process.argv.slice(1)
const { createTerminalRuntimeLaunchGuard } = await import(helperUrl)
const { classifyTerminalRuntimeFailure } = await import(classifierUrl)
const guard = await createTerminalRuntimeLaunchGuard(journalPath)
if (operation === 'record') {
  const terminal = Object.assign(new Error('Original startup details belong only in the first process'), { code })
  await guard.record(new Error('Managed startup failed', { cause: terminal }))
  process.stdout.write(JSON.stringify({ recorded: true }))
}
else {
  let launchCalls = 0
  const launch = async () => { launchCalls += 1 }
  try {
    const error = await guard.blockedError()
    if (error) throw error
    await launch()
    process.stdout.write(JSON.stringify({ blocked: false, launchCalls }))
  }
  catch (error) {
    process.stdout.write(JSON.stringify({
      blocked: true,
      launchCalls,
      name: error.name,
      causeIsError: error.cause instanceof Error,
      causeCode: error.cause?.code,
      failure: classifyTerminalRuntimeFailure(error),
    }))
  }
}
`

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function runChild(journalPath: string, operation: 'record' | 'probe', code?: TerminalRuntimeFailureCode): Promise<unknown> {
  const { stdout } = await executeFile(process.execPath, [
    '--import',
    'tsx',
    '--input-type',
    'module',
    '-e',
    childScript,
    helperUrl,
    classifierUrl,
    journalPath,
    operation,
    ...(code ? [code] : []),
  ], { timeout: 30_000, windowsHide: true })
  return JSON.parse(stdout) as unknown
}

describe('terminal runtime launch guard across independent processes', () => {
  it.each([
    ['E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED', 'WeChat DevTools simulator failed to start before webview page ready.', 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE'],
    ['E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE', 'Runtime log subscription did not complete before the launch deadline.', 'E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED'],
  ] as const)('retains the first %s and freezes only its managed invocation', async (code, reason, laterCode) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'runtime-terminal-process-'))
    directories.push(directory)
    const journal = await createManagedWechatProjectJournal(directory)
    const independentJournal = await createManagedWechatProjectJournal(directory)
    const blocked = {
      blocked: true,
      launchCalls: 0,
      name: 'ManagedRuntimeLaunchBlockedError',
      causeIsError: true,
      causeCode: code,
      failure: { code, reason },
    }

    expect(await runChild(journal, 'record', code)).toEqual({ recorded: true })
    expect(await runChild(journal, 'probe')).toEqual(blocked)
    expect(await runChild(journal, 'record', laterCode)).toEqual({ recorded: true })
    expect(await runChild(journal, 'probe')).toEqual(blocked)
    expect(await runChild(independentJournal, 'probe')).toEqual({ blocked: false, launchCalls: 1 })
  }, 120_000)
})
