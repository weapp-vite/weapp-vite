import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { getSuiteTasks, listE2ESuites } from './e2e-suite-manifest'
import { runTaskSuite } from './suiteRunner'

function isCurrentModuleEntry(entryArg: string | undefined, moduleUrl: string) {
  if (!entryArg) {
    return false
  }

  const resolvedEntryPath = path.isAbsolute(entryArg)
    ? entryArg
    : path.resolve(entryArg)

  try {
    return moduleUrl === pathToFileURL(resolvedEntryPath).href
  }
  catch {
    return false
  }
}

export function shouldCleanupIdeBeforeEachTask(mode: string) {
  return /^ide(?:$|-|:)(?!headless)/.test(mode)
}

export async function runE2ESuiteCli(args = process.argv.slice(2)) {
  const allowFailures = args.includes('--allow-failures')
  const mode = args.find(arg => !arg.startsWith('--')) ?? 'full'

  if (mode === 'list') {
    const suites = listE2ESuites()
    for (const suite of suites) {
      console.log(`${suite.name} (${suite.taskCount})`)
      console.log(`  ${suite.description}`)
    }
    process.exit(0)
  }

  const tasks = getSuiteTasks(mode)

  if (tasks.length === 0) {
    console.error(`Unknown e2e suite: ${mode}`)
    console.error(`Available suites: ${listE2ESuites().map(suite => suite.name).join(', ')}, list`)
    process.exitCode = 1
    return
  }

  await runTaskSuite(`e2e:${mode}`, tasks, {
    beforeEachTask: shouldCleanupIdeBeforeEachTask(mode)
      ? async () => {
        await cleanupResidualIdeProcesses()
      }
      : undefined,
    afterAll: shouldCleanupIdeBeforeEachTask(mode)
      ? async () => {
        await cleanupResidualIdeProcesses()
      }
      : undefined,
    failOnTaskFailure: !allowFailures,
  })
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await runE2ESuiteCli()
}
