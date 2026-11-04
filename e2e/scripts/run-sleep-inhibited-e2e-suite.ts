import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { runSleepInhibitedE2EEntry } from './sleepInhibitedE2E/entry'
import { startSleepInhibitor } from './sleepInhibitedE2E/inhibitor'
import { createSuiteSignalScope } from './suiteRunner/signals'

export async function runSleepInhibitedE2ESuite(args = process.argv.slice(2)) {
  const scope = createSuiteSignalScope()
  const errors: unknown[] = []
  let inhibitor: Awaited<ReturnType<typeof startSleepInhibitor>>
  try {
    inhibitor = await startSleepInhibitor()
    void inhibitor?.failure.then((error) => {
      if (error) {
        scope.cancel(error)
      }
    })
    scope.signal.throwIfAborted()
    const exitCode = await runSleepInhibitedE2EEntry(args, scope.signal)
    process.exitCode = scope.exitCode ?? exitCode ?? process.exitCode ?? 0
  }
  catch (error) {
    if (!scope.signal.aborted || error !== scope.signal.reason) {
      errors.push(error)
    }
  }
  finally {
    try {
      await inhibitor?.close()
    }
    catch (error) {
      errors.push(error)
    }
    if (scope.exitCode !== undefined) {
      process.exitCode = scope.exitCode
    }
    scope.dispose()
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, 'E2E suite and sleep inhibitor cleanup failed.', { cause: errors[0] })
  }
  if (errors.length) {
    throw errors[0]
  }
}

function isCurrentModuleEntry(entryArg: string | undefined, moduleUrl: string) {
  if (!entryArg) {
    return false
  }
  const resolvedEntryPath = path.isAbsolute(entryArg) ? entryArg : path.resolve(entryArg)
  return moduleUrl === pathToFileURL(resolvedEntryPath).href
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await runSleepInhibitedE2ESuite()
}
